# Offline Requests

Aplicacion fullstack offline-first para crear solicitudes localmente, procesarlas por tipo y sincronizarlas con un backend central.

## Servicios

- `web/`: frontend React + TypeScript, con login, React Query, React Router, i18n, preferencias en Redux y componentes separados.
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
- Usuario demo: `admin` / `Admin.12345`

Los tres servicios de aplicacion publican solo en `127.0.0.1`. La solucion incluye login demo y JWT, pero las credenciales y claves son de desarrollo.

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
4. El backend cataloga automaticamente el `type` en `cnfg.RequestTypes` si aun no existe y registra la solicitud de forma idempotente usando el `Id` generado localmente.
5. El backend guarda eventos de auditoria en `log.SyncIssues` cuando detecta Id repetidos en un lote o reenvios ya registrados.
6. El sync-service marca como `Processed` solo las confirmadas. Los errores de procesamiento quedan `Failed`; las solicitudes sin confirmacion permanecen `Pending` para un nuevo envio.

El modo offline requiere que el frontend, Node.js y PostgreSQL local esten disponibles. La sincronizacion es manual, con hasta tres intentos por lote ante fallos transitorios del backend.

## Patrones y decisiones

El backend usa Clean Architecture, CQRS con MediatR, validacion por pipeline, JWT, rate limiting y EF Core como Unit of Work. Node separa transporte, casos de uso y persistencia mediante dependencias inyectadas; utiliza Strategy para procesadores y Composite para grupos. React separa datos remotos (React Query), sesion (Context), preferencias compartidas (Redux) y estado local de UI (useState).

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

La base central usa cuatro esquemas, siguiendo el mismo criterio de separacion usado en Thesis:

| Esquema | Uso |
| --- | --- |
| `core` | Solicitudes registradas centralmente. |
| `cnfg` | Catalogos; hoy contiene `RequestTypes`. |
| `sgr` | Seguridad; usuarios con hash BCrypt. |
| `log` | Auditoria tecnica; hoy contiene `SyncIssues`. |

`core.Requests.Type` queda protegido por FK hacia `cnfg.RequestTypes.Code`. Para conservar la extensibilidad pedida por la prueba, el backend crea automaticamente el catalogo cuando recibe un tipo nuevo: agregar un processor nuevo en Node no requiere modificar el backend central. EF Core usa el `xmin` interno de PostgreSQL como token de concurrencia en las entidades persistentes principales.

La sincronizacion es idempotente: si el mismo `Id` llega mas de una vez, el backend devuelve confirmacion sin insertar duplicados.

### Errores

Todas las respuestas de error usan ProblemDetails y llevan `traceId`. Las produce un unico manejador, `GlobalExceptionHandler`:
las validaciones de FluentValidation salen como 400 con el detalle por campo, y un fallo inesperado sale como 500 sin exponer el mensaje interno, que queda en el log.

### Limites

Dos limites independientes protegen la API. Se configuran en la seccion `RateLimiting` de `appsettings.json`:

| Ajuste | Valor | Efecto |
| --- | --- | --- |
| `PermitsPerMinute` | 120 | Ventana fija por llamante. Identifica por usuario autenticado y, si no lo hay, por IP. |
| `QueueLimit` | 0 | Sin espera: al agotar la ventana responde de inmediato. |
| `MaxConcurrentSynchronizations` | 4 | Bulkhead: sincronizaciones simultaneas contra la base. |
| `SynchronizationQueueLimit` | 8 | Sincronizaciones en espera antes de rechazar. |

El rechazo es `429` con ProblemDetails y cabecera `Retry-After`. El healthcheck queda exento, para que el monitoreo no consuma la ventana del llamante.

## Observabilidad

Los tres servicios de aplicacion exportan telemetria por OTLP al dashboard de Aspire, que ya viene en el `docker compose`:

```text
http://localhost:18888
```

No pide usuario ni contrasena y guarda todo en memoria: reiniciar el contenedor limpia la telemetria.

| Pestana | Que responde |
| --- | --- |
| Traces | Cuanto tardo cada operacion y donde. Una sincronizacion se ve como una sola traza que cruza los dos servicios: `POST /sync` en Node, `synchronize`, la llamada al backend, `POST /requests/sync` en .NET y las consultas de PostgreSQL. |
| Structured logs | Los logs de Serilog con su `traceId`. Desde un error se salta a la traza que lo produjo, y al reves. |
| Metrics | Duracion y volumen por endpoint, metricas del runtime y del rate limiter (`aspnetcore.rate_limiting.*`, con la politica `synchronization`). |

El `traceId` que devuelve un ProblemDetails es el mismo que se busca en el dashboard.

Se activa con la variable estandar `OTEL_EXPORTER_OTLP_ENDPOINT`, que el `docker compose` ya define. Sin esa variable los servicios arrancan sin exportador, por lo que las pruebas y un `dotnet run` o `npm start` sueltos no necesitan dashboard.

```text
OTEL_EXPORTER_OTLP_ENDPOINT=http://dashboard:18889   # .NET, OTLP sobre gRPC
OTEL_EXPORTER_OTLP_ENDPOINT=http://dashboard:18890   # Node, OTLP sobre HTTP
```

## Capturas

Salen de la suite E2E ejecutada contra el stack desplegado en Docker:

- Crear, sincronizar y consultar el detalle confirmado: [escritorio](docs/screenshots/requests-desktop.png), [movil](docs/screenshots/requests-mobile.png).
- Grupos anidados con su total y sincronizacion del grupo completo: [escritorio](docs/screenshots/groups-desktop.png), [movil](docs/screenshots/groups-mobile.png).

Del dashboard de telemetria, sobre el mismo despliegue:

- [Lista de trazas](docs/screenshots/telemetry-traces.png) y [detalle de una sincronizacion](docs/screenshots/telemetry-trace-detail.png), con sus seis spans repartidos entre los dos servicios.
- [Logs estructurados](docs/screenshots/telemetry-logs.png) enlazados a su traza y [metricas del rate limiter](docs/screenshots/telemetry-metrics.png).

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

Cada prueba corre en escritorio y movil y adjunta una captura. El reporte queda en `web/playwright-report/index.html`, junto con las capturas, los videos y las trazas de los casos que fallen:

```powershell
npx playwright show-report
```
