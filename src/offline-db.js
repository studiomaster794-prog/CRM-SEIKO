const DB = 'seiko-crm'
const STORE = 'kv'

function abrir() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function lerEstado() {
  const db = await abrir()
  try {
    return await new Promise((resolve, reject) => {
      const q = db.transaction(STORE, 'readonly').objectStore(STORE).get('estado')
      q.onsuccess = () => resolve(q.result || null)
      q.onerror = () => reject(q.error)
    })
  } finally {
    db.close()
  }
}

export async function gravarEstado(estado) {
  const db = await abrir()
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(estado, 'estado')
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } finally {
    db.close()
  }
}
