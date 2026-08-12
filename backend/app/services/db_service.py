import json
import os
from app.core.config import DB_PATH

DB_DATA = {"persons": {}}
LAST_DB_MTIME = 0

def load_db():
    global DB_DATA, LAST_DB_MTIME
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
    with open(DB_PATH, 'w') as f:
        json.dump(DB_DATA, f, indent=4)
    global LAST_DB_MTIME
    if os.path.exists(DB_PATH):
        LAST_DB_MTIME = os.path.getmtime(DB_PATH)

def get_db():
    return DB_DATA
