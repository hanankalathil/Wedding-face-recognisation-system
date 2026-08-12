import os
import uuid
import shutil
import hashlib
from datetime import datetime
import cv2
import numpy as np
from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks, Form
from pydantic import BaseModel
from app.core.config import GALLERY_DIR, COUPLE_PHOTO_CATEGORIES
from app.services.db_service import load_db, save_db, get_db
from app.services.face_service import process_image_background


router = APIRouter()

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
    if os.path.exists(GALLERY_DIR):
        for root, _, files in os.walk(GALLERY_DIR):
            for file in files:
                if file.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')):
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

@router.get("/photos/duplicates")
async def find_duplicates():
    try:
        hashes = {}
        duplicates = []
        if os.path.exists(GALLERY_DIR):
            for root, _, files in os.walk(GALLERY_DIR):
                for file in files:
                    if file.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')):
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
                        
                        if file_hash in hashes:
                            duplicates.append({
                                "original": hashes[file_hash],
                                "duplicate": photo_info
                            })
                        else:
                            hashes[file_hash] = photo_info
                            
        return {"status": "success", "duplicates": duplicates}
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
            del db["persons"][user_id]
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
    # Filter to only return photos that exist on disk
    existing_photos = []
    updated = False
    for p in photos:
        disk_path = os.path.join(GALLERY_DIR, p["path"])
        if os.path.exists(disk_path):
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


