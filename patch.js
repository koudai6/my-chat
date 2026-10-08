// ============ patch.js：图片分离存储 ============
(function(){
  if (window.__imgSep) return;
  window.__imgSep = true;
  const LS_KEY = '__chat_state_v4';
  const IMG_DB = 'chat_images_v1';
  const IMG_STORE = 'images';
  let imgDB = null;

  function openImgDB() {
    return new Promise(function(resolve) {
      if (imgDB) return resolve();
      try {
        const r = indexedDB.open(IMG_DB, 1);
        r.onupgradeneeded = function(e) { e.target.result.createObjectStore(IMG_STORE); };
        r.onsuccess = function(e) { imgDB = e.target.result; resolve(); };
        r.onerror = function() { resolve(); };
      } catch(e) { resolve(); }
    });
  }

  function hashStr(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36) + '_' + s.length.toString(36);
  }

  function putImg(hash, data) {
    return new Promise(function(resolve) {
      if (!imgDB) return resolve();
      try {
        const tx = imgDB.transaction(IMG_STORE, 'readwrite');
        tx.objectStore(IMG_STORE).put(data, hash);
        tx.oncomplete = function() { resolve(); };
        tx.onerror = function() { resolve(); };
      } catch(e) { resolve(); }
    });
  }

  function getImg(hash) {
    return new Promise(function(resolve) {
      if (!imgDB) return resolve(null);
      try {
        const tx = imgDB.transaction(IMG_STORE, 'readonly');
        const q = tx.objectStore(IMG_STORE).get(hash);
        q.onsuccess = function() { resolve(q.result || null); };
        q.onerror = function() { resolve(null); };
      } catch(e) { resolve(null); }
    });
  }

  function walkImages(obj, cb) {
    const seen = new Set();
    (function walk(node) {
      if (!node || typeof node !== 'object' || seen.has(node)) return;
      seen.add(node);
      if (Array.isArray(node)) { node.forEach(walk); return; }
      Object.keys(node).forEach(function(k) {
        const val = node[k];
        if (k === 'image' && typeof val === 'string') {
          if (val.indexOf('data:') === 0) cb(node, k, val, 'base64');
          else if (val.indexOf('__IMG__') === 0) cb(node, k, val.slice(7), 'hash');
        } else if (val && typeof val === 'object') walk(val);
      });
    })(obj);
  }

  function extract(slimState) {
    const tasks = [];
    walkImages(slimState, function(node, key, val, type) {
      if (type === 'base64') {
        const hash = hashStr(val);
        node[key] = '__IMG__' + hash;
        tasks.push(putImg(hash, val));
      }
    });
    return Promise.all(tasks);
  }

  function restore(stateObj) {
    const tasks = [];
    walkImages(stateObj, function(node, key, val, type) {
      if (type === 'hash') {
        tasks.push(getImg(val).then(function(data) {
          if (data) node[key] = data;
        }));
      }
    });
    return Promise.all(tasks);
  }

  function install() {
    if (typeof db === 'undefined' || !db || typeof state === 'undefined' || !state || typeof STORE === 'undefined') {
      setTimeout(install, 500); return;
    }
    openImgDB().then(function() {
      window.save = function() {
        return new Promise(function(resolve) {
          try {
            const slim = JSON.parse(JSON.stringify(state));
            extract(slim).then(function() {
              try { localStorage.setItem(LS_KEY, JSON.stringify(slim)); } catch(e) {
                console.log('localStorage 写失败:', e.message);
              }
              try {
                const tx = db.transaction(STORE, 'readwrite');
                tx.objectStore(STORE).put(slim, 'state');
                tx.oncomplete = function() { resolve(); };
                tx.onerror = function() { resolve(); };
                tx.onabort = function() { resolve(); };
              } catch(e) { resolve(); }
            }).catch(function() { resolve(); });
          } catch(e) { resolve(); }
        });
      };

      let restored = false;
      function checkRestore() {
        if (restored) return;
        let hasHash = false;
        walkImages(state, function(node, key, val, type) { if (type === 'hash') hasHash = true; });
        if (!hasHash) return;
        restore(state).then(function() {
          restored = true;
          if (typeof renderChats === 'function') renderChats();
          if (typeof renderContacts === 'function') renderContacts();
          if (typeof currentFriend !== 'undefined' && currentFriend && typeof renderBubbles === 'function') renderBubbles();
          console.log('✅ 图片已从 IndexedDB 还原');
        });
      }
      setTimeout(checkRestore, 2500);
      setInterval(checkRestore, 3000);
    });
  }

  install();
  console.log('✅ patch.js 图片分离存储已加载');
})();
