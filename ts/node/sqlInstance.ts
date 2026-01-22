import { type Database } from '@signalapp/sqlcipher';

let globalInstance: Database | null = null;

export function assertGlobalInstance(): Database {
  if (!globalInstance) {
    throw new Error('globalInstance is not initialized.');
  }
  return globalInstance;
}

export function isInstanceInitialized(): boolean {
  return !!globalInstance;
}

export function assertGlobalInstanceOrInstance(instance?: Database | null): Database {
  // if none of them are initialized, throw
  if (!globalInstance && !instance) {
    throw new Error('neither globalInstance nor initialized is initialized.');
  }
  // otherwise, return which ever is true, priority to the global one
  return globalInstance || (instance as Database);
}

export function initDbInstanceWith(instance: Database) {
  if (globalInstance) {
    throw new Error('already init');
  }
  globalInstance = instance;
}

export function closeDbInstance() {
  if (!globalInstance) {
    return;
  }

  const dbRef = globalInstance;
  globalInstance = null;
  // SQlite documentation suggests that we run `PRAGMA optimize` right before
  // closing the database connection.
  dbRef.pragma('optimize');
  dbRef.close();
}
