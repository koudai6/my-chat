// ============ patch.js：可靠的保存 ============
(function(){
  if (window.__finalSave) return;
  window.__finalSave = true;
  const LS_KEY = '__chat_state_final';

  function install() {
    if (typeof db === 'undefined' || !db || !window.state) {
      setTimeout(install, 500);
      return;
    }

    window.save = function() {
      // 1. 同步写 localStorage（保证杀 App 也不丢）
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(state));
      } catch(e) {
        console.log('localStorage 写入失败（可能数据太大）:', e.message);
      }
      // 2. 异步写 IndexedDB
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

    // 启动时：如果 localStorage 有数据，用它覆盖 state 并写回 IndexedDB
    setTimeout(function(){
      try {
        const raw = localStorage.getItem(LS_KEY);
        if (!raw) return;
        const saved = JSON.parse(raw);
        if (!saved || typeof saved !== 'object') return;
        // 只在 localStorage 数据确实有效时覆盖
        if (saved.friends && Array.isArray(saved.friends)) {
          Object.keys(saved).forEach(function(k){ state[k] = saved[k]; });
          window.save();
          if (typeof renderChats === 'function') renderChats();
          if (typeof renderContacts === 'function') renderContacts();
          console.log('✅ 已从 localStorage 恢复');
        }
      } catch(e) {
        console.log('恢复失败:', e);
      }
    }, 2000);
  }

  install();
  console.log('✅ 最终版 save 已启用');
})();

  
