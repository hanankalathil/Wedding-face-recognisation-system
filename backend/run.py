import uvicorn
import os

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    host = os.environ.get("HOST", "0.0.0.0")
    is_dev = os.environ.get("DEV", "false").lower() == "true"
    
    # Change to the directory containing run.py (the backend directory)
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    print(f"Starting server on {host}:{port} (DEV={is_dev})...")
    uvicorn.run("app.main:app", host=host, port=port, reload=is_dev)



