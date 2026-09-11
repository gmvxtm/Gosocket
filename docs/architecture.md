# Arquitectura y patrones

## Flujo y responsabilidades

~~~mermaid
flowchart LR
  UI["React: componentes"] --> Hooks["Hooks + React Query"]
  Hooks --> HTTP["Node: adaptador HTTP"]
  HTTP --> App["Casos de uso"]
  App --> Strategy["Strategy: procesadores"]
  App --> Composite["Composite: solicitudes y grupos"]
  App --> Repo["Repository PostgreSQL"]
  Repo --> Local[("Base local")]
  App --> Gateway["Cliente HTTP central"]
  Gateway --> API["API .NET / MediatR"]
  API --> Commands["Registro"]
  API --> Queries["Consulta por Id"]
  Commands --> EF["EF Core / Unit of Work"]
  Queries --> EF
  EF --> Central[("Base central")]
~~~

El frontend trabaja con el servicio local. El backend central recibe el payload transformado.
La copia local conserva el payload original, para que un reenvio no aplique la transformacion sobre un resultado anterior.

## Patrones implementados

| Patron | Implementacion | Problema que resuelve |
| --- | --- | --- |
| Clean Architecture | Domain, Application, Infrastructure y Api en .NET | Separa dominio, casos de uso, persistencia y transporte |
| CQRS + Mediator | RegisterRequestsCommand y GetRequestQuery con MediatR | Distingue registro de consulta central sin duplicar bases |
| Unit of Work | AppDbContext.SaveChangesAsync | Confirma el lote de entidades nuevas en una operacion de persistencia |
| Pipeline behavior | ValidationBehavior con FluentValidation | Valida los comandos antes del handler |
| Manejador global de errores | GlobalExceptionHandler, IExceptionHandler de ASP.NET | Un unico contrato de error, con ProblemDetails y traceId |
| Rate limiting | Ventana fija por llamante, RateLimitingSetup | Impide que un cliente agote la capacidad de la API |
| Bulkhead | ConcurrencyLimiter sobre /requests/sync | Aisla la sincronizacion pesada del resto de endpoints |
| Observabilidad | OpenTelemetry en .NET y Node, exportado por OTLP | Una sola traza para una operacion que cruza dos servicios |
| Dependency Inversion / DI | IAppDbContext; dependencias inyectadas en createApplication | Permite probar casos de uso sin servidor HTTP ni una base real |
| Repository | createPostgresRepository(pool), sync-service/src/db.js | Encapsula SQL parametrizado y mapeo de filas |
| Strategy | ProcessorRegistry, sync-service/src/processors.js | Selecciona la transformacion por type; acepta estrategias nuevas por constructor |
| Composite | RequestLeaf y RequestGroup, sync-service/src/groups.js; web/src/components/GroupPanel.tsx lo consume | Expone count y requestIds tanto en hojas como en grupos anidados |
| Factory / composition root | server.js ensambla repositorio, registro, cliente y aplicacion | Centraliza dependencias y ciclo de vida, con HTTP separado |
| Adapter | http.js y backend-client.js | Traduce HTTP a casos de uso y a confirmaciones del backend |
| Retry con backoff y timeout | createBackendClient | Tolera errores transitorios sin cambiar el Id de las solicitudes |
| Custom hooks y composicion | web/src/hooks/useRequests.ts y components/ | Mantiene los componentes declarativos y separa operaciones remotas |
| Server state separado del estado UI | React Query frente a useState | Gestiona cache e invalidacion sin mezclar formularios y seleccion |

Application en .NET usa el contrato IAppDbContext, que expone tipos de EF Core. Es la frontera de persistencia elegida; no se presenta como una capa completamente independiente del ORM.
Los componentes React usan contratos TypeScript estrictos. Esos tipos no reemplazan la validacion HTTP en ejecucion.

## Persistencia y entrega

La tabla local.requests sirve como registro durable de trabajo pendiente: crear la solicitud tambien la deja disponible para sincronizar.
Es una cola local con envio posterior; no se agrega una segunda tabla Outbox de eventos ni un broker, ya que no existen publicaciones de eventos separadas de la solicitud.

