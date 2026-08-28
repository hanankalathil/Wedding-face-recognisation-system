import os

# Base directory for backend (backend/)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
default_data_dir = os.path.join(BASE_DIR, "data")

# Allow overriding data directory via environment variable (e.g., for Render persistent disk)
DATA_DIR = os.environ.get("DATA_DIR", default_data_dir)
if not os.path.isabs(DATA_DIR):
    DATA_DIR = os.path.abspath(os.path.join(BASE_DIR, DATA_DIR))

DB_PATH = os.path.join(DATA_DIR, "database.json")
GALLERY_DIR = os.path.join(DATA_DIR, "gallery")
THRESHOLD = 0.45  # Optimal threshold for ArcFace ResNet-50

COUPLE_PHOTO_CATEGORIES = ["Ceremony", "Reception", "Portraits", "Candid"]


