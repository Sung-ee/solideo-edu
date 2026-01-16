"""
System Resource Monitor - FastAPI Backend
Real-time system monitoring with WebSocket support
"""

import asyncio
import json
from pathlib import Path
from typing import List

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.middleware.cors import CORSMiddleware

from monitor import monitor
from steam_checker import check_game_compatibility, get_games_list

app = FastAPI(
    title="System Resource Monitor",
    description="Real-time system resource monitoring API",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve frontend static files
FRONTEND_DIR = Path(__file__).parent.parent / "frontend"


class ConnectionManager:
    """WebSocket connection manager"""
    
    def __init__(self):
        self.active_connections: List[WebSocket] = []
    
    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
    
    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
    
    async def broadcast(self, message: str):
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception:
                disconnected.append(connection)
        
        for conn in disconnected:
            self.disconnect(conn)


manager = ConnectionManager()


@app.get("/", response_class=HTMLResponse)
async def root():
    """Serve the main dashboard"""
    index_path = FRONTEND_DIR / "index.html"
    if index_path.exists():
        return FileResponse(index_path)
    return HTMLResponse("<h1>Frontend not found. Please check the frontend directory.</h1>")


@app.get("/styles.css")
async def styles():
    """Serve CSS"""
    return FileResponse(FRONTEND_DIR / "styles.css", media_type="text/css")


@app.get("/app.js")
async def app_js():
    """Serve main JavaScript"""
    return FileResponse(FRONTEND_DIR / "app.js", media_type="application/javascript")


@app.get("/pdf-export.js")
async def pdf_export_js():
    """Serve PDF export JavaScript"""
    return FileResponse(FRONTEND_DIR / "pdf-export.js", media_type="application/javascript")


@app.get("/api/system-info")
async def get_system_info():
    """Get static system information"""
    return monitor.get_system_info()


@app.get("/api/stats")
async def get_stats():
    """Get current system statistics"""
    return monitor.get_all_stats()


@app.get("/api/steam-games")
async def get_steam_games():
    """Get Steam Top 10 games list with requirements"""
    return get_games_list()


@app.get("/api/steam-compatibility")
async def get_steam_compatibility():
    """Check system compatibility with Steam Top 10 games"""
    system_info = monitor.get_system_info()
    memory_info = monitor.get_memory_info()
    gpu_info = monitor.get_gpu_info()
    disk_info = monitor.get_disk_info()
    
    # Get GPU VRAM (use first GPU if available)
    gpu_vram = 0
    if gpu_info:
        gpu_vram = gpu_info[0].get("memory_total_gb", 0)
    
    # Get max available storage
    max_storage = 0
    for partition in disk_info.get("partitions", []):
        if partition["free_gb"] > max_storage:
            max_storage = partition["free_gb"]
    
    compatibility = check_game_compatibility(
        processor_name=system_info.get("processor", "Unknown"),
        ram_gb=memory_info.get("total_gb", 0),
        gpu_vram_gb=gpu_vram,
        available_storage_gb=max_storage
    )
    
    return {
        "system_specs": {
            "processor": system_info.get("processor", "Unknown"),
            "ram_gb": memory_info.get("total_gb", 0),
            "gpu_vram_gb": gpu_vram,
            "available_storage_gb": max_storage
        },
        "games": compatibility
    }


@app.websocket("/ws/monitor")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time monitoring"""
    await manager.connect(websocket)
    
    try:
        while True:
            # Send system stats every second
            stats = monitor.get_all_stats()
            await websocket.send_text(json.dumps(stats))
            await asyncio.sleep(1)
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        print(f"WebSocket error: {e}")
        manager.disconnect(websocket)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
