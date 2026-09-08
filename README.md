# Offline Requests

Aplicacion fullstack offline-first para crear solicitudes localmente, procesarlas por tipo y sincronizarlas con un backend central.

## Servicios

- `web/`: frontend React.
- `sync-service/`: servicio Node.js independiente. Persiste solicitudes en PostgreSQL local y sincroniza pendientes.
- `backend/`: API .NET 10. Registra solicitudes procesadas en PostgreSQL central.
- `docker-compose.yml`: levanta las bases `requests_local` y `requests_central`.

## Requisitos

- Docker
- Node.js 20+
- .NET SDK 10

## Configuracion

PostgreSQL local:

```text
Host=localhost;Port=5432;Database=requests_local;Username=app;Password=app
```

PostgreSQL central:

```text
Host=localhost;Port=5433;Database=requests_central;Username=app;Password=app
```

Variables opcionales del sync-service:

```text
PORT=3001
BACKEND_URL=http://localhost:5080
DATABASE_URL=postgres://app:app@localhost:5432/requests_local
```

Variable opcional del frontend:

```text
VITE_SYNC_SERVICE_URL=http://localhost:3001
```

## Ejecucion local

Levantar bases de datos:

```powershell
docker compose up -d
```

Ejecutar backend:

```powershell
cd backend
dotnet run --project src\RequestHub.Api\RequestHub.Api.csproj --urls http://localhost:5080
```

Ejecutar sync-service:

```powershell
cd sync-service
npm install
npm start
```

Ejecutar frontend:

```powershell
cd web
npm install
npm run dev
```

URLs:

- Frontend: `http://localhost:5173`
- Sync-service: `http://localhost:3001`
- Backend: `http://localhost:5080`

## Flujo

1. El frontend crea solicitudes contra el sync-service.
2. El sync-service guarda las solicitudes en PostgreSQL local con estado `Pending`.
3. Al sincronizar, toma las pendientes, transforma el `payload` segun `type` y las envia al backend.
4. El backend registra las solicitudes de forma idempotente usando el `Id` generado localmente.
5. El sync-service marca las solicitudes como `Processed` o `Failed`.

## Procesamiento por tipo

Los procesadores viven en `sync-service/src/processors.js`. Agregar un nuevo tipo implica registrar una nueva entrada en el mapa de procesadores, sin cambiar el flujo principal de sincronizacion.

Tipos incluidos:

- `text.uppercase`
- `text.lowercase`
- `text.trim`
- `json.normalize`

## Agrupaciones

El sync-service permite crear grupos con solicitudes y otros grupos. Las funciones de `sync-service/src/groups.js` calculan el total de solicitudes contenidas y permiten sincronizar un grupo completo.

## Backend

Endpoint principal:

```http
POST /requests/sync
```

El backend usa Clean Architecture:

- `Domain`: entidades y enums.
- `Application`: comandos, DTOs, validaciones y handlers.
- `Infrastructure`: EF Core, PostgreSQL y migraciones.
- `Api`: endpoints, logging y healthcheck.

La sincronizacion es idempotente: si el mismo `Id` llega mas de una vez, el backend devuelve confirmacion sin insertar duplicados.

## Validacion

Backend:

```powershell
cd backend
dotnet test
```

Frontend:

```powershell
cd web
npm run build
```
