/* ============================================================
   PhotoChange — 会话存储（ES module）
   IndexedDB 读写：编辑中的位图 + 参数快照，刷新/误关后可恢复。
   过期判断（7 天）由调用方负责。
   ============================================================ */
const DB_NAME = "photochange";
const STORE = "session";

function idbOpen() {
  return new Promise(function (resolve, reject) {
    var rq = indexedDB.open(DB_NAME, 1);
    rq.onupgradeneeded = function () { rq.result.createObjectStore(STORE); };
    rq.onsuccess = function () { resolve(rq.result); };
    rq.onerror = function () { reject(rq.error); };
  });
}

export function sessionPut(record) {
  idbOpen().then(function (db) {
    db.transaction(STORE, "readwrite").objectStore(STORE).put(record, "last");
  }).catch(function () {});
}

export function sessionGet() {
  return idbOpen().then(function (db) {
    return new Promise(function (resolve) {
      var rq = db.transaction(STORE, "readonly").objectStore(STORE).get("last");
      rq.onsuccess = function () { resolve(rq.result || null); };
      rq.onerror = function () { resolve(null); };
    });
  }).catch(function () { return null; });
}

export function sessionClear() {
  idbOpen().then(function (db) {
    db.transaction(STORE, "readwrite").objectStore(STORE).delete("last");
  }).catch(function () {});
}
