import os
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from app.core.config import GALLERY_DIR

router = APIRouter()

@router.get("")
async def download_image(path: str):
    try:
        if ".." in path or path.startswith("/") or path.startswith("\\"):
            raise HTTPException(status_code=400, detail="Invalid path")
            
        file_path = os.path.normpath(os.path.join(GALLERY_DIR, path))
        
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="File not found")
            
        filename = os.path.basename(file_path)
        return FileResponse(path=file_path, filename=filename, media_type='image/jpeg', headers={"Content-Disposition": f"attachment; filename={filename}"})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
