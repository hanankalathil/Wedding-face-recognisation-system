import os
import time
import socket
import uuid
import cv2
import threading
from pyftpdlib.authorizers import DummyAuthorizer
from pyftpdlib.handlers import FTPHandler
from pyftpdlib.servers import FTPServer
from datetime import datetime

from app.core.config import GALLERY_DIR
from app.services.db_service import get_db, load_db, save_db
from app.services.face_service import process_image_background

# Global server variables
ftp_server = None
ftp_thread = None

watcher_thread = None
watcher_stop_event = threading.Event()

# Lock for wifi history / operations
wifi_lock = threading.Lock()

def get_local_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # doesn't even have to be reachable
        s.connect(('10.255.255.255', 1))
        IP = s.getsockname()[0]
    except Exception:
        IP = '127.0.0.1'
    finally:
        s.close()
    return IP

class CameraFTPHandler(FTPHandler):
    def on_file_received(self, file_path):
        filename = os.path.basename(file_path)
        try:
            print(f"[FTP] File received: {file_path}")
            add_to_wifi_history(filename, "processing", "FTP")
            
            # Wait a fraction of a second to release locks just in case
            time.sleep(0.2)
            
            # Read image
            img = cv2.imread(file_path)
            if img is None:
                add_to_wifi_history(filename, "failed: Invalid image format", "FTP")
                if os.path.exists(file_path):
                    os.remove(file_path)
                return
                
            # Process image using face recognition pipeline
            final_filename = f"{uuid.uuid4().hex[:8]}_{filename}"
            
            # Run synchronously since we are already in the FTP handler's client thread
            process_image_background(img, final_filename, filename)
            
            # Update history to success
            add_to_wifi_history(filename, "success", "FTP")
            
            # Clean up temporary uploaded file from FTP root
            if os.path.exists(file_path):
                os.remove(file_path)
                
        except Exception as e:
            print(f"[FTP] Error processing {filename}: {e}")
            add_to_wifi_history(filename, f"failed: {str(e)}", "FTP")
            if os.path.exists(file_path):
                os.remove(file_path)

def run_ftp_server(port, username, password, upload_dir):
    global ftp_server
    try:
        os.makedirs(upload_dir, exist_ok=True)
        authorizer = DummyAuthorizer()
        authorizer.add_user(username, password, upload_dir, perm="elradfmwMT")
        
        handler = CameraFTPHandler
        handler.authorizer = authorizer
        handler.banner = "Techora Memories Camera FTP Ready."
        
        # Disable logging to console to keep uvicorn logs cleaner
        import logging
        logging.getLogger("pyftpdlib").setLevel(logging.WARNING)
        
        ftp_server = FTPServer(("0.0.0.0", port), handler)
        print(f"[FTP] Starting FTP server on port {port}...")
        ftp_server.serve_forever()
    except Exception as e:
        print(f"[FTP] Failed to run FTP server: {e}")

def watch_folder_loop(watch_dir):
    os.makedirs(watch_dir, exist_ok=True)
    print(f"[Watcher] Starting folder watcher on {watch_dir}...")
    
    while not watcher_stop_event.is_set():
        try:
            if not os.path.exists(watch_dir):
                time.sleep(2.0)
                continue
                
            for filename in os.listdir(watch_dir):
                if watcher_stop_event.is_set():
                    break
                file_path = os.path.join(watch_dir, filename)
                if os.path.isfile(file_path) and filename.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')):
                    # Wait slightly to ensure file is fully written
                    time.sleep(0.5)
                    
                    # Check if file is locked
                    try:
                        with open(file_path, 'ab'):
                            pass
                    except IOError:
                        # File is locked / still copying, skip
                        continue
                        
                    print(f"[Watcher] Found new photo to import: {filename}")
                    add_to_wifi_history(filename, "processing", "Watcher")
                    
                    img = cv2.imread(file_path)
                    if img is None:
                        add_to_wifi_history(filename, "failed: Invalid image format", "Watcher")
                        if os.path.exists(file_path):
                            os.remove(file_path)
                        continue
                        
                    final_filename = f"{uuid.uuid4().hex[:8]}_{filename}"
                    process_image_background(img, final_filename, filename)
                    add_to_wifi_history(filename, "success", "Watcher")
                    
                    # Delete file after import
                    if os.path.exists(file_path):
                        os.remove(file_path)
        except Exception as e:
            print(f"[Watcher] Error in watch loop: {e}")
            
        time.sleep(2.0)

