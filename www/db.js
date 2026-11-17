/* 本地存储：IndexedDB（所有数据只保存在本机） */
const DB = (() => {
  let dbp;
  function open() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      const r = indexedDB.open('whalechat', 1);
      r.onupgradeneeded = () => {
        const db = r.result;
        if (!db.objectStoreNames.contains('convs')) db.createObjectStore('convs', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return dbp;
  }
  async function tx(store, mode, fn) {
    const db = await open();
    return new Promise((res, rej) => {
      const t = db.transaction(store, mode);
      const s = t.objectStore(store);
      let out;
      Promise.resolve(fn(s)).then(v => { out = v; });
      t.oncomplete = () => res(out);
      t.onerror = () => rej(t.error);
      t.onabort = () => rej(t.error);
    });
  }
  const req = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  return {
    allConvs: () => tx('convs', 'readonly', s => req(s.getAll())),
    getConv: id => tx('convs', 'readonly', s => req(s.get(id))),
    putConv: c => tx('convs', 'readwrite', s => { s.put(c); }),
    putConvs: cs => tx('convs', 'readwrite', s => { cs.forEach(c => s.put(c)); }),
    delConv: id => tx('convs', 'readwrite', s => { s.delete(id); }),
    clearConvs: () => tx('convs', 'readwrite', s => { s.clear(); }),
    get: k => tx('kv', 'readonly', s => req(s.get(k))),
    set: (k, v) => tx('kv', 'readwrite', s => { s.put(v, k); }),
    async persist() { try { if (navigator.storage && navigator.storage.persist) await navigator.storage.persist(); } catch (e) {} },
  };
})();

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
