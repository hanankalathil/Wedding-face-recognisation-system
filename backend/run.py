import uvicorn
import os

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    # Change to the directory containing run.py (the backend directory)
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    host = os.environ.get("HOST", "0.0.0.0")
    uvicorn.run("app.main:app", host=host, port=port, reload=is_dev)


