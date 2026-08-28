import os
import uuid
import shutil
import hashlib
import zipfile
import io
from datetime import datetime
import cv2
import numpy as np
from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks, Form
from fastapi.responses import StreamingResponse, FileResponse
from pydantic import BaseModel
from app.core.config import GALLERY_DIR, COUPLE_PHOTO_CATEGORIES, is_supabase_enabled
from app.services.db_service import load_db, save_db, get_db
from app.services.face_service import process_image_background
from app.services.supabase_service import (
    upload_file_to_supabase,
    delete_file_from_supabase,
    download_file_from_supabase,
)


# Admin API router module - unique photos fix
router = APIRouter()



@router.get("/download-zip")
async def download_photos_zip(person_id: str = None, category: str = None):
    """Generates and streams a ZIP file of gallery photos."""
    try:
        memory_file = io.BytesIO()
        with zipfile.ZipFile(memory_file, 'w', zipfile.ZIP_DEFLATED) as zf:
            if person_id:
                load_db()
                db = get_db()
                pdata = db.get("persons", {}).get(person_id, {})
                photo_urls = pdata.get("photos", [])
                written_files = set()
                
                for photo_url in photo_urls:
                    fname = os.path.basename(photo_url)
                    if fname == "avatar.jpg" or fname in written_files:
                        continue
                    rel_path = photo_url.replace("/gallery/", "")
                    fp = os.path.normpath(os.path.join(GALLERY_DIR, rel_path))
                    if not os.path.exists(fp) and is_supabase_enabled():
                        data = download_file_from_supabase(f"gallery/{rel_path}")
                        if data:
                            os.makedirs(os.path.dirname(fp), exist_ok=True)
                            with open(fp, "wb") as f:
                                f.write(data)
                    if os.path.exists(fp):
                        zf.write(fp, arcname=f"{person_id}/{fname}")
                        written_files.add(fname)

                        
                target_dir = os.path.join(GALLERY_DIR, person_id)
                if os.path.exists(target_dir):
                    for file in os.listdir(target_dir):
                        if file.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')) and file != "avatar.jpg" and file not in written_files:
                            fp = os.path.join(target_dir, file)
                            zf.write(fp, arcname=f"{person_id}/{file}")
                            written_files.add(file)

            elif category:
                target_dir = os.path.join(GALLERY_DIR, "couple_photos", category.lower())
                if os.path.exists(target_dir):
                    for file in os.listdir(target_dir):
                        if file.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')) and file != "avatar.jpg":
                            fp = os.path.join(target_dir, file)
                            zf.write(fp, arcname=f"{category}/{file}")
            else:
                for root, _, files in os.walk(GALLERY_DIR):
                    if ".thumbnails" in root:
                        continue
                    for file in files:
                        if file.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')) and file != "avatar.jpg":
                            fp = os.path.join(root, file)
                            rel = os.path.relpath(fp, GALLERY_DIR)
                            zf.write(fp, arcname=rel)

        memory_file.seek(0)
        zip_name = f"wedding_photos_{person_id or category or 'all'}.zip"
        return StreamingResponse(
            memory_file,
            media_type="application/zip",
            headers={"Content-Disposition": f"attachment; filename={zip_name}"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class DeletePhotoRequest(BaseModel):
    path: str

class DeleteUserRequest(BaseModel):
    user_id: str

class AddCategoryRequest(BaseModel):
    category: str

class DeleteCategoryRequest(BaseModel):
    category: str

class EditCategoryRequest(BaseModel):
    old_name: str
    new_name: str

class CoupleSettingsRequest(BaseModel):
    couple_name: str

class RenamePhotoRequest(BaseModel):
    path: str
    new_name: str

class RenameUserRequest(BaseModel):
    old_user_id: str
    new_user_id: str

@router.post("/upload")
async def admin_upload_image(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    try:
        group_photos_dir = os.path.join(GALLERY_DIR, "Group photo")
        unrecognized_dir = os.path.join(GALLERY_DIR, "unrecognized")
        os.makedirs(GALLERY_DIR, exist_ok=True)
        os.makedirs(group_photos_dir, exist_ok=True)
        os.makedirs(unrecognized_dir, exist_ok=True)
            
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
            raise HTTPException(status_code=400, detail="Invalid or corrupted image file")

        original_name = file.filename
        final_filename = f"{uuid.uuid4().hex[:8]}_{original_name}"
        
        background_tasks.add_task(process_image_background, img, final_filename, original_name)
        
        return {"status": "success", "message": f"Successfully uploaded {file.filename}, processing in background"}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/photos")
async def get_all_photos():
    photos = []
    seen_real_names = set()
    if os.path.exists(GALLERY_DIR):
        for root, _, files in os.walk(GALLERY_DIR):
            for file in files:
                if file.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')) and file != "avatar.jpg":
                    real_name = file.split('_', 1)[-1] if '_' in file else file
                    if real_name in seen_real_names:
                        continue
                    seen_real_names.add(real_name)
                    rel_dir = os.path.relpath(root, GALLERY_DIR)
                    if rel_dir == ".":
                        rel_path = file
                    else:
                        rel_path = f"{rel_dir}/{file}".replace("\\", "/")
                    photos.append({
                        "url": f"/gallery/{rel_path}",
                        "filename": file,
                        "path": rel_path
                    })
    photos.sort(key=lambda p: os.path.getmtime(os.path.join(GALLERY_DIR, p["path"])) if os.path.exists(os.path.join(GALLERY_DIR, p["path"])) else 0, reverse=True)
    return {"status": "success", "photos": photos}




def _is_intentional_copy(photos_list):
    filenames = {p.get("filename") or os.path.basename(p.get("path", "")) for p in photos_list}
    return len(filenames) == 1

@router.get("/photos/duplicates")
async def find_duplicates():
    try:
        hash_groups = {}
        if os.path.exists(GALLERY_DIR):
            for root, _, files in os.walk(GALLERY_DIR):
                for file in files:
                    if file.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')) and file != "avatar.jpg":
                        file_path = os.path.join(root, file)
                        rel_dir = os.path.relpath(root, GALLERY_DIR)
                        if rel_dir == ".":
                            rel_path = file
                        else:
                            rel_path = f"{rel_dir}/{file}".replace("\\", "/")
                        
                        with open(file_path, 'rb') as f:
                            file_hash = hashlib.md5(f.read()).hexdigest()
                            
                        photo_info = {
                            "url": f"/gallery/{rel_path}",
                            "filename": file,
                            "path": rel_path
                        }
                        
                        if file_hash not in hash_groups:
                            hash_groups[file_hash] = []
                        hash_groups[file_hash].append(photo_info)

        duplicates = []
        groups = []
        total_duplicates_count = 0

        for f_hash, photos_list in hash_groups.items():
            if len(photos_list) > 1:
                if _is_intentional_copy(photos_list):
                    continue
                original = photos_list[0]
                dups = photos_list[1:]
                total_duplicates_count += len(dups)
                
                groups.append({
                    "original": original,
                    "duplicates": dups,
                    "total_copies": len(photos_list)
                })

                for dup in dups:
                    duplicates.append({
                        "original": original,
                        "duplicate": dup
                    })
                            
        return {
            "status": "success", 
            "duplicates": duplicates,
            "groups": groups,
            "total_duplicates_count": total_duplicates_count
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/photos/delete-duplicates-bulk")
async def delete_duplicates_bulk():
    try:
        hash_groups = {}
        if os.path.exists(GALLERY_DIR):
            for root, _, files in os.walk(GALLERY_DIR):
                for file in files:
                    if file.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')) and file != "avatar.jpg":
                        file_path = os.path.join(root, file)
                        rel_dir = os.path.relpath(root, GALLERY_DIR)
                        if rel_dir == ".":
                            rel_path = file
                        else:
                            rel_path = f"{rel_dir}/{file}".replace("\\", "/")
                        
                        with open(file_path, 'rb') as f:
                            file_hash = hashlib.md5(f.read()).hexdigest()
                            
                        photo_info = {
                            "file_path": file_path,
                            "rel_path": rel_path,
                            "photo_url": f"/gallery/{rel_path.replace(os.sep, '/')}",
                            "filename": file
                        }
                        
                        if file_hash not in hash_groups:
                            hash_groups[file_hash] = []
                        hash_groups[file_hash].append(photo_info)

        deleted_paths = []
        deleted_urls = []

        for f_hash, photos_list in hash_groups.items():
            if len(photos_list) > 1:
                if _is_intentional_copy(photos_list):
                    continue
                for dup in photos_list[1:]:
                    try:
                        if os.path.exists(dup["file_path"]):
                            os.remove(dup["file_path"])
                            deleted_paths.append(dup["rel_path"])
                            deleted_urls.append(dup["photo_url"])
                    except Exception as err:
                        print(f"Error deleting file {dup['file_path']}: {err}")

        if deleted_urls:
            load_db()
            db = get_db()
            for pid, pdata in list(db.get("persons", {}).items()):
                pdata["photos"] = [u for u in pdata.get("photos", []) if u not in deleted_urls]
            save_db()

        return {
            "status": "success",
            "message": f"Successfully deleted {len(deleted_paths)} duplicate photos.",
            "deleted_count": len(deleted_paths),
            "deleted_paths": deleted_paths
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/all-users")
async def get_all_users():

    try:
        load_db()
        db = get_db()
        persons = db.get("persons", {})
        users_list = []
        
        for pid, pdata in persons.items():
            raw_photos = pdata.get("photos", [])
            seen_filenames = set()
            unique_photos = []
            
            for photo_url in raw_photos:
                fname = os.path.basename(photo_url)
                if fname == "avatar.jpg":
                    continue
                if fname not in seen_filenames:
                    seen_filenames.add(fname)
                    unique_photos.append(photo_url)
                    
            avatar_disk_path = os.path.join(GALLERY_DIR, pid, "avatar.jpg")
            if os.path.exists(avatar_disk_path):
                avatar_url = f"/gallery/{pid}/avatar.jpg"
            elif unique_photos:
                avatar_url = unique_photos[0]
            else:
                avatar_url = ""
                
            users_list.append({
                "id": pid,
                "avatar_url": avatar_url,
                "photo_count": len(unique_photos),
                "photos": unique_photos
            })
            
        return {"status": "success", "users": users_list}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/users/generate-avatars")
async def generate_avatars_endpoint():
    try:
        from app.services.face_service import generate_avatars_for_all_persons
        count = generate_avatars_for_all_persons(force=True)
        return {"status": "success", "message": f"Successfully generated avatars for {count} person(s).", "count": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.post("/photos/sync-group-photos")
async def sync_group_photos_endpoint():
    try:
        from app.services.face_service import sync_group_photos_to_personal_folders
        copied_count = sync_group_photos_to_personal_folders()
        return {
            "status": "success",
            "message": f"Successfully synced group photos into personal folders. Copied/verified {copied_count} photo(s)."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/photos/delete")
async def delete_photo(req: DeletePhotoRequest):
    try:
        file_path = os.path.normpath(os.path.join(GALLERY_DIR, req.path))
        if not file_path.startswith(os.path.abspath(GALLERY_DIR)) and not file_path.startswith(GALLERY_DIR):
             raise HTTPException(status_code=400, detail="Invalid path")
             
        if os.path.exists(file_path):
            os.remove(file_path)

        if is_supabase_enabled():
            delete_file_from_supabase(f"gallery/{req.path.replace(os.sep, '/')}")
            
        load_db()
        db = get_db()
        photo_url = f"/gallery/{req.path.replace(os.sep, '/')}"
        for pid, pdata in list(db.get("persons", {}).items()):
            if photo_url in pdata["photos"]:
                pdata["photos"].remove(photo_url)
        save_db()
        
        return {"status": "success", "message": "Photo deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/users/delete")
async def delete_user(req: DeleteUserRequest):
    try:
        user_id = req.user_id
        if ".." in user_id or "/" in user_id or "\\" in user_id:
            raise HTTPException(status_code=400, detail="Invalid user_id")
            
        user_dir = os.path.join(GALLERY_DIR, user_id)
        if os.path.exists(user_dir):
            shutil.rmtree(user_dir)
            
        load_db()
        db = get_db()
        if user_id in db.get("persons", {}):
            pdata = db["persons"].pop(user_id)
            if is_supabase_enabled():
                for purl in pdata.get("photos", []):
                    rel = purl.replace("/gallery/", "")
                    delete_file_from_supabase(f"gallery/{rel}")
                delete_file_from_supabase(f"gallery/{user_id}/avatar.jpg")
        save_db()
        
        return {"status": "success", "message": f"User {user_id} deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/couple-photos/upload")
async def upload_couple_photo(file: UploadFile = File(...), category: str = Form(...)):
    try:
        # Check category dynamically from DB
        load_db()
        db = get_db()
        categories = db.get("couple_categories", [])
        
        valid_categories = [c.lower() for c in categories]
        normalized_cat = category.lower()
        if normalized_cat not in valid_categories:
            raise HTTPException(status_code=400, detail=f"Invalid category. Must be one of: {', '.join(categories)}")

        # Create dir
        dest_dir = os.path.join(GALLERY_DIR, "couple_photos", normalized_cat)
        os.makedirs(dest_dir, exist_ok=True)

        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            raise HTTPException(status_code=400, detail="Invalid or corrupted image file")

        # Save image
        orig_name = file.filename
        unique_id = uuid.uuid4().hex[:8]
        filename = f"{unique_id}_{orig_name}"
        file_path = os.path.join(dest_dir, filename)
        
        # Save physical file
        cv2.imwrite(file_path, img)

        # Database path
        rel_path = f"couple_photos/{normalized_cat}/{filename}"
        photo_url = f"/gallery/{rel_path}"

        if is_supabase_enabled():
            upload_file_to_supabase(file_path, f"gallery/{rel_path}")

        load_db()
        db = get_db()
        if "couple_photos" not in db:
            db["couple_photos"] = []

        new_photo = {
            "id": f"cp_{unique_id}",
            "filename": orig_name,
            "category": normalized_cat,
            "url": photo_url,
            "path": rel_path,
            "uploaded_at": datetime.now().isoformat()
        }
        db["couple_photos"].append(new_photo)
        save_db()

        return {"status": "success", "photo": new_photo}
    except HTTPException as he:
        raise he
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/couple-photos")
async def get_couple_photos():
    load_db()
    db = get_db()
    photos = db.get("couple_photos", [])
    # Filter to only return photos that exist on disk or Supabase
    existing_photos = []
    updated = False
    for p in photos:
        disk_path = os.path.join(GALLERY_DIR, p["path"])
        if os.path.exists(disk_path) or is_supabase_enabled():
            existing_photos.append(p)
        else:
            updated = True
    
    if updated:
        db["couple_photos"] = existing_photos
        save_db()
        
    return {"status": "success", "photos": existing_photos}

@router.post("/couple-photos/delete")
async def delete_couple_photo(req: DeletePhotoRequest):
    try:
        file_path = os.path.normpath(os.path.join(GALLERY_DIR, req.path))
        if not file_path.startswith(os.path.abspath(GALLERY_DIR)) and not file_path.startswith(GALLERY_DIR):
            raise HTTPException(status_code=400, detail="Invalid path")

        if os.path.exists(file_path):
            os.remove(file_path)

        if is_supabase_enabled():
            delete_file_from_supabase(f"gallery/{req.path.replace(os.sep, '/')}")

        load_db()
        db = get_db()
        if "couple_photos" in db:
            db["couple_photos"] = [p for p in db["couple_photos"] if p["path"] != req.path]
        save_db()

        return {"status": "success", "message": "Couple photo deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/categories")
async def get_categories():
    load_db()
    db = get_db()
    return {"status": "success", "categories": db.get("couple_categories", [])}

@router.post("/categories/add")
async def add_category(req: AddCategoryRequest):
    try:
        load_db()
        db = get_db()
        categories = db.get("couple_categories", [])
        
        cat_name = req.category.strip()
        if not cat_name:
            raise HTTPException(status_code=400, detail="Category name cannot be empty")
            
        if cat_name.lower() in [c.lower() for c in categories]:
            raise HTTPException(status_code=400, detail=f"Category '{cat_name}' already exists")
            
        categories.append(cat_name)
        db["couple_categories"] = categories
        save_db()
        return {"status": "success", "categories": categories}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/categories/delete")
async def delete_category(req: DeleteCategoryRequest):
    try:
        load_db()
        db = get_db()
        categories = db.get("couple_categories", [])
        cat_name = req.category.strip()
        
        if cat_name not in categories:
            raise HTTPException(status_code=404, detail="Category not found")
            
        categories.remove(cat_name)
        db["couple_categories"] = categories
        
        # Clean up photos inside this category
        normalized_cat = cat_name.lower()
        cat_dir = os.path.join(GALLERY_DIR, "couple_photos", normalized_cat)
        if os.path.exists(cat_dir):
            shutil.rmtree(cat_dir)
            
        if "couple_photos" in db:
            db["couple_photos"] = [p for p in db["couple_photos"] if p["category"] != normalized_cat]
            
        save_db()
        return {"status": "success", "categories": categories}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/categories/edit")
async def edit_category(req: EditCategoryRequest):
    try:
        load_db()
        db = get_db()
        categories = db.get("couple_categories", [])
        
        old_name = req.old_name.strip()
        new_name = req.new_name.strip()
        
        if not new_name:
            raise HTTPException(status_code=400, detail="New category name cannot be empty")
            
        if old_name not in categories:
            raise HTTPException(status_code=404, detail="Original category not found")
            
        if new_name.lower() != old_name.lower() and new_name.lower() in [c.lower() for c in categories]:
            raise HTTPException(status_code=400, detail=f"Category '{new_name}' already exists")
            
        idx = categories.index(old_name)
        categories[idx] = new_name
        db["couple_categories"] = categories
        
        old_normalized = old_name.lower()
        new_normalized = new_name.lower()
        
        # Rename physical directory on disk
        old_dir = os.path.join(GALLERY_DIR, "couple_photos", old_normalized)
        new_dir = os.path.join(GALLERY_DIR, "couple_photos", new_normalized)
        
        if os.path.exists(old_dir):
            if os.path.exists(new_dir):
                for item in os.listdir(old_dir):
                    shutil.move(os.path.join(old_dir, item), os.path.join(new_dir, item))
                shutil.rmtree(old_dir)
            else:
                os.rename(old_dir, new_dir)
                
        # Update DB photo links
        if "couple_photos" in db:
            for p in db["couple_photos"]:
                if p["category"] == old_normalized:
                    p["category"] = new_normalized
                    filename = os.path.basename(p["path"])
                    p["path"] = f"couple_photos/{new_normalized}/{filename}"
                    p["url"] = f"/gallery/couple_photos/{new_normalized}/{filename}"
                    
        save_db()
        return {"status": "success", "categories": categories}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/couple-settings")
async def get_couple_settings():
    load_db()
    db = get_db()
    settings = db.get("couple_settings", {"couple_name": "Sophia & James"})
    return {"status": "success", "settings": settings}

@router.post("/couple-settings")
async def update_couple_settings(req: CoupleSettingsRequest):
    try:
        load_db()
        db = get_db()
        db["couple_settings"] = {"couple_name": req.couple_name.strip()}
        save_db()
        return {"status": "success", "settings": db["couple_settings"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class WifiSettingsRequest(BaseModel):
    ftp_enabled: bool = None
    ftp_port: int = None
    ftp_username: str = None
    ftp_password: str = None
    watcher_enabled: bool = None
    watch_folder: str = None

class WifiControlRequest(BaseModel):
    action: str

@router.get("/wifi/status")
async def get_wifi_status_endpoint():
    try:
        from app.services import wifi_service
        return wifi_service.get_wifi_status()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/wifi/settings")
async def update_wifi_settings_endpoint(req: WifiSettingsRequest):
    try:
        from app.services import wifi_service
        # Filter out None values
        settings_dict = {k: v for k, v in req.model_dump().items() if v is not None}
        return wifi_service.update_wifi_settings(settings_dict)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/wifi/control")
async def control_wifi_endpoint(req: WifiControlRequest):
    try:
        from app.services import wifi_service
        if req.action == "start":
            wifi_service.update_wifi_settings({"ftp_enabled": True})
        elif req.action == "stop":
            wifi_service.update_wifi_settings({"ftp_enabled": False})
        else:
            raise HTTPException(status_code=400, detail="Invalid action. Must be 'start' or 'stop'")
        return wifi_service.get_wifi_status()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/wifi/history")
async def get_wifi_history_endpoint():
    try:
        from app.services import wifi_service
        return {"status": "success", "history": wifi_service.get_wifi_history()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/wifi/history/clear")
async def clear_wifi_history_endpoint():
    try:
        from app.services import wifi_service
        wifi_service.clear_wifi_history()
        return {"status": "success", "message": "WiFi history cleared successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/photos/rename")
async def rename_photo(req: RenamePhotoRequest):
    try:
        norm_path = os.path.normpath(req.path)
        file_path = os.path.normpath(os.path.join(GALLERY_DIR, norm_path))
        if not file_path.startswith(os.path.abspath(GALLERY_DIR)) and not file_path.startswith(GALLERY_DIR):
             raise HTTPException(status_code=400, detail="Invalid path")
             
        if not os.path.exists(file_path):
             raise HTTPException(status_code=404, detail="Photo not found on disk")
        
        parent_dir = os.path.dirname(file_path)
        old_filename = os.path.basename(file_path)
        
        _, ext = os.path.splitext(old_filename)
        new_name_clean = req.new_name.strip()
        if not new_name_clean:
            raise HTTPException(status_code=400, detail="New filename cannot be empty")
            
        if not new_name_clean.lower().endswith(ext.lower()):
            new_name_clean += ext
            
        if "/" in new_name_clean or "\\" in new_name_clean or ".." in new_name_clean:
            raise HTTPException(status_code=400, detail="Invalid filename")

        new_file_path = os.path.join(parent_dir, new_name_clean)
        
        if os.path.exists(new_file_path):
            raise HTTPException(status_code=400, detail="A file with this name already exists")
            
        os.rename(file_path, new_file_path)
        
        load_db()
        db = get_db()
        
        old_rel_path = norm_path.replace("\\", "/")
        new_rel_path = os.path.relpath(new_file_path, GALLERY_DIR).replace("\\", "/")
        
        old_photo_url = f"/gallery/{old_rel_path}"
        new_photo_url = f"/gallery/{new_rel_path}"
        
        if "couple_photos" in db:
            for p in db["couple_photos"]:
                if p["path"] == old_rel_path:
                    p["filename"] = new_name_clean
                    p["path"] = new_rel_path
                    p["url"] = new_photo_url
                    
        for pid, pdata in db.get("persons", {}).items():
            if old_photo_url in pdata["photos"]:
                pdata["photos"] = [new_photo_url if u == old_photo_url else u for u in pdata["photos"]]
                
        save_db()
        
        return {
            "status": "success", 
            "message": "Photo renamed successfully",
            "old_path": old_rel_path,
            "new_path": new_rel_path,
            "new_url": new_photo_url
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/users/rename")
async def rename_user(req: RenameUserRequest):
    try:
        old_user_id = req.old_user_id.strip()
        new_user_id = req.new_user_id.strip()
        
        if not old_user_id or not new_user_id:
            raise HTTPException(status_code=400, detail="User IDs cannot be empty")
            
        if ".." in old_user_id or "/" in old_user_id or "\\" in old_user_id:
            raise HTTPException(status_code=400, detail="Invalid old_user_id")
            
        if ".." in new_user_id or "/" in new_user_id or "\\" in new_user_id:
            raise HTTPException(status_code=400, detail="Invalid new_user_id")
            
        load_db()
        db = get_db()
        
        if old_user_id not in db.get("persons", {}):
            raise HTTPException(status_code=404, detail=f"User {old_user_id} not found in database")
            
        if new_user_id in db.get("persons", {}):
            raise HTTPException(status_code=400, detail=f"User {new_user_id} already exists in database")
            
        old_user_dir = os.path.join(GALLERY_DIR, old_user_id)
        new_user_dir = os.path.join(GALLERY_DIR, new_user_id)
        
        if os.path.exists(old_user_dir):
            if os.path.exists(new_user_dir):
                raise HTTPException(status_code=400, detail=f"Folder for {new_user_id} already exists on disk")
            os.rename(old_user_dir, new_user_dir)
            
        person_data = db["persons"].pop(old_user_id)
        
        old_prefix = f"/gallery/{old_user_id}/"
        new_prefix = f"/gallery/{new_user_id}/"
        
        updated_photos = []
        for url in person_data.get("photos", []):
            if url.startswith(old_prefix):
                updated_photos.append(url.replace(old_prefix, new_prefix, 1))
            else:
                updated_photos.append(url)
        person_data["photos"] = updated_photos
        
        db["persons"][new_user_id] = person_data
        save_db()
        
        try:
            from app.services.face_service import get_embedding_cache
            get_embedding_cache()
        except Exception:
            pass
            
        return {
            "status": "success",
            "message": f"User successfully renamed from {old_user_id} to {new_user_id}"
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/reset-system")
async def reset_system_for_new_wedding():
    """Deletes ALL photos, face data, and database to prepare for a new wedding."""
    try:
        from app.services.db_service import DB_DATA, DB_LOCK, save_db

        # 1. Delete entire gallery directory (all photos + thumbnails)
        if os.path.exists(GALLERY_DIR):
            shutil.rmtree(GALLERY_DIR)
        os.makedirs(GALLERY_DIR, exist_ok=True)

        # 2. Reset the in-memory database
        with DB_LOCK:
            DB_DATA.clear()
            DB_DATA["persons"] = {}
            DB_DATA["couple_categories"] = list(COUPLE_PHOTO_CATEGORIES)
            DB_DATA["couple_settings"] = {"couple_name": ""}

        # 3. Save empty database to disk
        save_db()

        # 4. Clear embedding cache if it exists
        try:
            from app.services.face_service import get_embedding_cache
            cache = get_embedding_cache()
            if hasattr(cache, 'clear'):
                cache.clear()
        except Exception:
            pass

        # 5. Remove any leftover data files
        data_dir = os.path.dirname(GALLERY_DIR)
        for fname in os.listdir(data_dir):
            fpath = os.path.join(data_dir, fname)
            if fname.endswith('.pkl') or fname.endswith('.cache'):
                try:
                    os.remove(fpath)
                except Exception:
                    pass

        return {
            "status": "success",
            "message": "System has been completely reset. Ready for a new wedding!"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Reset failed: {str(e)}")
