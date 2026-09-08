# Offline Requests

Aplicacion fullstack offline-first para crear solicitudes localmente, procesarlas por tipo y sincronizarlas con un backend central.

## Servicios

- `web/`: frontend React + TypeScript, con React Query y componentes separados.
- `sync-service/`: servicio Node.js independiente. Persiste solicitudes en PostgreSQL local y sincroniza pendientes.
- `backend/`: API .NET 10. Registra solicitudes procesadas en PostgreSQL central.
- `docker-compose.yml`: levanta las bases `requests_local` y `requests_central`.

## Requisitos

- Docker
- Node.js 22.13+ (rama 22), 24 o 26+ para ejecutar tambien las pruebas del frontend
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
5. El sync-service marca como `Processed` solo las confirmadas. Los errores de procesamiento quedan `Failed`; las solicitudes sin confirmacion permanecen `Pending` para un nuevo envio.

El modo offline requiere que el frontend, Node.js y PostgreSQL local esten disponibles. La sincronizacion es manual, con hasta tres intentos por lote ante fallos transitorios del backend.

## Patrones y decisiones

El backend usa Clean Architecture, CQRS con MediatR, validacion por pipeline y EF Core como Unit of Work. Node separa transporte, casos de uso y persistencia mediante dependencias inyectadas; utiliza Strategy para procesadores y Composite para grupos. React separa datos remotos (React Query) y estado local de UI (useState).

Ver [arquitectura, patrones y limites](docs/architecture.md) para el flujo, ubicacion de cada patron, garantias de entrega y decisiones de alcance.

## Procesamiento por tipo

Los procesadores viven en `sync-service/src/processors.js`. `ProcessorRegistry` acepta entradas `[type, funcion]` en su constructor; agregar una estrategia no requiere cambiar el flujo principal de sincronizacion.

Tipos incluidos:

- `text.uppercase`
- `text.lowercase`
- `text.trim`
- `json.normalize`

## Agrupaciones

El sync-service permite crear grupos con solicitudes y otros grupos. Las funciones de `sync-service/src/groups.js` calculan el total de solicitudes contenidas y permiten sincronizar un grupo completo.

`RequestLeaf` y `RequestGroup` comparten las operaciones `count()` y `requestIds()`. El conteo incluye ocurrencias y la sincronizacion deduplica los Id. Se validan referencias y ciclos; los grupos se administran mediante la API local.

## Backend

Endpoint principal:

```http
POST /requests/sync
```

Consulta central para comprobar un registro: `GET /requests/{id}`. Devuelve el payload procesado o 404 si el Id no existe.

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

Pruebas de Node y React, sin bases de datos:

```powershell
cd sync-service
npm.cmd test
```

En otra terminal, desde la raiz del repositorio:

```powershell
cd web
npm.cmd test
```

Integracion con PostgreSQL y backend en ejecucion (desde `sync-service`):

```powershell
$env:RUN_DB_TESTS='1'
node --test test/postgres.integration.test.js
Remove-Item Env:RUN_DB_TESTS
```

Pruebas E2E con los tres servicios activos (desde `web`):

```powershell
npx playwright install chromium
npm.cmd run test:e2e
```

Para usar Chrome instalado, se puede definir `$env:PLAYWRIGHT_BROWSER_CHANNEL='chrome'` y ejecutar `npm.cmd run test:e2e` sin descargar Chromium. Las pruebas cubren escritorio y movil y generan capturas en `web/test-results/` (ignorado por Git).
