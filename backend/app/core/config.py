import os
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    # Base de datos (Debe configurarse en el entorno o .env, por ejemplo: postgresql+asyncpg://user:pass@host:5432/db)
    DATABASE_URL: str = "postgresql+asyncpg://postgres:deutschland@localhost:5432/activos_fijos"
    
    # Ruta física de exportación del archivo JSON de activos públicos (resuelto de forma absoluta)
    PUBLIC_EXPORT_PATH: str = os.path.abspath(
        os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))),
            "public_dashboard",
            "activos.json"
        )
    )
    
    # Configuración de CORS
    ALLOWED_HOSTS: list[str] = ["*"]
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    def __init__(self, **values):
        super().__init__(**values)
        # Si la ruta es relativa, la resolvemos de forma absoluta con respecto a la raíz de la carpeta backend
        if not os.path.isabs(self.PUBLIC_EXPORT_PATH):
            current_file_dir = os.path.dirname(os.path.abspath(__file__)) # .../backend/app/core
            backend_dir = os.path.dirname(os.path.dirname(current_file_dir)) # .../backend
            self.PUBLIC_EXPORT_PATH = os.path.abspath(os.path.join(backend_dir, self.PUBLIC_EXPORT_PATH))

settings = Settings()

