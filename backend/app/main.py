import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from app.core.config import GALLERY_DIR
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

if os.path.exists(GALLERY_DIR):
    app.mount("/gallery", StaticFiles(directory=GALLERY_DIR), name="gallery")

load_db()

@app.on_event("startup")
async def startup_event():
    try:
        from app.services.wifi_service import start_wifi_services
        start_wifi_services()
    except Exception as e:
        print(f"Error starting WiFi services on startup: {e}")

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

