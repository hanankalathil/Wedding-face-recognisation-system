import os
import sys
import subprocess
import time
import webbrowser
import socket
import tkinter as tk
from tkinter import ttk
import threading

def is_port_in_use(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('127.0.0.1', port)) == 0

def open_in_app_mode(url):
    chrome_paths = [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe")
    ]
    edge_paths = [
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"
    ]
    
    # Try Chrome app mode first
    for path in chrome_paths:
        if os.path.exists(path):
            try:
                return subprocess.Popen([path, f"--app={url}"])
            except Exception:
                pass
                
    # Try Edge app mode second
    for path in edge_paths:
        if os.path.exists(path):
            try:
                return subprocess.Popen([path, f"--app={url}"])
            except Exception:
                pass
                
    # Fallback to standard browser
    webbrowser.open(url)
    return None

def check_server_and_close(root, port, venv_python, backend_run, base_dir):
    # Start the backend server invisibly
    process = subprocess.Popen(
        [venv_python, backend_run],
        cwd=base_dir,
        creationflags=subprocess.CREATE_NO_WINDOW
    )
    
    server_ready = False
    for _ in range(90): # Poll up to 45 seconds (90 polls at 0.5s)
        if is_port_in_use(port):
            server_ready = True
            break
        time.sleep(0.5)
        
    if server_ready:
        root.after(0, lambda: launch_browser_and_exit(root, port, process))
    else:
        root.after(0, lambda: show_error_and_exit(root, process))

def launch_browser_and_exit(root, port, process):
    root.destroy()
    # Open in dedicated application window
    browser_process = open_in_app_mode(f"http://localhost:{port}/admin")
    
    try:
        while True:
            # If backend process has stopped, exit launcher
            if process.poll() is not None:
                break
                
            # If browser process was successfully started in app mode and has now stopped (window closed)
            if browser_process and browser_process.poll() is not None:
                break
                
            time.sleep(1)
    except KeyboardInterrupt:
        pass
    finally:
        # Clean up backend process on exit
        if process.poll() is None:
            process.terminate()
        # Clean up browser process on exit (if still running)
        if browser_process and browser_process.poll() is None:
            browser_process.terminate()
    sys.exit(0)

def show_error_and_exit(root, process):
    root.destroy()
    print("Error: Server failed to start.")
    if process:
        process.terminate()
    sys.exit(1)

def main():
    base_dir = os.path.dirname(os.path.abspath(sys.argv[0]))
    
    # Smarter base directory detection:
    if not os.path.exists(os.path.join(base_dir, "venv")):
        fallback_dir = r"c:\Users\hanan\Documents\Face_Recognition_System"
        if os.path.exists(os.path.join(fallback_dir, "venv")):
            base_dir = fallback_dir

    venv_python = os.path.join(base_dir, "venv", "Scripts", "python.exe")
    backend_run = os.path.join(base_dir, "backend", "run.py")
    
    if not os.path.exists(venv_python):
        print(f"Error: Python virtual environment not found at: {venv_python}")
        time.sleep(5)
        sys.exit(1)
        
    if not os.path.exists(backend_run):
        print(f"Error: Backend runtime script not found at: {backend_run}")
        time.sleep(5)
        sys.exit(1)

    port = 8000
    
    # Reuse Server / Singleton check:
    if is_port_in_use(port):
        open_in_app_mode(f"http://localhost:{port}/admin")
        sys.exit(0)

    # Initialize Tkinter Splash Screen
    root = tk.Tk()
    root.title("Wedding System Startup")
    
    # Nordic Charcoal & Mint Teal Styling
    root.configure(bg="#0d0e12")
    root.overrideredirect(True) # Borderless window
    
    # Center on screen
    window_width = 450
    window_height = 200
    screen_width = root.winfo_screenwidth()
    screen_height = root.winfo_screenheight()
    position_top = int(screen_height/2 - window_height/2)
    position_right = int(screen_width/2 - window_width/2)
    root.geometry(f"{window_width}x{window_height}+{position_right}+{position_top}")
    
    # Title Label
    title_label = tk.Label(
        root, 
        text="Wedding System Portal", 
        font=("Outfit", 16, "bold"), 
        bg="#0d0e12", 
        fg="#f1f5f9"
    )
    title_label.pack(pady=(35, 10))
    
    # Status Label
    status_label = tk.Label(
        root, 
        text="Initializing Face Recognition & AI Engine...", 
        font=("Outfit", 10), 
        bg="#0d0e12", 
        fg="#94a3b8"
    )
    status_label.pack(pady=(0, 20))
    
    # Theme Progressbar
    style = ttk.Style()
    style.theme_use('clam')
    style.configure(
        "Teal.Horizontal.TProgressbar", 
        thickness=6, 
        troughcolor="#191d29", 
        background="#14b8a6", 
        bordercolor="#1e293b",
        lightcolor="#14b8a6",
        darkcolor="#14b8a6"
    )
    
    progress = ttk.Progressbar(
        root, 
        style="Teal.Horizontal.TProgressbar", 
        orient="horizontal", 
        length=320, 
        mode="indeterminate"
    )
    progress.pack()
    progress.start(8)
    
    # Footer Label
    footer_label = tk.Label(
        root, 
        text="Loading AI models. Please wait...", 
        font=("Outfit", 8), 
        bg="#0d0e12", 
        fg="#94a3b8"
    )
    footer_label.pack(side="bottom", pady=15)

    # Start port check and server startup in background thread
    thread = threading.Thread(
        target=check_server_and_close,
        args=(root, port, venv_python, backend_run, base_dir),
        daemon=True
    )
    thread.start()

    root.mainloop()
