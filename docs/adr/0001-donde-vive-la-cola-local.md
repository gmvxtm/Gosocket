# 0001 - Donde vive la cola local

Fecha: 2026-09-21
Estado: aceptado

## Contexto

El enunciado pide que la aplicacion permita crear solicitudes sin conexion y sincronizarlas
despues contra un registro central. Tambien pide un frontend en React con un servicio en
Node.js que se ejecute de manera independiente, y deja libre la eleccion de la tecnologia
de persistencia local.

La primera version resolvio la persistencia local con PostgreSQL detras del servicio Node.
Eso funciona cuando el usuario trabaja en un equipo donde se puede instalar ese servicio y
su base: una estacion de trabajo, una sucursal, un punto de atencion.

No funciona cuando el cliente es solo un navegador. En un telefono no se puede correr
PostgreSQL ni un proceso Node. Si en ese escenario el servicio vive en un servidor remoto,
entonces al perder la señal la aplicacion se queda sin nada donde guardar, que es
exactamente lo que el modo offline debia evitar.

## Opciones evaluadas

1. **localStorage**: sincrono, bloquea el hilo de la interfaz, solo guarda texto y su limite
   ronda los 5 MB. Con cargas utiles de hasta 64 KB se llena con unas 80 solicitudes. Sirve
   para preferencias, no para una cola que no se puede perder.
2. **IndexedDB**: asincrona, transaccional, con indices y una cuota de cientos de MB. Es el
   almacenamiento que el navegador ofrece justamente para esto.
3. **PGlite (PostgreSQL compilado a WebAssembly)**: conserva SQL real en el navegador y se
   persiste sobre IndexedDB. Agrega unos 3 MB de descarga para un modelo de datos que aqui
   son dos tablas.
4. **SQLite en una aplicacion empaquetada** con Capacitor o React Native: exige distribuir e
   instalar una aplicacion, que no es lo que se pidio.

## Decision

Se mantienen los dos modos y se elige al construir la imagen, con `VITE_LOCAL_STORE`:

- `service` (valor por defecto): la cola vive en el servicio local y su PostgreSQL.
- `browser`: la cola vive en IndexedDB, dentro del navegador.

Ambos implementan el mismo puerto `LocalStore`, asi que las pantallas, los hooks y el manejo
de estado no saben cual esta activo. Las preferencias y la sesion se siguen guardando en
localStorage, que es donde corresponde por tamaño y por criticidad.

En el modo navegador el servicio Node no desaparece: deja de ser el dueño de la cola y pasa
a ser el componente del lado servidor que recibe el lote en `POST /sync/batch`, aplica la
estrategia por tipo y lo reenvia al backend central. El procesamiento ocurre al sincronizar,
que es cuando hay red, asi que no necesita estar en el dispositivo.

Lo que no cambia: el identificador lo sigue generando el cliente y sigue siendo la clave
primaria en el central. Por eso mover la cola no afecta la idempotencia ni los reintentos.

## Consecuencias

A favor:

- El modo offline deja de depender de que el usuario tenga PostgreSQL instalado.
- El navegador puede cerrarse y reabrirse sin perder lo pendiente.
- En un dispositivo compartido cada cuenta ve solo su cola: las filas guardan el usuario que
  las creo y toda lectura se filtra por el indice `owner`.

En contra, y documentado a proposito:

- El dato queda por navegador y por dispositivo. Si el usuario borra los datos del sitio,
  pierde lo que no habia sincronizado. `navigator.storage.persist()` reduce el riesgo de
  desalojo por presion de espacio, pero no lo elimina.
- No hay una sola cola compartida entre los equipos de un mismo usuario.
- El recorrido del arbol de agrupaciones (el patron Composite) queda duplicado: una version
  en el servicio y otra en el navegador. Es el precio de que el navegador pueda contar sin
  conexion.
- La primera vez hace falta una conexion para traer el catalogo de tipos. A partir de ahi
  queda guardado y las siguientes altas funcionan sin red.
- Para que la aplicacion **abra** sin señal falta un service worker que cachee el HTML y los
  bundles. Sin el, el navegador no llega ni a cargar la pagina. Ver el siguiente paso.

## Siguiente paso

Convertir el frontend en PWA: manifiesto y service worker para el cascaron de la aplicacion,
y opcionalmente la Background Sync API para reintentar la cola sola cuando vuelva la señal.
Eso cierra el escenario del telefono de punta a punta.
