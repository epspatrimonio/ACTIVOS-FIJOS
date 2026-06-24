FROM python:3.11-slim

WORKDIR /app

# Instalar dependencias del sistema requeridas para compilar ciertos paquetes si es necesario
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copiar requirements.txt e instalar dependencias de Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar el código del backend
COPY . .

# Exponer el puerto del API (FastAPI default es 8000)
EXPOSE 8000

# Comando para iniciar la aplicación con Uvicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
