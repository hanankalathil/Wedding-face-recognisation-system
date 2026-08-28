import os
import io
import zipfile
from typing import List
from urllib.parse import unquote
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, StreamingResponse
from app.core.config import GALLERY_DIR, is_supabase_enabled
from app.services.supabase_service import download_file_from_supabase

router = APIRouter()

class ZipRequest(BaseModel):
    paths: List[str]

@router.get("")
async def download_image(path: str):
    try:
        decoded_path = unquote(path)
        if ".." in decoded_path or decoded_path.startswith("/") or decoded_path.startswith("\\"):
            raise HTTPException(status_code=400, detail="Invalid path")
            
        file_path = os.path.normpath(os.path.join(GALLERY_DIR, decoded_path))
        
        if os.path.exists(file_path):
            filename = os.path.basename(file_path)
            return FileResponse(path=file_path, filename=filename, media_type='image/jpeg', headers={"Content-Disposition": f"attachment; filename={filename}"})

        if is_supabase_enabled():
            raw_data = download_file_from_supabase(f"gallery/{decoded_path}")
            if raw_data:
                filename = os.path.basename(decoded_path)
                return StreamingResponse(
                    io.BytesIO(raw_data),
                    media_type='image/jpeg',
                    headers={"Content-Disposition": f"attachment; filename={filename}"}
                )

        raise HTTPException(status_code=404, detail="File not found")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/zip")
async def download_zip(request: ZipRequest):
    try:
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
            for path in request.paths:
                # Decode path first to handle spaces and special chars
                decoded_path = unquote(path)
                
                clean_path = decoded_path
                if clean_path.startswith("/gallery/"):
                    clean_path = clean_path[len("/gallery/"):]
                elif clean_path.startswith("gallery/"):
                    clean_path = clean_path[len("gallery/"):]
                
                if ".." in clean_path or clean_path.startswith("/") or clean_path.startswith("\\"):
                    continue
                
                file_path = os.path.normpath(os.path.join(GALLERY_DIR, clean_path))
                raw_bytes = None
                
                if os.path.exists(file_path):
                    with open(file_path, "rb") as f:
                        raw_bytes = f.read()
                elif is_supabase_enabled():
                    raw_bytes = download_file_from_supabase(f"gallery/{clean_path}")

                if raw_bytes:
                    arcname = os.path.basename(clean_path)
                    # Handle duplicate filenames in the zip
                    original_arcname = arcname
                    counter = 1
                    while arcname in zip_file.namelist():
                        name, ext = os.path.splitext(original_arcname)
                        arcname = f"{name}_{counter}{ext}"
                        counter += 1
                    zip_file.writestr(arcname, raw_bytes)
                    
        zip_buffer.seek(0)
        return StreamingResponse(
            zip_buffer,
            media_type="application/zip",
            headers={"Content-Disposition": "attachment; filename=memories.zip"}
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
