from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import requests
import json

app = FastAPI()

# Allow your frontend origin here
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_URL = "https://livetiming.formula1.com/static"

@app.get("/api/f1-static/{full_path:path}")
def proxy_f1_static(full_path: str):
    # Build full URL
    url = f"{BASE_URL}/{full_path}"
    
    try:
        r = requests.get(url)
        r.raise_for_status()
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=502, detail=str(e))

    try:
        return json.loads(r.content.decode("utf-8-sig"))
    except Exception:
        return {}
