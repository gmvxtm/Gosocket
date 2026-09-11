import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

export const languages = ['es', 'en'] as const;
export type Language = (typeof languages)[number];

const es = {
  app: {
    title: 'Solicitudes Offline',
    subtitle: 'Gestion local y sincronizacion con el registro central'
  },
  nav: {
    status: 'Estado',
    create: 'Nueva solicitud',
    requests: 'Solicitudes',
    groups: 'Agrupaciones'
  },
  session: {
    signIn: 'Ingresar',
    signOut: 'Salir',
    username: 'Usuario',
    password: 'Contrasena',
    signingIn: 'Ingresando...',
    welcome: 'Ingresa para administrar tus solicitudes',
    required: 'Usuario y contrasena son obligatorios.',
    expired: 'La sesion expiro. Ingresa de nuevo.',
    hint: 'Usuario de demostracion: admin / Admin.12345'
  },
  service: {
    online: 'Servicio local en linea',
    offline: 'Servicio local sin conexion',
    checking: 'Verificando servicio...'
  },
  actions: {
    refresh: 'Actualizar',
    sync: 'Sincronizar',
    syncing: 'Enviando...',
    create: 'Crear',
    creating: 'Creando...',
    theme: 'Cambiar tema',
    language: 'Idioma'
  },
  status: {
    pending: 'Pendiente',
    processed: 'Enviada',
    failed: 'Fallida',
    title: 'Estado de sincronizacion',
    pendingCount: 'Pendientes de envio',
    processedCount: 'Enviadas al registro central',
    failedCount: 'Con error de procesamiento',
    totalCount: 'Total de solicitudes',
    empty: 'Todavia no hay solicitudes registradas.',
    allSynced: 'No queda nada por enviar.',
    lastResult: 'Ultima sincronizacion: {{sent}} enviadas, {{failed}} con error.',
    explanation: 'Una solicitud nace pendiente y solo pasa a enviada cuando el registro central confirma su Id.'
  },
  form: {
    title: 'Crear solicitud',
    name: 'Nombre',
    type: 'Tipo',
    payload: 'Contenido',
    namePlaceholder: 'Pedido 1001',
    payloadPlaceholder: 'hola mundo',
    nameRequired: 'El nombre es obligatorio.',
    payloadRequired: 'El contenido es obligatorio.'
  },
  list: {
    title: 'Solicitudes',
    loading: 'Cargando solicitudes...',
    empty: 'Aun no hay solicitudes.',
    filter: 'Filtrar por estado',
    all: 'Todas',
    search: 'Buscar por nombre'
  },
  detail: {
    title: 'Detalle',
    empty: 'Selecciona una solicitud para ver su detalle.',
    id: 'Id',
    name: 'Nombre',
    type: 'Tipo',
    status: 'Estado',
    created: 'Creada',
    updated: 'Actualizada',
    payload: 'Contenido',
    error: 'Error',
    back: 'Volver al listado'
  },
  groups: {
    title: 'Agrupaciones',
    name: 'Nombre del grupo',
    namePlaceholder: 'Lote norte',
    requests: 'Solicitudes',
    nested: 'Grupos anidados',
    create: 'Crear grupo',
    sync: 'Sincronizar grupo',
    total: '{{count}} solicitud(es) en total',
    items: '{{count}} elemento(s)',
    nameRequired: 'El nombre es obligatorio.',
    membersRequired: 'Selecciona al menos una solicitud o grupo.',
    empty: 'Todavia no hay grupos.'
  }
};

const en: typeof es = {
  app: {
    title: 'Offline Requests',
    subtitle: 'Local management and synchronization with the central registry'
  },
  nav: {
    status: 'Status',
    create: 'New request',
    requests: 'Requests',
    groups: 'Groups'
  },
  session: {
    signIn: 'Sign in',
    signOut: 'Sign out',
    username: 'Username',
    password: 'Password',
    signingIn: 'Signing in...',
    welcome: 'Sign in to manage your requests',
    required: 'Username and password are required.',
    expired: 'The session expired. Sign in again.',
    hint: 'Demo account: admin / Admin.12345'
  },
  service: {
    online: 'Sync service online',
    offline: 'Sync service offline',
    checking: 'Checking service...'
  },
  actions: {
    refresh: 'Refresh',
    sync: 'Sync',
    syncing: 'Sending...',
    create: 'Create',
    creating: 'Creating...',
    theme: 'Switch theme',
    language: 'Language'
  },
  status: {
    pending: 'Pending',
    processed: 'Processed',
    failed: 'Failed',
    title: 'Synchronization status',
    pendingCount: 'Waiting to be sent',
    processedCount: 'Sent to the central registry',
    failedCount: 'Failed while processing',
    totalCount: 'Total requests',
    empty: 'No requests registered yet.',
    allSynced: 'Nothing left to send.',
    lastResult: 'Last synchronization: {{sent}} sent, {{failed}} failed.',
    explanation: 'A request starts as pending and becomes processed only when the central registry confirms its Id.'
  },
  form: {
    title: 'Create request',
    name: 'Name',
    type: 'Type',
    payload: 'Payload',
    namePlaceholder: 'Order 1001',
    payloadPlaceholder: 'hello world',
    nameRequired: 'Name is required.',
    payloadRequired: 'Payload is required.'
  },
  list: {
    title: 'Requests',
    loading: 'Loading requests...',
    empty: 'No requests yet.',
    filter: 'Filter by status',
    all: 'All',
    search: 'Search by name'
  },
  detail: {
    title: 'Detail',
    empty: 'Select a request to see its detail.',
    id: 'Id',
    name: 'Name',
    type: 'Type',
    status: 'Status',
    created: 'Created',
    updated: 'Updated',
    payload: 'Payload',
    error: 'Error',
    back: 'Back to the list'
  },
  groups: {
    title: 'Groups',
    name: 'Group name',
    namePlaceholder: 'North batch',
    requests: 'Requests',
    nested: 'Nested groups',
    create: 'Create group',
    sync: 'Sync group',
    total: '{{count}} request(s) in total',
    items: '{{count}} item(s)',
    nameRequired: 'Name is required.',
    membersRequired: 'Select at least one request or group.',
    empty: 'No groups yet.'
  }
};

void i18n.use(initReactI18next).init({
  resources: { es: { translation: es }, en: { translation: en } },
  lng: 'es',
  fallbackLng: 'es',
  interpolation: { escapeValue: false }
});

export default i18n;
