import os
import sys
import argparse

# Add backend directory to PYTHONPATH
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.config import (
    DATA_DIR,
    DB_PATH,
    GALLERY_DIR,
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    is_supabase_enabled,
)
from app.services.storage_service import LocalStorageService, SupabaseStorageService


def migrate_local_to_supabase():
    """
    Safely migrates local photos & database state to Supabase Cloud Storage & PostgreSQL.
    Preserves all original local files on disk.
    """
    print("=" * 65)
    print(" 🚀 WEDDING FACE RECOGNITION SYSTEM - STORAGE MIGRATION TOOL")
    print("=" * 65)

    if not is_supabase_enabled():
        print("\n❌ ERROR: Supabase credentials are not configured in your environment or .env file.")
        print("Required variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY")
        sys.exit(1)

    print(f"\n[1/3] Reading local database from '{DB_PATH}'...")
    local_storage = LocalStorageService()
    supabase_storage = SupabaseStorageService()

    db_data = local_storage.load_database()
    persons_count = len(db_data.get("persons", {}))
    couple_photos_count = len(db_data.get("couple_photos", []))
    print(f"      Loaded {persons_count} registered persons, {couple_photos_count} couple photos.")

    print(f"\n[2/3] Uploading local gallery photos from '{GALLERY_DIR}' to Supabase Storage...")
    uploaded_files_count = 0
    failed_files_count = 0

    if os.path.exists(GALLERY_DIR):
        for root, _, files in os.walk(GALLERY_DIR):
            for file_name in files:
                full_local_path = os.path.join(root, file_name)
                rel_path = os.path.relpath(full_local_path, GALLERY_DIR).replace("\\", "/")
                storage_path = f"gallery/{rel_path}"

                res = supabase_storage.upload_file(full_local_path, storage_path)
                if res:
                    uploaded_files_count += 1
                    print(f"  [✓] Uploaded: {storage_path}")
                else:
                    failed_files_count += 1
                    print(f"  [X] Failed:   {storage_path}")
    else:
        print("      Local gallery directory does not exist or is empty.")

    print(f"\n[3/3] Syncing database metadata into Supabase PostgreSQL tables...")
    save_success = supabase_storage.save_database(db_data)

    print("\n" + "=" * 65)
    if save_success:
        print(f" SUCCESS: Migration completed!")
        print(f" • Uploaded Photos: {uploaded_files_count}")
        print(f" • Failed Uploads:  {failed_files_count}")
        print(f" • Database Synced: Yes")
        print(" • Original Local Files Preserved: Yes")
        print("\nYou can now set 'STORAGE_MODE=supabase' in your .env file!")
    else:
        print(" ❌ WARNING: Photo uploads completed, but database sync returned an error.")
    print("=" * 65)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Migrate local storage data to Supabase.")
    parser.add_argument(
        "--to-supabase",
        action="store_true",
        required=True,
        help="Migrate local photos & metadata to Supabase Cloud Storage & PostgreSQL."
    )
    args = parser.parse_args()

    if args.to_supabase:
        migrate_local_to_supabase()
