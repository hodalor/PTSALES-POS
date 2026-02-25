import { openDB } from 'idb';

const DB_NAME = 'ptSalesOffline';
const STORE = 'queue';

let syncing = false;

async function getDb() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
      }
    }
  });
}

export async function enqueue(type, payload) {
  const db = await getDb();
  const ts = Date.now();
  return db.add(STORE, { type, payload, ts });
}

export async function getAll() {
  const db = await getDb();
  return db.getAll(STORE);
}

export async function clear() {
  const db = await getDb();
  const tx = db.transaction(STORE, 'readwrite');
  await tx.store.clear();
  await tx.done;
}

export async function remove(id) {
  const db = await getDb();
  await db.delete(STORE, id);
}

export async function attemptSync(syncHandler) {
  if (syncing) return false;
  syncing = true;
  try {
    const items = await getAll();
    const results = await Promise.allSettled(
      items.map(async item => {
        await syncHandler(item);
        await remove(item.id);
        return true;
      })
    );
    return results.every(r => r.status === 'fulfilled');
  } finally {
    syncing = false;
  }
}
