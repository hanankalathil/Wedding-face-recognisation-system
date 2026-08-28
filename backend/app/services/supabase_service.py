import os
import mimetypes
from typing import Optional, Union, List, Dict, Any
from app.core.config import (
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_STORAGE_BUCKET,
    is_supabase_enabled,
)

_supabase_client = None

def get_supabase_client():
    global _supabase_client
    if not is_supabase_enabled():
        return None
    if _supabase_client is None:
        from supabase import create_client
        _supabase_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    return _supabase_client

def ensure_bucket_exists(bucket_name: str = SUPABASE_STORAGE_BUCKET) -> bool:
    client = get_supabase_client()
    if not client:
        return False
    try:
        buckets = client.storage.list_buckets()
        bucket_names = [b.name for b in buckets] if buckets else []
        if bucket_name not in bucket_names:
            client.storage.create_bucket(bucket_name, options={"public": True})
        return True
    except Exception as e:
        print(f"[Supabase Storage] Warning ensuring bucket '{bucket_name}': {e}")
        return False

def upload_file_to_supabase(
    file_data: Union[bytes, str],
    storage_path: str,
    content_type: Optional[str] = None
) -> Optional[str]:
    """
    Uploads bytes or a local file path to Supabase Storage at storage_path.
    Returns the storage path or None on error.
    """
    client = get_supabase_client()
    if not client:
        return None
        
    try:
        ensure_bucket_exists()
        normalized_path = storage_path.lstrip("/").replace("\\", "/")
        
        if isinstance(file_data, str):
            with open(file_data, "rb") as f:
                content = f.read()
            if content_type is None:
                content_type = mimetypes.guess_type(file_data)[0] or "image/jpeg"
        else:
            content = file_data
            if content_type is None:
                content_type = "image/jpeg"

        # Upload or overwrite file in bucket
        res = client.storage.from_(SUPABASE_STORAGE_BUCKET).upload(
            path=normalized_path,
            file=content,
            file_options={"content-type": content_type, "upsert": "true"}
        )
        return normalized_path

    except Exception as e:
        print(f"[Supabase Storage] Error uploading file {storage_path}: {e}")
        return None

def download_file_from_supabase(storage_path: str) -> Optional[bytes]:
    """
    Downloads raw file bytes from Supabase Storage.
    """
    client = get_supabase_client()
    if not client:
        return None
        
    try:
        normalized_path = storage_path.lstrip("/").replace("\\", "/")
        data = client.storage.from_(SUPABASE_STORAGE_BUCKET).download(normalized_path)
        return data
    except Exception as e:
        # Avoid spamming log on expected 404
        return None

def delete_file_from_supabase(storage_paths: Union[str, List[str]]) -> bool:
    """
    Deletes one or multiple files from Supabase Storage.
    """
    client = get_supabase_client()
    if not client:
        return False
        
    try:
        if isinstance(storage_paths, str):
            paths = [storage_paths.lstrip("/").replace("\\", "/")]
        else:
            paths = [p.lstrip("/").replace("\\", "/") for p in storage_paths if p]
            
        if not paths:
            return True
            
        client.storage.from_(SUPABASE_STORAGE_BUCKET).remove(paths)
        return True
    except Exception as e:
        print(f"[Supabase Storage] Error deleting paths {storage_paths}: {e}")
        return False

