import cv2
import numpy as np
from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
from app.services.db_service import load_db, get_db, save_db
from app.services.face_service import recognize_faces, extract_embedding
import os
from app.core.config import GALLERY_DIR

router = APIRouter()

class SetNameRequest(BaseModel):
    person_id: str
    display_name: str

@router.post("/set-name")
async def set_guest_name(req: SetNameRequest):
    """Public endpoint for guests to set their own display name after being matched."""
    try:
        name = req.display_name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="Name cannot be empty")
        
        load_db()
        db = get_db()
        
        if req.person_id not in db.get("persons", {}):
            raise HTTPException(status_code=404, detail="Person not found")
        
        db["persons"][req.person_id]["display_name"] = name
        save_db()
        
        return {
            "status": "success",
            "message": f"Welcome, {name}!",
            "display_name": name
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("")
async def recognize_face(file: UploadFile = File(...)):
    load_db()
    db = get_db()
        
    if not db.get("persons"):
        raise HTTPException(status_code=500, detail="Gallery database is empty.")

    try:
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
            raise HTTPException(status_code=400, detail="Invalid or corrupted image file")

        max_size = 1024
        h, w = img.shape[:2]
        if max(h, w) > max_size:
            scale = max_size / max(h, w)
            img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)

        matched_ids, num_faces = recognize_faces(img)
        
        if num_faces == 0:
            return {"message": "No faces detected in the uploaded selfie.", "matches": []}
            
        if not matched_ids:
            return {
                "message": "We couldn't find any matches in the gallery.",
                "matches": [],
                "status": "success"
            }
        
        matches = []
        persons_info = []
        for pid in set(matched_ids):
            if pid in db["persons"]:
                pdata = db["persons"][pid]
                matches.extend(pdata["photos"])
                
                avatar_disk_path = os.path.join(GALLERY_DIR, pid, "avatar.jpg")
                if os.path.exists(avatar_disk_path):
                    avatar_url = f"/gallery/{pid}/avatar.jpg"
                elif pdata.get("photos"):
                    avatar_url = pdata["photos"][0]
                else:
                    avatar_url = ""
                
                persons_info.append({
                    "id": pid,
                    "display_name": pdata.get("display_name", ""),
                    "avatar_url": avatar_url,
                    "social_profiles": pdata.get("social_profiles", {}),
                    "photo_count": len(pdata.get("photos", []))
                })
                
        matches = list(set(matches))
        
        if matches:
            return {
                "message": f"Successfully matched you! Found {len(matches)} photo(s).",
                "matches": matches,
                "persons": persons_info,
                "status": "success"
            }
        else:
            return {
                "message": "We couldn't find any matches in the gallery.",
                "matches": [],
                "persons": [],
                "status": "success"
            }
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/detect-face")
async def detect_face(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
            return {"has_face": False}

        h, w = img.shape[:2]
        max_size = 320
        if max(h, w) > max_size:
            scale = max_size / max(h, w)
            img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)

        embeddings = extract_embedding(img)
        return {"has_face": len(embeddings) > 0}
    except Exception:
        return {"has_face": False}
