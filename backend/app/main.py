import os
import mimetypes
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse, Response, FileResponse
from fastapi.staticfiles import StaticFiles
from app.core.config import GALLERY_DIR, is_supabase_enabled
from app.services.storage_service import get_storage_service
from app.api import admin, recognize, download
from app.services.db_service import load_db

class CleanStaticFiles(StaticFiles):
    async def get_response(self, path: str, scope) -> Response:
        try:
            response = await super().get_response(path, scope)
            if response.status_code == 404 and not os.path.splitext(path)[1]:
                html_path = path + ".html"
                try:
                    return await super().get_response(html_path, scope)
                except Exception as ex:
                    if getattr(ex, "status_code", None) != 404:
                        raise ex
            return response
        except Exception as e:
            if getattr(e, "status_code", None) == 404 and not os.path.splitext(path)[1]:
                html_path = path + ".html"
                try:
                    return await super().get_response(html_path, scope)
                except Exception as ex:
                    if getattr(ex, "status_code", None) == 404:
                        raise e
                    raise ex
            raise e

app = FastAPI()

@app.middleware("http")
async def add_no_cache_headers(request: Request, call_next):
    path = request.url.path
    # Secure routing: redirect direct access to admin.html to the protected route
    if "admin.html" in path:
        return RedirectResponse(url="/admin")
        
    # Redirect legacy .html urls to clean URLs
    if path.endswith(".html"):
        clean_path = path[:-5]
        if clean_path == "/index":
            clean_path = "/"
        
        # Append query params if they exist
        query_string = request.url.query
        redirect_url = f"{clean_path}?{query_string}" if query_string else clean_path
        return RedirectResponse(url=redirect_url, status_code=308)

    response = await call_next(request)
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
        return FileResponse(local_path, headers={"Cache-Control": "public, max-age=86400"})
        
    storage = get_storage_service()
    raw_bytes = storage.download_file(file_path)
    if raw_bytes:
        media_type = mimetypes.guess_type(file_path)[0] or "image/jpeg"
        return Response(
            content=raw_bytes,
            media_type=media_type,
            headers={"Cache-Control": "public, max-age=86400"}
        )
            
    raise HTTPException(status_code=404, detail="File not found")

@app.get("/health")
async def health_check():
    return {"status": "ok"}


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

app.include_router(admin.public_router, prefix="/api/admin", tags=["admin-auth"])
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])
app.include_router(recognize.router, prefix="/api/recognize", tags=["recognize"])
app.include_router(download.router, prefix="/api/download", tags=["download"])

@app.get("/admin")
@app.get("/admin/")
async def get_admin_dashboard(request: Request):
    # Retrieve the admin token from cookies or authorization header
    token = request.cookies.get("admin_token")
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            
    if not token:
        return RedirectResponse(url="/admin-login")
        
    try:
        from app.core.auth import verify_token_with_supabase
        verify_token_with_supabase(token)
    except HTTPException as e:
        if e.status_code == 403:
            raise e
        response = RedirectResponse(url="/admin-login")
        response.delete_cookie("admin_token")
        return response
        
    admin_html_path = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "archive", "admin.html"))
    if not os.path.exists(admin_html_path):
        raise HTTPException(status_code=404, detail="Admin dashboard file not found")
        
    return FileResponse(admin_html_path)

frontend_dir = os.path.join(os.path.dirname(__file__), "..", "..", "frontend")
if os.path.exists(frontend_dir):
    app.mount("/", CleanStaticFiles(directory=frontend_dir, html=True), name="frontend")