La entrega es al menos una vez, con deduplicacion central por Id. Si se pierde la confirmacion, la solicitud sigue Pending y se puede reenviar.
El backend devuelve alreadyRegistered para un Id previamente registrado. La prueba de integracion reproduce este caso con PostgreSQL y la API real.

La sincronizacion:
1. Selecciona solo Pending, opcionalmente filtradas por grupo.
2. Transforma cada payload y guarda primero los fallos deterministas como Failed.
3. Envia lotes de hasta 500, respetando el limite de la API.
4. Valida que las confirmaciones sean unicas, pertenezcan al lote y tengan estado Processed.
5. Marca solo los Id confirmados. Los omitidos y los lotes no confirmados permanecen Pending.

Un lote posterior fallido no revierte confirmaciones ya guardadas. El frontend refresca la lista incluso si la sincronizacion termina con error.
Failed indica un fallo de procesamiento, no una interrupcion de red; su correccion y reencolado no tienen aun una accion implementada.

## Resiliencia y agrupaciones

El cliente central realiza como maximo tres intentos, con timeout de cinco segundos por intento y esperas de 200 y 400 ms.
Reintenta fallos de transporte, HTTP 408, 429 y 5xx. Los demas errores HTTP y las confirmaciones invalidas se informan sin reintentos.
Cada reenvio conserva Id, payload y CreatedAt. No se afirma entrega exactamente una vez.

La aplicacion rechaza una sincronizacion simultanea dentro del mismo proceso con 409 y libera el bloqueo al terminar.
Esto no es un bloqueo distribuido. Desplegar varios sincronizadores sobre la misma base requiere coordinar la toma de trabajo.
La clave primaria central evita duplicados persistidos; el registro actual hace lectura seguida de insercion, por lo que carreras entre procesos pueden producir un error transitorio que deba reintentarse.

Composite cuenta ocurrencias: si el mismo subgrupo aparece dos veces, sus solicitudes cuentan dos veces.
La accion de sincronizar deduplica Id para no enviar dos veces la misma solicitud en esa operacion.
La deteccion de ciclos usa la ruta de ancestros y acepta subgrupos compartidos entre ramas.
Se rechazan referencias inexistentes y tipos de item desconocidos; un grupo vacio sincroniza cero solicitudes.

## Frontend y modo offline

React Query controla listados, tipos, healthcheck y mutaciones. Los hooks invalidan la cache al crear y al terminar una sincronizacion.
useState conserva exclusivamente el formulario y la seleccion. No se usa Redux porque actualmente no hay preferencias globales que lo justifiquen, ni Context de autenticacion porque no hay sesion.

networkMode: always permite intentar consultar localhost aunque el navegador marque Internet como desconectado.
Esto no crea una cache durable del navegador: para trabajar sin Internet deben estar disponibles el frontend servido localmente, Node.js y PostgreSQL local.
La sincronizacion es manual. El indicador del servicio local comprueba PostgreSQL; no indica disponibilidad del backend central.

## Decisiones de alcance

- Se conserva HTTP nativo de Node: el adaptador es pequeno y no requiere migrar a Express o Nest.
- EF Core con AsNoTracking es suficiente para consultar por Id; no se incorpora Dapper sin una consulta que lo necesite.
- No se agregan Kafka, Saga, Circuit Breaker, JWT ni un contenedor de DI a Node solo para aumentar la lista de patrones.
- No hay autenticacion ni endurecimiento para exposicion publica. CORS y credenciales son de desarrollo, y los puertos de los tres servicios se publican solo en loopback.
- No se agregan migraciones: este cambio conserva el esquema existente.
- Los listados y la construccion del arbol cargan los registros en memoria. Paginacion, limites de profundidad y coordinacion multiproceso quedan como mejoras para mayor volumen.

## Errores y limites

El manejador traduce cada excepcion a ProblemDetails: ValidationException a 400 con el detalle por campo, NotFoundException a 404, cancelacion del cliente a 499 y cualquier otra a 500 sin el mensaje interno.
Siempre agrega `traceId` con el identificador de la actividad, que es el mismo que se exporta por OpenTelemetry: con ese valor se ubica la peticion en el dashboard.

