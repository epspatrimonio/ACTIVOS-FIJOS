import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .core.config import settings
from .api.endpoints import router as api_router

# Inicialización de la aplicación FastAPI
app = FastAPI(
    title="Sistema de Gestión de Activos Fijos (Control Patrimonial)",
    description="API para la App Administrativa Privada del control patrimonial de activos fijos.",
    version="1.0.0"
)

# Habilitar CORS para permitir integraciones con el frontend local
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_HOSTS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Incluir el enrutador de activos bajo el prefijo /api
app.include_router(api_router, prefix="/api", tags=["Activos"])

# Servir el dashboard público como archivos estáticos
current_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
public_dir = os.path.join(current_dir, "public_dashboard")
if os.path.exists(public_dir):
    app.mount("/public", StaticFiles(directory=public_dir, html=True), name="public")

# Servir el frontend compilado (producción) en la raíz '/' si existe
frontend_dir = os.path.join(current_dir, "frontend", "dist")
if os.path.exists(frontend_dir):
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")

@app.get("/", tags=["General"])
async def root():
    return {
        "app": "Control Patrimonial - Backend",
        "status": "online",
        "documentation": "/docs"
    }


