const databaseName = 'offline-requests';
const databaseVersion = 1;

export const stores = {
  requests: 'requests',
  groups: 'groups',
  meta: 'meta'
} as const;

let connection: Promise<IDBDatabase> | null = null;

export function openDatabase(): Promise<IDBDatabase> {
  if (!connection) {
    connection = new Promise<IDBDatabase>((resolve, reject) => {
      const open = indexedDB.open(databaseName, databaseVersion);
      open.onupgradeneeded = () => {
        const database = open.result;
        if (!database.objectStoreNames.contains(stores.requests)) {
          // Every read is scoped to the account that created the row: a shared device must
          // not show one user the queue of another.
          database.createObjectStore(stores.requests, { keyPath: 'id' }).createIndex('owner', 'owner');
        }
        if (!database.objectStoreNames.contains(stores.groups)) {
          database.createObjectStore(stores.groups, { keyPath: 'id' }).createIndex('owner', 'owner');
        }
        if (!database.objectStoreNames.contains(stores.meta)) {
          database.createObjectStore(stores.meta, { keyPath: 'key' });
        }
      };
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error ?? new Error('The browser refused to open the local database'));
      // Another tab still holds an older version, so this one cannot upgrade it.
      open.onblocked = () => reject(new Error('Close the other tabs of this application and try again'));
    }).catch(error => {
      connection = null;
      throw error;
    });
  }
  return connection;
}

/** Turns the event based IndexedDB API into something that can be awaited. */
export function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('The local database rejected an operation'));
  });
}

export async function runTransaction<T>(
  names: string[],
  mode: IDBTransactionMode,
  work: (transaction: IDBTransaction) => Promise<T> | T
): Promise<T> {
  const database = await openDatabase();
  const transaction = database.transaction(names, mode);
  const completed = new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('The local transaction failed'));
    transaction.onabort = () => reject(transaction.error ?? new Error('The local transaction was aborted'));
  });

  try {
    const result = await work(transaction);
    // Waiting for the transaction and not only for the last request is what makes the write durable.
    await completed;
    return result;
  } catch (error) {
    completed.catch(() => {});
    try {
      transaction.abort();
    } catch {
      // It had already finished, so there is nothing left to undo.
    }
    throw error;
  }
}

export function readMeta<T>(key: string): Promise<T | undefined> {
  return runTransaction([stores.meta], 'readonly', async transaction => {
    const entry = await requestResult<{ key: string; value: T } | undefined>(transaction.objectStore(stores.meta).get(key));
    return entry?.value;
  });
}

export function writeMeta<T>(key: string, value: T): Promise<void> {
  return runTransaction([stores.meta], 'readwrite', async transaction => {
    await requestResult(transaction.objectStore(stores.meta).put({ key, value }));
  });
}
