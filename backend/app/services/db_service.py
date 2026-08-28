import json
import os
import copy
import threading
from app.core.config import DB_PATH, is_supabase_enabled
from app.services.supabase_service import load_db_from_supabase, save_db_to_supabase

DB_DATA = {"persons": {}}
LAST_DB_MTIME = 0
DB_LOCK = threading.RLock()

def load_db():
    global DB_DATA, LAST_DB_MTIME
    with DB_LOCK:
        if is_supabase_enabled():
            try:
                supa_data = load_db_from_supabase()
                if supa_data and "persons" in supa_data:
                    DB_DATA = supa_data
                    if "couple_categories" not in DB_DATA:
                        DB_DATA["couple_categories"] = ["Ceremony", "Reception", "Portraits", "Candid"]
                    if "couple_settings" not in DB_DATA:
                        DB_DATA["couple_settings"] = {"couple_name": "Sophia & James"}
                    return
            except Exception as e:
                print(f"[DB] Error loading from Supabase, falling back to local file: {e}")

        # Local JSON file fallback
        if os.path.exists(DB_PATH):
            current_mtime = os.path.getmtime(DB_PATH)
            if current_mtime > LAST_DB_MTIME:
                with open(DB_PATH, 'r') as f:
                    try:
                        DB_DATA = json.load(f)
                    except json.JSONDecodeError:
                        DB_DATA = {"persons": {}}
                if "couple_categories" not in DB_DATA:
                    DB_DATA["couple_categories"] = ["Ceremony", "Reception", "Portraits", "Candid"]
                if "couple_settings" not in DB_DATA:
                    DB_DATA["couple_settings"] = {"couple_name": "Sophia & James"}
                LAST_DB_MTIME = current_mtime
        else:
            DB_DATA = {
                "persons": {},
                "couple_categories": ["Ceremony", "Reception", "Portraits", "Candid"],
                "couple_settings": {"couple_name": "Sophia & James"}
            }

def save_db():
    global LAST_DB_MTIME
    with DB_LOCK:
        snapshot = copy.deepcopy(DB_DATA)
        
        # Save to local JSON as fallback/cache
        os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
        temp_path = f"{DB_PATH}.tmp"
        try:
            with open(temp_path, 'w') as f:
                json.dump(snapshot, f, indent=4)
            os.replace(temp_path, DB_PATH)
            if os.path.exists(DB_PATH):
                LAST_DB_MTIME = os.path.getmtime(DB_PATH)
        except Exception as e:
            print(f"[DB] Error saving local database: {e}")
            if os.path.exists(temp_path):
                try:
                    os.remove(temp_path)
                except Exception:
                    pass

        # Save to Supabase if enabled
        if is_supabase_enabled():
            try:
                save_db_to_supabase(snapshot)
            except Exception as e:
                print(f"[DB] Error saving to Supabase: {e}")

def get_db():
    return DB_DATA
