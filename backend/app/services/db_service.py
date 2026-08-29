import time
import copy
import threading
from typing import Dict, Any
from app.services.storage_service import get_storage_service

DB_DATA = {
    "persons": {},
    "couple_photos": [],
    "couple_categories": ["Ceremony", "Reception", "Portraits", "Candid"],
    "couple_settings": {"couple_name": "Sophia & James"}
}
LAST_LOAD_TIME = 0
CACHE_TTL = 5.0  # seconds in-memory TTL
DB_LOCK = threading.RLock()

def load_db(force: bool = False):
    """
    Loads database snapshot via the active StorageService.
    Uses in-memory caching to eliminate redundant reads/network requests.
    """
    global DB_DATA, LAST_LOAD_TIME
    with DB_LOCK:
        now = time.time()
        if not force and DB_DATA and DB_DATA.get("persons") and (now - LAST_LOAD_TIME < CACHE_TTL):
            return

        try:
            storage = get_storage_service()
            loaded = storage.load_database()
            if loaded:
                DB_DATA = loaded
                if "couple_categories" not in DB_DATA:
                    DB_DATA["couple_categories"] = ["Ceremony", "Reception", "Portraits", "Candid"]
                if "couple_settings" not in DB_DATA:
                    DB_DATA["couple_settings"] = {"couple_name": "Sophia & James"}
                LAST_LOAD_TIME = now
        except Exception as e:
            print(f"[DB Service] Error loading database: {e}")

def save_db():
    """
    Saves current in-memory database state via the active StorageService.
    """
    global LAST_LOAD_TIME
    with DB_LOCK:
        LAST_LOAD_TIME = time.time()
        snapshot = copy.deepcopy(DB_DATA)
        try:
            storage = get_storage_service()
            storage.save_database(snapshot)
        except Exception as e:
            print(f"[DB Service] Error saving database: {e}")

def get_db() -> Dict[str, Any]:
    """Returns the in-memory database reference."""
    return DB_DATA
