import os

# Allow overriding data directory via environment variable (e.g., for Render persistent disk)
DATA_DIR = os.environ.get("DATA_DIR", "data")

DB_PATH = os.path.join(DATA_DIR, "database.json")
GALLERY_DIR = os.path.join(DATA_DIR, "gallery")
THRESHOLD = 0.45  # Optimal threshold for ArcFace ResNet-50

COUPLE_PHOTO_CATEGORIES = ["Ceremony", "Reception", "Portraits", "Candid"]
