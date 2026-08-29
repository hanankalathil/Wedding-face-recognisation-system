import os
import json
import copy
import mimetypes
import threading
from abc import ABC, abstractmethod
from typing import Optional, Union, List, Dict, Any

from app.core.config import (
    DATA_DIR,
    DB_PATH,
    GALLERY_DIR,
    STORAGE_MODE,
    get_storage_mode,
    is_supabase_enabled,
)
from app.services.supabase_service import (
    upload_file_to_supabase,
    download_file_from_supabase,
    delete_file_from_supabase,
    load_db_from_supabase,
    save_db_to_supabase,
)


class BaseStorageService(ABC):
    """Abstract Base Class for Storage Services."""

    @abstractmethod
    def upload_file(
        self,
        file_data: Union[bytes, str],
        storage_path: str,
        content_type: Optional[str] = None
    ) -> Optional[str]:
        pass

    @abstractmethod
    def download_file(self, storage_path: str) -> Optional[bytes]:
        pass

    @abstractmethod
    def delete_file(self, storage_paths: Union[str, List[str]]) -> bool:
        pass

    @abstractmethod
    def load_database(self) -> Dict[str, Any]:
        pass

    @abstractmethod
    def save_database(self, db_data: Dict[str, Any]) -> bool:
        pass


class LocalStorageService(BaseStorageService):
    """
    High-performance Local Storage Service.
    Stores photos on the local Windows disk and database state in database.json.
    Zero network requests to external cloud services.
    """

    def upload_file(
        self,
        file_data: Union[bytes, str],
        storage_path: str,
        content_type: Optional[str] = None
    ) -> Optional[str]:
        try:
            normalized_path = storage_path.lstrip("/").replace("\\", "/")
            if normalized_path.startswith("gallery/"):
                normalized_path = normalized_path[len("gallery/"):]

            target_path = os.path.normpath(os.path.join(GALLERY_DIR, normalized_path))
            os.makedirs(os.path.dirname(target_path), exist_ok=True)

            if isinstance(file_data, str):
                if os.path.normpath(file_data) != target_path:
                    with open(file_data, "rb") as f_in:
                        content = f_in.read()
                    with open(target_path, "wb") as f_out:
                        f_out.write(content)
            else:
                with open(target_path, "wb") as f_out:
                    f_out.write(file_data)

            return normalized_path
        except Exception as e:
            print(f"[LocalStorage] Error uploading file '{storage_path}': {e}")
            return None

    def download_file(self, storage_path: str) -> Optional[bytes]:
        try:
            normalized_path = storage_path.lstrip("/").replace("\\", "/")
            if normalized_path.startswith("gallery/"):
                normalized_path = normalized_path[len("gallery/"):]

            target_path = os.path.normpath(os.path.join(GALLERY_DIR, normalized_path))
            if os.path.exists(target_path) and os.path.isfile(target_path):
                with open(target_path, "rb") as f:
                    return f.read()
            return None
        except Exception as e:
            print(f"[LocalStorage] Error downloading file '{storage_path}': {e}")
            return None

    def delete_file(self, storage_paths: Union[str, List[str]]) -> bool:
        try:
            if isinstance(storage_paths, str):
                paths = [storage_paths]
            else:
                paths = storage_paths

            for p in paths:
                if not p:
                    continue
                normalized_path = p.lstrip("/").replace("\\", "/")
                if normalized_path.startswith("gallery/"):
                    normalized_path = normalized_path[len("gallery/"):]

                target_path = os.path.normpath(os.path.join(GALLERY_DIR, normalized_path))
                if os.path.exists(target_path) and os.path.isfile(target_path):
                    os.remove(target_path)

            return True
        except Exception as e:
            print(f"[LocalStorage] Error deleting files: {e}")
            return False

    def load_database(self) -> Dict[str, Any]:
        if os.path.exists(DB_PATH):
            try:
                with open(DB_PATH, "r", encoding="utf-8") as f:
                    data = json.load(f)
                if "couple_categories" not in data:
                    data["couple_categories"] = ["Ceremony", "Reception", "Portraits", "Candid"]
                if "couple_settings" not in data:
                    data["couple_settings"] = {"couple_name": "Sophia & James"}
                return data
            except Exception as e:
                print(f"[LocalStorage] Error reading local database.json: {e}")

        return {
            "persons": {},
            "couple_photos": [],
            "couple_categories": ["Ceremony", "Reception", "Portraits", "Candid"],
            "couple_settings": {"couple_name": "Sophia & James"}
        }

    def save_database(self, db_data: Dict[str, Any]) -> bool:
        try:
            os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
            temp_path = f"{DB_PATH}.tmp"
            snapshot = copy.deepcopy(db_data)
            with open(temp_path, "w", encoding="utf-8") as f:
                json.dump(snapshot, f, indent=4)
            os.replace(temp_path, DB_PATH)
            return True
        except Exception as e:
            print(f"[LocalStorage] Error saving local database.json: {e}")
            return False


