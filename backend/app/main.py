import os
import mimetypes
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse, Response, FileResponse
from fastapi.staticfiles import StaticFiles
from app.core.config import GALLERY_DIR, is_supabase_enabled
from app.services.supabase_service import download_file_from_supabase
from app.api import admin, recognize, download
from app.services.db_service import load_db

app = FastAPI()

@app.middleware("http")
async def add_no_cache_headers(request: Request, call_next):
    response = await call_next(request)
    path = request.url.path
    if path.endswith(".html") or path.endswith(".js") or path.endswith(".css") or path.startswith("/api"):
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs(GALLERY_DIR, exist_ok=True)

@app.get("/gallery/{file_path:path}")
async def get_gallery_file(file_path: str):
    local_path = os.path.normpath(os.path.join(GALLERY_DIR, file_path))
    if os.path.exists(local_path) and os.path.isfile(local_path):
        return FileResponse(local_path)
        
    if is_supabase_enabled():
        raw_bytes = download_file_from_supabase(f"gallery/{file_path}")
        if raw_bytes:
            media_type = mimetypes.guess_type(file_path)[0] or "image/jpeg"
            return Response(content=raw_bytes, media_type=media_type)
            
    raise HTTPException(status_code=404, detail="File not found")

load_db()

@app.on_event("startup")
async def startup_event():
    try:
        from app.services.wifi_service import start_wifi_services
        start_wifi_services()
    except Exception as e:
        print(f"Error starting WiFi services on startup: {e}")
        
    try:
        from app.services.face_service import sync_group_photos_to_personal_folders, generate_avatars_for_all_persons
        sync_group_photos_to_personal_folders()
        generate_avatars_for_all_persons()
    except Exception as e:
        print(f"Error syncing group photos or avatars on startup: {e}")

@app.on_event("shutdown")
async def shutdown_event():
    try:
        from app.services.wifi_service import stop_wifi_services
        stop_wifi_services()
    except Exception as e:
        print(f"Error stopping WiFi services on shutdown: {e}")

app.include_router(admin.router, prefix="/api/admin", tags=["admin"])
app.include_router(recognize.router, prefix="/api/recognize", tags=["recognize"])
app.include_router(download.router, prefix="/api/download", tags=["download"])

@app.get("/admin")
@app.get("/admin/")
async def redirect_to_admin():
    return RedirectResponse(url="/archive/admin.html")

frontend_dir = os.path.join(os.path.dirname(__file__), "..", "..", "frontend")
if os.path.exists(frontend_dir):
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")
