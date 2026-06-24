# Estructura de Archivos del Programa - Control Patrimonial (Activos Fijos)

**Resumen Ejecutivo de la Arquitectura del Sistema**  
**Fecha:** 24 de Junio de 2026 | **Estado:** Funcional y Listo para Contenedores

---

El presente documento detalla de manera resumida y organizada la estructura de directorios y archivos del sistema de gestión de **Activos Fijos (Control Patrimonial)**. La arquitectura está dividida de forma modular entre un Frontend desarrollado en React/Vite, un Backend desarrollado en FastAPI (Python), y scripts de utilidad en la carpeta Scratch, además de configuraciones de despliegue con Docker.

---

## 1. Directorio Raíz y Archivos Generales

La raíz del proyecto contiene los orquestadores globales de inicio y apagado de la aplicación local, así como los scripts de inicialización de la base de datos PostgreSQL y la configuración para Docker.

* **[Control Patrimonial.vbs](file:///c:/APP%20ActivosFijos/Control%20Patrimonial.vbs):** Script VBScript que actúa como panel de inicio inteligente y oculto de la aplicación local, permitiendo iniciar los servicios en segundo plano o apagarlos sin mostrar ventanas de comando.
* **[docker-compose.yml](file:///c:/APP%20ActivosFijos/docker-compose.yml):** Orquestador de contenedores Docker que define los servicios `activos-db` (PostgreSQL), `activos-backend` (FastAPI) y `activos-frontend` (Vite).
* **[iniciar_app.bat](file:///c:/APP%20ActivosFijos/iniciar_app.bat) y [detener_app.bat](file:///c:/APP%20ActivosFijos/detener_app.bat):** Scripts batch que ejecutan los comandos de limpieza de puertos, inicio de servidores en segundo plano y finalización de procesos.
* **[AFIJOS PG.sql](file:///c:/APP%20ActivosFijos/AFIJOS%20PG.sql):** Esquema SQL de definición de la base de datos PostgreSQL, incluyendo la estructura de tablas inicial.
* **[seed_data.sql](file:///c:/APP%20ActivosFijos/seed_data.sql):** Datos semilla para poblar la base de datos con información inicial para pruebas.
* **[.gitignore](file:///c:/APP%20ActivosFijos/.gitignore):** Archivo de exclusión para evitar la subida de dependencias (`.venv`, `node_modules`) o configuraciones locales al control de versiones.

---

## 2. Módulo Frontend (React/Vite)

Ubicado en la carpeta `/frontend`, provee la interfaz gráfica de usuario interactiva y fluida. Está construida sobre React y utiliza Tailwind CSS para los estilos.

* **[frontend/src/components/](file:///c:/APP%20ActivosFijos/frontend/src/components/):** Contiene los componentes React reutilizables y paneles modulares de la interfaz:
  * `ActivosTable.jsx` (Listado y filtros de búsqueda)
  * `ActivoForm.jsx` (Formulario de registro y edición)
  * `CelularesModule.jsx` (Control de equipos móviles)
  * `VehiculosModule.jsx` (Detalles de flota vehicular)
  * `SoatModule.jsx` (Gestión de alertas y vencimientos de SOAT)
  * `InventarioFisicoPanel.jsx` (Registro de sobrantes y faltantes)
  * `BienesTercerosPanel.jsx` (Control de bienes prestados)
* **[frontend/src/utils/api.js](file:///c:/APP%20ActivosFijos/frontend/src/utils/api.js):** Capa de conexión de red que gestiona todas las peticiones fetch hacia los endpoints de la API del Backend de manera centralizada.
* **[frontend/src/App.jsx](file:///c:/APP%20ActivosFijos/frontend/src/App.jsx) y [main.jsx](file:///c:/APP%20ActivosFijos/frontend/src/main.jsx):** Punto de entrada de React, encargado de estructurar el dashboard administrativo principal y coordinar los diferentes módulos.
* **[frontend/vite.config.js](file:///c:/APP%20ActivosFijos/frontend/vite.config.js) y [package.json](file:///c:/APP%20ActivosFijos/frontend/package.json):** Archivos de configuración del compilador Vite y definición de dependencias del ecosistema Node.js.
* **[frontend/Dockerfile](file:///c:/APP%20ActivosFijos/frontend/Dockerfile):** Instrucciones de compilación y despliegue del frontend dentro de un contenedor Docker.

---

## 3. Módulo Backend y Core (FastAPI/Python)

Ubicado en la carpeta `/backend`, provee la API RESTful de alto rendimiento que realiza las consultas a la base de datos, lógica de negocios y exportación de datos.

* **[backend/app/main.py](file:///c:/APP%20ActivosFijos/backend/app/main.py):** Punto de entrada del backend FastAPI. Configura los middlewares (CORS), monta las rutas de la API, y opcionalmente sirve los archivos estáticos en producción.
* **[backend/app/core/config.py](file:///c:/APP%20ActivosFijos/backend/app/core/config.py):** Gestión centralizada de configuraciones y variables de entorno usando Pydantic Settings (URL de la base de datos, rutas de exportación, etc.).
* **[backend/app/core/database.py](file:///c:/APP%20ActivosFijos/backend/app/core/database.py):** Configuración del motor de base de datos SQLAlchemy, creación de sesiones asíncronas para el manejo óptimo de transacciones.
* **[backend/app/api/endpoints.py](file:///c:/APP%20ActivosFijos/backend/app/api/endpoints.py):** Definición detallada de todas las rutas HTTP y endpoints del sistema (GET, POST, PUT, DELETE) organizadas para activos, celulares, vehículos, inventarios, etc.
* **[backend/app/models/activos.py](file:///c:/APP%20ActivosFijos/backend/app/models/activos.py):** Modelos ORM de SQLAlchemy que mapean de forma exacta las tablas de PostgreSQL (Activo, Sucursal, Celular, VehiculoDetalle, etc.).
* **[backend/app/schemas/activos.py](file:///c:/APP%20ActivosFijos/backend/app/schemas/activos.py):** Modelos de validación de datos Pydantic, asegurando que toda información recibida y enviada cumpla con el tipo de dato y estructura correspondientes.
* **[backend/requirements.txt](file:///c:/APP%20ActivosFijos/backend/requirements.txt):** Definición de librerías de Python requeridas para ejecutar el backend de forma local o contenerizada.

---

## 4. Directorio Scratch (Utilitarios y Pruebas)

Ubicado en `/backend/scratch`, contiene scripts temporales y herramientas rápidas desarrolladas para facilitar el mantenimiento, limpieza de datos y simulación de flujos de prueba sin afectar el código principal.

* **[backend/scratch/insert_sample_data.py](file:///c:/APP%20ActivosFijos/backend/scratch/insert_sample_data.py):** Script de Python para automatizar el registro de datos masivos de prueba en la base de datos local para verificar el comportamiento de las tablas y listas.
* **[backend/scratch/cleanup.py](file:///c:/APP%20ActivosFijos/backend/scratch/cleanup.py):** Script utilizado para depurar, limpiar registros o restablecer el estado de las tablas de datos durante la fase de desarrollo.
* **[backend/scratch/test_endpoints.py](file:///c:/APP%20ActivosFijos/backend/scratch/test_endpoints.py):** Script de automatización de pruebas rápidas de peticiones HTTP locales hacia el backend FastAPI para verificar la salud y respuestas de la API.

---

## Observaciones sobre la Arquitectura

1. **Separación de Responsabilidades:** La estructura actual respeta estrictamente la separación de responsabilidades (*Separation of Concerns*). La arquitectura backend está preparada para transicionar a producción de manera limpia. Se sugiere mantener el directorio Scratch como un espacio aislado para pruebas manuales rápidas.
2. **Optimización de Despliegue:** Dado que FastAPI ahora tiene la capacidad de servir la compilación de producción del frontend, en el entorno contenerizado final o empaquetado solo se requiere levantar la base de datos y el backend (FastAPI), reduciendo significativamente el consumo de recursos de memoria y CPU.
