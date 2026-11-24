const DB_NAME = 'gnc-kumo-offline'
const STORE_NAME = 'documents'
const DB_VERSION = 1

export type OfflineDocument = {
  id: string
  title: string
  blob: Blob
  savedAt: string
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function saveOfflineDocument(
  id: string,
  title: string,
  blob: Blob
): Promise<void> {
  const db = await openDatabase()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    transaction.objectStore(STORE_NAME).put({
      id,
      title,
      blob,
      savedAt: new Date().toISOString()
    })
    transaction.oncomplete = () => {
      db.close()
      resolve()
    }
    transaction.onerror = () => {
      db.close()
      reject(transaction.error)
    }
  })
}

export async function getOfflineDocument(
  id: string
): Promise<OfflineDocument | null> {
  const db = await openDatabase()

  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readonly')
      .objectStore(STORE_NAME).get(id)

    request.onsuccess = () => {
      db.close()
      resolve(request.result || null)
    }
    request.onerror = () => {
      db.close()
      reject(request.error)
    }
  })
}

export async function removeOfflineDocument(id: string): Promise<void> {
  const db = await openDatabase()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    transaction.objectStore(STORE_NAME).delete(id)
    transaction.oncomplete = () => {
      db.close()
      resolve()
    }
    transaction.onerror = () => {
      db.close()
      reject(transaction.error)
    }
  })
}

export async function listOfflineDocuments(): Promise<OfflineDocument[]> {
  const db = await openDatabase()

  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readonly')
      .objectStore(STORE_NAME).getAll()

    request.onsuccess = () => {
      db.close()
      resolve(request.result || [])
    }

    request.onerror = () => {
      db.close()
      reject(request.error)
    }
  })
}