def load_db_from_supabase() -> Dict[str, Any]:
    """
    Loads full database state from Supabase PostgreSQL tables into the in-memory dict format.
    """
    client = get_supabase_client()
    if not client:
        return {}

    db_data = {
        "persons": {},
        "couple_photos": [],
        "couple_categories": ["Ceremony", "Reception", "Portraits", "Candid"],
        "couple_settings": {"couple_name": "Sophia & James"}
    }

    try:
        # 1. Fetch Persons
        persons_res = client.table("persons").select("*").execute()
        persons_rows = persons_res.data if persons_res and persons_res.data else []

        # 2. Fetch Person-Photo associations
        pp_res = client.table("person_photos").select("*").execute()
        pp_rows = pp_res.data if pp_res and pp_res.data else []
        
        person_photos_map = {}
        for row in pp_rows:
            pid = row["person_id"]
            purl = row["photo_url"]
            if pid not in person_photos_map:
                person_photos_map[pid] = []
            person_photos_map[pid].append(purl)

        for prow in persons_rows:
            pid = prow["id"]
            emb = prow.get("representative_embedding")
            if isinstance(emb, str):
                import json
                emb = json.loads(emb)
            db_data["persons"][pid] = {
                "representative_embedding": emb or [],
                "photos": person_photos_map.get(pid, [])
            }

        # 3. Fetch Couple Photos
        cp_res = client.table("couple_photos").select("*").execute()
        if cp_res and cp_res.data:
            db_data["couple_photos"] = [
                {
                    "id": item["id"],
                    "filename": item["filename"],
                    "category": item["category"],
                    "url": item["url"],
                    "path": item["path"],
                    "uploaded_at": item.get("uploaded_at", "")
                }
                for item in cp_res.data
            ]

        # 4. Fetch Couple Categories
        cat_res = client.table("couple_categories").select("*").execute()
        if cat_res and cat_res.data:
            sorted_cats = sorted(cat_res.data, key=lambda x: x.get("sort_order", 0))
            db_data["couple_categories"] = [c["name"] for c in sorted_cats]

        # 5. Fetch Couple Settings
        cs_res = client.table("couple_settings").select("*").execute()
        if cs_res and cs_res.data:
            settings_dict = {}
            for item in cs_res.data:
                k = item["key"]
                v = item["value"]
                if isinstance(v, dict) and k in v:
                    settings_dict[k] = v[k]
                elif isinstance(v, dict):
                    settings_dict.update(v)
                else:
                    settings_dict[k] = v
            if settings_dict:
                db_data["couple_settings"] = settings_dict

        return db_data
    except Exception as e:
        print(f"[Supabase DB] Error loading database: {e}")
        return db_data

def save_db_to_supabase(db_data: Dict[str, Any]) -> bool:
    """
    Saves in-memory DB snapshot into Supabase PostgreSQL tables.
    """
    client = get_supabase_client()
    if not client:
        return False

    try:
        # 1. Save persons & person_photos
        persons = db_data.get("persons", {})
        for pid, pdata in persons.items():
            emb = pdata.get("representative_embedding", [])
            client.table("persons").upsert({
                "id": pid,
                "representative_embedding": emb
            }).execute()

            # Replace person_photos for this pid
            photos = pdata.get("photos", [])
            client.table("person_photos").delete().eq("person_id", pid).execute()
            if photos:
                rows = [{"person_id": pid, "photo_url": purl} for purl in photos]
                client.table("person_photos").insert(rows).execute()

        # Delete any persons in DB that are no longer in db_data
        existing_pids = set(persons.keys())
        all_p_res = client.table("persons").select("id").execute()
        if all_p_res and all_p_res.data:
            db_pids = {r["id"] for r in all_p_res.data}
            pids_to_delete = list(db_pids - existing_pids)
            for dpid in pids_to_delete:
                client.table("persons").delete().eq("id", dpid).execute()

        # 2. Save couple_photos
        cp_list = db_data.get("couple_photos", [])
        client.table("couple_photos").delete().neq("id", "___dummy___").execute()
        if cp_list:
            cp_rows = []
            for item in cp_list:
                cp_rows.append({
                    "id": item["id"],
                    "filename": item["filename"],
                    "category": item["category"],
                    "url": item["url"],
                    "path": item["path"],
                    "storage_path": f"gallery/{item['path']}",
                    "uploaded_at": item.get("uploaded_at")
                })
            client.table("couple_photos").upsert(cp_rows).execute()

        # 3. Save couple_categories
        cats = db_data.get("couple_categories", [])
        client.table("couple_categories").delete().neq("name", "___dummy___").execute()
        if cats:
            cat_rows = [{"name": name, "sort_order": idx} for idx, name in enumerate(cats)]
            client.table("couple_categories").upsert(cat_rows).execute()

        # 4. Save couple_settings
        cs = db_data.get("couple_settings", {"couple_name": "Sophia & James"})
        for k, v in cs.items():
            client.table("couple_settings").upsert({
                "key": k,
                "value": {k: v} if not isinstance(v, dict) else v
            }).execute()

        return True
    except Exception as e:
        print(f"[Supabase DB] Error saving database: {e}")
        return False