class SupabaseStorageService(BaseStorageService):
    """
    Cloud Supabase Storage Service.
    Stores photos in Supabase Storage buckets and metadata in Supabase PostgreSQL tables.
    """

    def _verify_supabase(self):
        if not is_supabase_enabled():
            raise RuntimeError(
                "STORAGE_MODE is set to 'supabase', but SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing from environment."
            )

    def upload_file(
        self,
        file_data: Union[bytes, str],
        storage_path: str,
        content_type: Optional[str] = None
    ) -> Optional[str]:
        self._verify_supabase()
        normalized_path = storage_path.lstrip("/").replace("\\", "/")
        if not normalized_path.startswith("gallery/"):
            full_storage_path = f"gallery/{normalized_path}"
        else:
            full_storage_path = normalized_path

        # Also save locally for instant disk caching
        try:
            rel_path = full_storage_path[len("gallery/"):] if full_storage_path.startswith("gallery/") else full_storage_path
            local_target = os.path.normpath(os.path.join(GALLERY_DIR, rel_path))
            os.makedirs(os.path.dirname(local_target), exist_ok=True)
            if isinstance(file_data, bytes):
                with open(local_target, "wb") as f:
                    f.write(file_data)
            elif isinstance(file_data, str) and os.path.exists(file_data) and os.path.normpath(file_data) != local_target:
                with open(file_data, "rb") as fin, open(local_target, "wb") as fout:
                    fout.write(fin.read())
        except Exception as e:
            print(f"[SupabaseStorage] Warning caching local file copy: {e}")

        return upload_file_to_supabase(file_data, full_storage_path, content_type)

    def download_file(self, storage_path: str) -> Optional[bytes]:
        self._verify_supabase()
        normalized_path = storage_path.lstrip("/").replace("\\", "/")
        if not normalized_path.startswith("gallery/"):
            full_storage_path = f"gallery/{normalized_path}"
            rel_path = normalized_path
        else:
            full_storage_path = normalized_path
            rel_path = normalized_path[len("gallery/"):]

        # Fast local disk cache check
        local_target = os.path.normpath(os.path.join(GALLERY_DIR, rel_path))
        if os.path.exists(local_target) and os.path.isfile(local_target):
            with open(local_target, "rb") as f:
                return f.read()

        # Download from Supabase
        data = download_file_from_supabase(full_storage_path)
        if data:
            try:
                os.makedirs(os.path.dirname(local_target), exist_ok=True)
                with open(local_target, "wb") as f:
                    f.write(data)
            except Exception as e:
                print(f"[SupabaseStorage] Warning writing downloaded file cache: {e}")
        return data

    def delete_file(self, storage_paths: Union[str, List[str]]) -> bool:
        self._verify_supabase()
        if isinstance(storage_paths, str):
            paths = [storage_paths]
        else:
            paths = storage_paths

        full_paths = []
        for p in paths:
            if not p:
                continue
            np = p.lstrip("/").replace("\\", "/")
            if not np.startswith("gallery/"):
                full_paths.append(f"gallery/{np}")
            else:
                full_paths.append(np)

            # Also remove local cache file
            rel_path = np[len("gallery/"):] if np.startswith("gallery/") else np
            local_target = os.path.normpath(os.path.join(GALLERY_DIR, rel_path))
            if os.path.exists(local_target):
                try:
                    os.remove(local_target)
                except Exception:
                    pass

        return delete_file_from_supabase(full_paths)

    def load_database(self) -> Dict[str, Any]:
        self._verify_supabase()
        return load_db_from_supabase()

    def save_database(self, db_data: Dict[str, Any]) -> bool:
        self._verify_supabase()
        # Also save to local JSON file as backup
        try:
            os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
            temp_path = f"{DB_PATH}.tmp"
            with open(temp_path, "w", encoding="utf-8") as f:
                json.dump(db_data, f, indent=4)
            os.replace(temp_path, DB_PATH)
        except Exception as e:
            print(f"[SupabaseStorage] Warning saving local database backup: {e}")

        return save_db_to_supabase(db_data)


_storage_service_instance = None
_instance_mode = None

def get_storage_service() -> BaseStorageService:
    """
    Factory function. Returns singleton instance of LocalStorageService or SupabaseStorageService
    based on active STORAGE_MODE setting.
    """
    global _storage_service_instance, _instance_mode
    current_mode = get_storage_mode()

    if _storage_service_instance is None or _instance_mode != current_mode:
        _instance_mode = current_mode
        if current_mode == "supabase":
            _storage_service_instance = SupabaseStorageService()
            print("[StorageService] Initialized SUPABASE storage mode.")
        else:
            _storage_service_instance = LocalStorageService()
            print("[StorageService] Initialized LOCAL storage mode.")

    return _storage_service_instance
