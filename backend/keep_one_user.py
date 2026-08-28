#!/usr/bin/env python3
"""
Script to remove all users and photos except one target user for fast testing and easy merging.

Usage:
  python backend/keep_one_user.py [person_id]
"""

import os
import sys
import shutil
import json

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.config import GALLERY_DIR, DB_PATH, is_supabase_enabled
from app.services.supabase_service import (
    get_supabase_client,
    save_db_to_supabase,
    delete_file_from_supabase,
    SUPABASE_STORAGE_BUCKET,
)

def keep_only_one_user(target_pid="person_8c807164"):
    print("==================================================")
    print(f"   KEEPING SINGLE USER: {target_pid}")
    print("==================================================")

    if not os.path.exists(DB_PATH):
        print(f"ERROR: Database file '{DB_PATH}' not found.")
        return

    with open(DB_PATH, "r") as f:
        db = json.load(f)

    persons = db.get("persons", {})
    if target_pid not in persons:
        print(f"ERROR: Person ID '{target_pid}' not found in database.")
        pids = list(persons.keys())
        if pids:
            target_pid = pids[0]
            print(f"Falling back to first available person ID: {target_pid}")
        else:
            return

    # 1. Trim in-memory DB persons to only target_pid
    kept_person_data = persons[target_pid]
    kept_photo_urls = set(kept_person_data.get("photos", []))
    
    db["persons"] = {target_pid: kept_person_data}
    
    # Save trimmed database.json
    with open(DB_PATH, "w") as f:
        json.dump(db, f, indent=4)
    print(f"[+] Updated local 'database.json' to keep only '{target_pid}' ({len(kept_photo_urls)} photos).")

    # 2. Clean local gallery directory
    removed_dirs = 0
    removed_files = 0

    if os.path.exists(GALLERY_DIR):
        for item in os.listdir(GALLERY_DIR):
            item_path = os.path.join(GALLERY_DIR, item)
            if os.path.isdir(item_path):
                if item.startswith("person_") and item != target_pid:
                    shutil.rmtree(item_path)
                    removed_dirs += 1
                elif item == "Group photo":
                    # Remove group photos not referenced by kept person
                    for gfile in os.listdir(item_path):
                        gurl = f"/gallery/Group photo/{gfile}"
                        if gurl not in kept_photo_urls:
                            gfile_path = os.path.join(item_path, gfile)
                            os.remove(gfile_path)
                            removed_files += 1

    print(f"[+] Local gallery cleaned: removed {removed_dirs} user folder(s) and {removed_files} unreferenced group photo(s).")

    # 3. Clean Supabase database & storage if enabled
    if is_supabase_enabled():
        print("[*] Syncing trimmed state to Supabase...")
        client = get_supabase_client()
        if client:
            # Sync DB tables
            save_db_to_supabase(db)
            print("[+] Supabase PostgreSQL tables updated.")

            # List and delete non-target storage files
            try:
                # Delete old person folders in storage
                res = client.storage.from_(SUPABASE_STORAGE_BUCKET).list("gallery")
                if res:
                    for obj in res:
                        name = obj.get("name", "")
                        if name.startswith("person_") and name != target_pid:
                            # list items inside folder
                            sub_res = client.storage.from_(SUPABASE_STORAGE_BUCKET).list(f"gallery/{name}")
                            if sub_res:
                                paths_to_del = [f"gallery/{name}/{s['name']}" for s in sub_res if s.get("name")]
                                client.storage.from_(SUPABASE_STORAGE_BUCKET).remove(paths_to_del)
                    print("[+] Supabase Storage non-target user folders removed.")
            except Exception as se:
                print(f"[!] Warning cleaning Supabase Storage: {se}")

    print("\n==================================================")
    print(f"   CLEANUP COMPLETE: Only '{target_pid}' remains!")
    print("==================================================")

if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else "person_8c807164"
    keep_only_one_user(target)
