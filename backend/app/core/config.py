import os

# Base directory for backend (backend/)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
# Set up Vercel serverless writable directory defaults if running on Vercel
is_vercel = os.environ.get("VERCEL") == "1"
if is_vercel:
    os.environ.setdefault("HOME", "/tmp")
    os.environ.setdefault("UNIFACE_HOME", "/tmp/.uniface")

default_data_dir = "/tmp/data" if is_vercel else os.path.join(BASE_DIR, "data")

# Allow overriding data directory via environment variable (e.g., for Render persistent disk)
DATA_DIR = os.environ.get("DATA_DIR", default_data_dir)
if not os.path.isabs(DATA_DIR):
    DATA_DIR = os.path.abspath(os.path.join(BASE_DIR, DATA_DIR))

DB_PATH = os.path.join(DATA_DIR, "database.json")
GALLERY_DIR = os.path.join(DATA_DIR, "gallery")
THRESHOLD = 0.45  # Optimal threshold for ArcFace ResNet-50

COUPLE_PHOTO_CATEGORIES = ["Ceremony", "Reception", "Portraits", "Candid"]

# Load local .env file if present (checks root repo directory and BASE_DIR)
for potential_env_dir in [os.path.dirname(BASE_DIR), BASE_DIR]:
    env_path = os.path.join(potential_env_dir, ".env")
    if os.path.exists(env_path):
        try:
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        os.environ.setdefault(k.strip(), v.strip())
        except Exception as e:
            print(f"[Config] Warning loading .env: {e}")

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").strip()
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
SUPABASE_STORAGE_BUCKET = os.environ.get("SUPABASE_STORAGE_BUCKET", "wedding-gallery").strip()

# Admin emails allowlist (comma-separated env var)
raw_admin_emails = os.environ.get("ADMIN_EMAILS", "")
ADMIN_EMAILS = [e.strip().lower() for e in raw_admin_emails.split(",") if e.strip()]

# Storage Mode setting ('local' or 'supabase')
raw_storage_mode = os.environ.get("STORAGE_MODE", "local").strip().lower()
STORAGE_MODE = "supabase" if raw_storage_mode == "supabase" else "local"

def get_storage_mode() -> str:
    """Returns active storage mode: 'local' or 'supabase'."""
    return STORAGE_MODE

def is_supabase_enabled() -> bool:
    return bool(SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)