def start_wifi_services():
    global ftp_server, ftp_thread, watcher_thread, watcher_stop_event
    
    load_db()
    db = get_db()
    
    settings = db.get("wifi_settings", {
        "ftp_enabled": False,
        "ftp_port": 2121,
        "ftp_username": "camera",
        "ftp_password": "camera",
        "watcher_enabled": False,
        "watch_folder": "data/wifi_imports"
    })
    
    # Ensure they exist in DB
    if "wifi_settings" not in db:
        db["wifi_settings"] = settings
        save_db()
        
    # Start FTP Server
    if settings.get("ftp_enabled", False):
        if ftp_server is None:
            ftp_port = settings.get("ftp_port", 2121)
            ftp_user = settings.get("ftp_username", "camera")
            ftp_pass = settings.get("ftp_password", "camera")
            ftp_dir = os.path.join(GALLERY_DIR, "wifi_temp")
            
            ftp_thread = threading.Thread(
                target=run_ftp_server, 
                args=(ftp_port, ftp_user, ftp_pass, ftp_dir), 
                daemon=True
            )
            ftp_thread.start()
            
    # Start Watch Folder
    if settings.get("watcher_enabled", False):
        if watcher_thread is None:
            watcher_stop_event.clear()
            watch_dir = settings.get("watch_folder", "data/wifi_imports")
            
            watcher_thread = threading.Thread(
                target=watch_folder_loop, 
                args=(watch_dir,), 
                daemon=True
            )
            watcher_thread.start()

def stop_wifi_services():
    global ftp_server, ftp_thread, watcher_thread, watcher_stop_event
    
    # Stop FTP
    if ftp_server is not None:
        print("[FTP] Stopping FTP server...")
        try:
            ftp_server.close_all()
        except Exception as e:
            print(f"[FTP] Error stopping FTP: {e}")
        ftp_server = None
    if ftp_thread is not None:
        ftp_thread.join(timeout=1.0)
        ftp_thread = None
        
    # Stop Watcher
    if watcher_thread is not None:
        print("[Watcher] Stopping folder watcher...")
        watcher_stop_event.set()
        watcher_thread.join(timeout=1.0)
        watcher_thread = None

def get_wifi_status():
    global ftp_server, watcher_thread
    load_db()
    db = get_db()
    settings = db.get("wifi_settings", {
        "ftp_enabled": False,
        "ftp_port": 2121,
        "ftp_username": "camera",
        "ftp_password": "camera",
        "watcher_enabled": False,
        "watch_folder": "data/wifi_imports"
    })
    
    return {
        "ftp_running": ftp_server is not None,
        "watcher_running": watcher_thread is not None,
        "settings": settings,
        "local_ip": get_local_ip()
    }

def update_wifi_settings(settings_dict):
    load_db()
    db = get_db()
    
    current_settings = db.get("wifi_settings", {
        "ftp_enabled": False,
        "ftp_port": 2121,
        "ftp_username": "camera",
        "ftp_password": "camera",
        "watcher_enabled": False,
        "watch_folder": "data/wifi_imports"
    })
    
    current_settings.update(settings_dict)
    db["wifi_settings"] = current_settings
    save_db()
    
    # Restart services to apply new config
    stop_wifi_services()
    start_wifi_services()
    return get_wifi_status()

def add_to_wifi_history(filename, status, method):
    with wifi_lock:
        load_db()
        db = get_db()
        if "wifi_history" not in db:
            db["wifi_history"] = []
            
        new_entry = {
            "id": uuid.uuid4().hex[:6],
            "filename": filename,
            "timestamp": datetime.now().isoformat(),
            "status": status,
            "method": method
        }
        
        # Prepend to show most recent first, limit to 100 entries
        db["wifi_history"].insert(0, new_entry)
        db["wifi_history"] = db["wifi_history"][:100]
        save_db()

def get_wifi_history():
    load_db()
    db = get_db()
    return db.get("wifi_history", [])

def clear_wifi_history():
    with wifi_lock:
        load_db()
        db = get_db()
        db["wifi_history"] = []
        save_db()
