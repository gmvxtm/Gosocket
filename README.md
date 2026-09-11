# Offline Requests

Aplicacion fullstack offline-first para crear solicitudes localmente, procesarlas por tipo y sincronizarlas con un backend central.

## Servicios

- `web/`: frontend React + TypeScript, con React Query y componentes separados.
- `sync-service/`: servicio Node.js independiente. Persiste solicitudes en PostgreSQL local y sincroniza pendientes.
- `backend/`: API .NET 10. Registra solicitudes procesadas en PostgreSQL central.
- `docker-compose.yml`: despliega los tres servicios y las bases `requests_local` y `requests_central`.

## Requisitos

- Docker: suficiente para desplegar la solucion completa.
- Node.js 22.13+ (rama 22), 24 o 26+ y .NET SDK 10: solo para el modo desarrollo y para ejecutar las pruebas.

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
HOST=127.0.0.1
BACKEND_URL=http://localhost:5080
DATABASE_URL=postgres://app:app@localhost:5432/requests_local
```

`HOST` define la interfaz de escucha. Fuera de Docker conviene dejar loopback; la imagen usa `0.0.0.0` para ser alcanzable dentro de la red de compose.

Variable del frontend, leida al compilar:

```text
VITE_SYNC_SERVICE_URL=http://localhost:3001
```

En el despliegue se pasa como argumento de build en `docker-compose.yml`. Apunta al puerto publicado del sync-service porque la peticion sale del navegador, no del contenedor.

El backend toma su cadena de conexion de `ConnectionStrings__Default`; el valor por defecto de `appsettings.json` apunta a `localhost:5433`.

## Despliegue completo

Desde la raiz del repositorio:

```powershell
docker compose up -d --build
```

Levanta las dos bases, el backend .NET, el sync-service y el frontend compilado y servido por nginx.
El backend aplica sus migraciones y el sync-service crea su esquema al iniciar, por lo que no hay pasos manuales de base de datos.

URLs:

- Frontend: `http://localhost:8080`
- Sync-service: `http://localhost:3001`
- Backend: `http://localhost:5080`
- PostgreSQL local: `localhost:5432`; central: `localhost:5433`

Los tres servicios de aplicacion publican solo en `127.0.0.1`, porque no incluyen autenticacion.

Estado y detencion:

```powershell
docker compose ps
docker compose logs -f sync-service
docker compose down
```

`docker compose down -v` elimina tambien los datos de las dos bases.

## Ejecucion en modo desarrollo

Solo las bases en Docker:

```powershell
docker compose up -d postgres-local postgres-central
```

Backend:

```powershell
cd backend
dotnet run --project src\RequestHub.Api\RequestHub.Api.csproj --urls http://localhost:5080
```

Sync-service:

```powershell
cd sync-service
npm install
npm start
```

Frontend con recarga en caliente:

```powershell
cd web
npm install
npm run dev
```

El frontend de desarrollo queda en `http://localhost:5173`. Si el stack completo esta arriba, sus contenedores `backend`, `sync-service` y `web` ocupan los puertos 5080, 3001 y 8080: conviene detenerlos antes (`docker compose stop backend sync-service web`).

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

`RequestLeaf` y `RequestGroup` comparten las operaciones `count()` y `requestIds()`. El conteo incluye ocurrencias y la sincronizacion deduplica los Id. Se validan referencias y ciclos.

El frontend expone la seccion **Groups**: se arma un grupo eligiendo solicitudes y otros grupos ya existentes, cada grupo muestra el total de solicitudes que contiene recorriendo todo el arbol, y el boton `Sync group` sincroniza el grupo completo en una sola accion. Como un grupo solo puede referenciar elementos creados antes que el, un ciclo es imposible por construccion.

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

Pruebas E2E sobre la solucion desplegada (desde `web`):

```powershell
npx playwright install chromium
$env:E2E_WEB_URL='http://localhost:8080'
npm.cmd run test:e2e
```

Sin `E2E_WEB_URL` apuntan al servidor de desarrollo en `http://localhost:5173`. Con `$env:PLAYWRIGHT_BROWSER_CHANNEL='chrome'` se usa el Chrome instalado en lugar de descargar Chromium.

Cada prueba corre en escritorio y movil y genera capturas en `web/test-results/` (ignorado por Git).
