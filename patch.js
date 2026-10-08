// ============ patch.js：可靠的保存 ============
(function(){
  if (window.__finalSave) return;
  window.__finalSave = true;
  const LS_KEY = '__chat_state_final';

  function install() {
    if (typeof db === 'undefined' || !db || !window.state) { setTimeout(install, 500); return; }

    window.save = function() {
      try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch(e) {}
      return new Promise(function(resolve) {
        try {
          const tx = db.transaction(STORE, 'readwrite');
          tx.objectStore(STORE).put(state, 'state');
          tx.oncomplete = function(){ resolve(); };
          tx.onerror = function(){ resolve(); };
          tx.onabort = function(){ resolve(); };
        } catch(e) { resolve(); }
      });
    };

    setTimeout(function(){
      try {
        const raw = localStorage.getItem(LS_KEY);
        if (!raw) return;
        const saved = JSON.parse(raw);
        if (!saved || typeof saved !== 'object') return;
        if (saved.friends && Array.isArray(saved.friends)) {
          Object.keys(saved).forEach(function(k){ state[k] = saved[k]; });
          window.save();
          if (typeof renderChats === 'function') renderChats();
          if (typeof renderContacts === 'function') renderContacts();
        }
      } catch(e) {}
    }, 2000);
  }
  install();
})();

console.log('✅ patch.js 已加载');
