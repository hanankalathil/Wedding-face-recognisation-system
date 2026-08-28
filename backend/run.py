import uvicorn
import os

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    # Change to the directory containing run.py (the backend directory)
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    is_dev = os.environ.get("DEV", "true").lower() == "true"
    uvicorn.run("app.main:app", host="127.0.0.1", port=port, reload=is_dev)

