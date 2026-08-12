import cv2
import numpy as np
from fastapi import APIRouter, UploadFile, File, HTTPException
from app.services.db_service import load_db, get_db
from app.services.face_service import recognize_faces

router = APIRouter()

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
        for pid in set(matched_ids):
            if pid in db["persons"]:
                matches.extend(db["persons"][pid]["photos"])
                
        matches = list(set(matches))
        
        if matches:
            return {
                "message": f"Successfully matched you! Found {len(matches)} photo(s).",
                "matches": matches,
                "status": "success"
            }
        else:
            return {
                "message": "We couldn't find any matches in the gallery.",
                "matches": [],
                "status": "success"
            }
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