El limite por ventana y el bulkhead resuelven problemas distintos. La ventana protege de un cliente que llama demasiado seguido; el bulkhead protege la base de datos, porque cada sincronizacion escribe un lote de hasta 500 filas.
Sin bulkhead, varias sincronizaciones grandes en paralelo consumirian el pool de conexiones y dejarian sin respuesta a las consultas y al healthcheck.
El rechazo es inmediato y explicito, con `Retry-After`; el sync-service ya reintenta 429 con backoff, asi que el lote no se pierde.

## Telemetria

En .NET la instrumentacion es automatica: ASP.NET Core, HttpClient y el ActivitySource de Npgsql, mas metricas del runtime y del rate limiter. Serilog conserva la consola y agrega un sink OTLP, de modo que el log llega al dashboard con el `traceId` de la peticion que lo genero.

En Node la instrumentacion es manual, en dos bordes: el servidor HTTP y el cliente del backend.
La alternativa era el parcheo automatico de modulos, que bajo ESM depende de hooks del cargador; con dos bordes que instrumentar, escribirlos a mano resulta mas predecible y deja explicito el punto donde se propaga el contexto.
El cliente inyecta `traceparent` en la peticion al backend y .NET continua la misma traza, por eso una sincronizacion aparece como un unico arbol de spans.

Al span de la sincronizacion se le agregan los contadores del resultado, `sync.pending`, `sync.sent` y `sync.failed`: la traza dice que paso, no solo cuanto tardo.
El healthcheck se excluye en los dos servicios; se ejecuta cada pocos segundos y ocultaria el trafico real.

La telemetria es opcional. Si falta `OTEL_EXPORTER_OTLP_ENDPOINT`, .NET no registra exportador y en Node el tracer del API queda como no-op, sin costo ni dependencia de un recolector.
El dashboard guarda en memoria y no persiste: sirve para diagnosticar en desarrollo, no como almacen de telemetria.

## Despliegue

`docker compose up -d --build` construye y levanta todo: las dos bases, el backend, el sync-service y el frontend compilado servido por nginx.
Cada servicio tiene su propia imagen y su propio ciclo de vida; compose solo los conecta por la red interna y ordena el arranque con `depends_on` sobre los healthchecks.

Dentro de la red los servicios se llaman por su nombre: el sync-service alcanza el backend en `http://backend:8080` y cada uno a su base en el puerto 5432 interno.
El frontend es la excepcion: su llamada sale del navegador, en el host, asi que `VITE_SYNC_SERVICE_URL` se compila apuntando al puerto publicado `http://localhost:3001`.

El esquema se crea al iniciar, sin pasos manuales: el backend ejecuta sus migraciones de EF Core y el sync-service aplica su `CREATE TABLE IF NOT EXISTS`.
Los datos viven en volumenes de Docker, por lo que sobreviven a `docker compose down` y se borran con `down -v`.

El sync-service escucha en loopback por defecto y la imagen lo abre a `0.0.0.0` mediante `HOST`, porque dentro del contenedor esa es la unica forma de recibir trafico de la red de compose. La publicacion en `127.0.0.1` mantiene el limite anterior desde fuera.

## Verificacion

- .NET: tests de registro, consulta sin tracking, validacion y modelo/migracion.
- Node: extensibilidad de Strategy, Composite, ciclos y referencias, grupos vacios, lotes, confirmaciones parciales, fallos y recuperacion, timeout y errores HTTP.
- PostgreSQL + API real: persistencia entre conexiones y recuperacion tras perder la confirmacion.
- React: consultas y creacion con onlineManager offline, invalidacion, errores y preservacion del formulario.
- Playwright: crear, sincronizar, leer el registro central y recargar en escritorio y movil, contra el despliegue en contenedores. Las capturas resultantes estan en docs/screenshots.

Las pruebas EF InMemory no verifican restricciones ni carreras de PostgreSQL.
La prueba de reconexion usa un cliente central que simula una interrupcion; no desconecta fisicamente Internet.
Las pruebas de integracion y E2E crean datos de demostracion. La prueba de integracion limpia sus filas locales; el registro central y los datos E2E permanecen para inspeccion.

Referencias tecnicas:
- [Transacciones con node-postgres](https://node-postgres.com/features/transactions): las operaciones de una transaccion usan el mismo cliente.
- [Test runner de Node.js](https://nodejs.org/api/test.html).
- [Network modes de TanStack Query](https://tanstack.com/query/latest/docs/framework/react/guides/network-mode).
