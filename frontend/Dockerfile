FROM node:20-alpine

WORKDIR /app

# Copiar archivos de dependencias e instalarlas
COPY package*.json ./
RUN npm install

# Copiar el código del frontend
COPY . .

# Exponer el puerto de Vite (5173)
EXPOSE 5173

# Iniciar Vite con soporte para todas las interfaces
CMD ["npm", "run", "dev"]
