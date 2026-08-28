#!/usr/bin/env python3
"""
Migration script to upload existing local gallery photos and database.json data to Supabase.

Usage:
  python backend/migrate_to_supabase.py

Environment Variables Required:
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
  SUPABASE_STORAGE_BUCKET (optional, defaults to 'wedding-gallery')
"""

import os
import sys
import json

# Add backend directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.config import (
    GALLERY_DIR,
    DB_PATH,
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_STORAGE_BUCKET,
    is_supabase_enabled,
)
from app.services.supabase_service import (
    get_supabase_client,
    ensure_bucket_exists,
    upload_file_to_supabase,
    save_db_to_supabase,
)

def run_migration():
    print("==================================================")
    print("   SUPABASE MIGRATION TOOL - WEDDING SYSTEM")
    print("==================================================")

    if not is_supabase_enabled():
        print("ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment variables.")
        print("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running this script.")
        sys.exit(1)

    print(f"[*] Supabase Target URL: {SUPABASE_URL}")
    print(f"[*] Storage Bucket: {SUPABASE_STORAGE_BUCKET}")

    client = get_supabase_client()
    if not client:
        print("ERROR: Failed to initialize Supabase client.")
        sys.exit(1)

    # 1. Ensure bucket exists
    print("\n[1/3] Ensuring Supabase Storage bucket exists...")
    if ensure_bucket_exists():
        print(f"  [+] Bucket '{SUPABASE_STORAGE_BUCKET}' is ready.")
    else:
        print(f"  [!] Warning: Could not verify bucket '{SUPABASE_STORAGE_BUCKET}'. Proceeding anyway...")

    # 2. Migrate Gallery Photos to Supabase Storage
    print("\n[2/3] Uploading local gallery photos to Supabase Storage...")
    uploaded_count = 0
    skipped_count = 0
    error_count = 0

    if os.path.exists(GALLERY_DIR):
        for root, _, files in os.walk(GALLERY_DIR):
            for file in files:
                file_path = os.path.join(root, file)
                rel_path = os.path.relpath(file_path, GALLERY_DIR).replace("\\", "/")
                storage_path = f"gallery/{rel_path}"

                try:
                    res = upload_file_to_supabase(file_path, storage_path)
                    if res:
                        uploaded_count += 1
                        print(f"  [+] Uploaded: {storage_path}")
                    else:
                        error_count += 1
                        print(f"  [-] Failed: {storage_path}")
                except Exception as e:
                    error_count += 1
                    print(f"  [-] Error uploading {storage_path}: {e}")
    else:
        print(f"  [!] Local gallery directory '{GALLERY_DIR}' not found.")

    print(f"  -> Upload Complete: {uploaded_count} uploaded, {skipped_count} skipped, {error_count} errors.")

    # 3. Migrate database.json to Supabase PostgreSQL
    print("\n[3/3] Migrating database.json metadata to Supabase PostgreSQL...")
    if os.path.exists(DB_PATH):
        try:
            with open(DB_PATH, "r") as f:
                db_data = json.load(f)
            
            persons_count = len(db_data.get("persons", {}))
            couple_photos_count = len(db_data.get("couple_photos", []))
            categories_count = len(db_data.get("couple_categories", []))

            print(f"  Found {persons_count} person(s), {couple_photos_count} couple photo(s), {categories_count} category(ies).")

            success = save_db_to_supabase(db_data)
            if success:
                print("  [+] Database metadata successfully saved to Supabase PostgreSQL!")
            else:
                print("  [-] Error saving database metadata to Supabase.")
        except Exception as e:
            print(f"  [-] Error reading or migrating database.json: {e}")
    else:
        print(f"  [!] Database file '{DB_PATH}' not found.")

    print("\n==================================================")
    print("   SUPABASE MIGRATION COMPLETED")
    print("==================================================")

if __name__ == "__main__":
    run_migration()
