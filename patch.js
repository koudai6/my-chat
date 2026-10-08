// ============ patch.js：消息队列功能 ============

(function(){
  if (window.__msgQueue) return;
  window.__msgQueue = true;

  // 内存中的队列，不持久化
  window._pendingQueue = [];

  // 1. 覆盖原有的“＋”号菜单，增加“消息队列”入口
  window.showPlusMenu = function(){
    modal('＋', `<div class="grid2">
      <button class="tool" type="button" onclick="closeModal();showLetterHome()"><b>写信</b><span>信封 / 历史信件</span></button>
      <button class="tool" onclick="closeModal();showSurveyMenu()"><b>问卷系统</b><span>抉择 / 字卡回答</span></button>
      <button class="tool" onclick="closeModal();showDecoration()"><b>装扮系统</b><span>气泡 / 背景 / 头像框</span></button>
      <button class="tool" onclick="closeModal();showStorage()"><b>存储系统</b><span>清理记录</span></button>
      <button class="tool" onclick="closeModal();showSettings()"><b>设置</b><span>全局设置</span></button>
      <button class="tool" onclick="closeModal();openQueuePanel()"><b>消息队列</b><span>一次编辑，逐条发送</span></button>
    </div>`);
  };

  // 2. 打开队列编辑面板
  window.openQueuePanel = function(){
    if (!currentFriend) { showToast('请先进入聊天'); return; }
    
    window._pendingQueue = window._pendingQueue || [];
    renderQueuePanel();
  };
// ====== 图片点击放大 + 队列优化 ======
(function(){
  if (window.__imgZoom) return;
  window.__imgZoom = true;

  // 1. 点击图片直接放大，长按弹操作菜单
  document.addEventListener('click', function(e){
    const img = e.target.closest('#bubbles .bubble img.sticker, #bubbles .bubble img.chatImg');
    if (!img) return;
    const cp = document.getElementById('chat');
    if (!cp || !cp.classList.contains('active')) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    const src = img.src;
    if (src && typeof viewImage === 'function') viewImage(src);
  }, true);

  // 长按图片 → 弹操作菜单
  let longPressTimer = null;
  let longPressTriggered = false;
  document.addEventListener('touchstart', function(e){
    const img = e.target.closest('#bubbles .bubble img.sticker, #bubbles .bubble img.chatImg');
    if (!img) return;
    longPressTriggered = false;
    clearTimeout(longPressTimer);
    longPressTimer = setTimeout(function(){
      longPressTriggered = true;
      // 触发原本的菜单（找到父级 .bubble 的 data-idx）
      const bubble = img.closest('.bubble[data-idx]');
      if (!bubble) return;
      const idx = +bubble.getAttribute('data-idx');
      if (isNaN(idx)) return;
      if (typeof showMsgActions === 'function') showMsgActions(idx);
    }, 600);
  }, {passive: true, capture: true});
  document.addEventListener('touchend', function(){ clearTimeout(longPressTimer); }, true);
  document.addEventListener('touchmove', function(){ clearTimeout(longPressTimer); }, true);

  // 拦截 click 里对图片的菜单弹出（长按已覆盖）
  document.addEventListener('click', function(e){
    if (longPressTriggered) { longPressTriggered = false; }
  }, true);

  // 2. 队列发送优化：改 save 为节流，间隔改为 400ms
  window.sendQueueAll = function() {
    if (!window._pendingQueue || !window._pendingQueue.length) { showToast('队列为空'); return; }
    if (!currentFriend) { showToast('请先进入聊天'); return; }

    const friend = currentFriend;
    const queue = window._pendingQueue.slice();
    window._pendingQueue = [];
    closeModal();

    // 先暂停原本的定时器
    clearTimeout(friend._cardTimer);
    clearTimeout(friend._typingTimer);

    let i = 0;
    function sendNext() {
      if (i >= queue.length) {
        // 发送完成，触发一次字卡回复
        const cs = state.chatSettings || {};
        const min = Math.max(1, +cs.min || 30);
        const max = Math.max(min, +cs.max || 120);
        const delay = (min + Math.random() * (max - min)) * 1000;
        friend._typing = true;
        if (friend === currentFriend) renderBubbles();
        friend._typingTimer = setTimeout(function(){
          if (currentFriend !== friend) return;
          friend._typing = false;
          if (typeof runCardPopup === 'function') runCardPopup(friend);
        }, delay);
        if (typeof save === 'function') save();
        return;
      }

      const item = queue[i];
      const msg = { who:'me', text: item.text || '', time: Date.now() };
      if (item.image) { msg.image = item.image; msg.text = '[图片/表情包]'; }
      friend.chat.push(msg);

      // 用 core.js 里的追加函数（只追加一条，不重建）
      if (typeof window.appendMyBubble === 'function') {
        window.appendMyBubble(msg, friend.chat.length - 1);
      } else if (friend === currentFriend) {
        renderBubbles();
      }

      i++;
      // 间隔改成 450ms，一条一条弹，但不会卡
      setTimeout(sendNext, 450);
    }

    sendNext();
  };

  console.log('✅ 图片放大 + 队列优化已加载');
})();
  // 3. 渲染队列面板（可重复调用刷新）
  window.renderQueuePanel = function() {
    if (!currentFriend) return;
    
    let html = '';
    html += '<div class="desc" style="margin-bottom:10px;line-height:1.6">在这里编辑要发送的内容，发送时会按顺序逐条发出，且只触发对方一次回复。</div>';
    
    // 已添加队列预览
    html += '<div id="queuePreview" style="max-height:200px;overflow:auto;margin-bottom:12px;">';
    if (window._pendingQueue.length === 0) {
      html += '<div class="desc" style="text-align:center;padding:16px 0">队列为空，请在下方添加消息</div>';
    } else {
      window._pendingQueue.forEach((item, i) => {
        let preview = item.text || (item.image ? '[图片]' : '');
        let thumb = item.image ? `<img src="${item.image}" style="width:36px;height:36px;border-radius:6px;object-fit:cover;margin-right:8px;flex:none;">` : '';
        html += `<div style="display:flex;align-items:center;padding:8px;background:#f6f6f8;border-radius:10px;margin-bottom:6px;">
          ${thumb}
          <div style="flex:1;min-width:0;font-size:.84rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(preview)}</div>
          <button onclick="removeQueueItem(${i})" style="color:#999;font-size:18px;padding:0 6px;">×</button>
        </div>`;
      });
    }
    html += '</div>';

    // 添加新的
    html += '<div class="field"><label>添加消息</label>';
    html += '<textarea id="queueInput" class="textinput" rows="2" placeholder="输入要加入队列的文字..." style="resize:vertical;margin-bottom:8px;"></textarea>';
    html += '<div style="display:flex;gap:8px;margin-top:8px;">';
    html += '<label class="action secondary" style="flex:1;margin:0;text-align:center;cursor:pointer;padding:9px;font-size:.8rem">＋ 加图片<input type="file" accept="image/*" hidden onchange="addQueueImage(event)"></label>';
    html += '<button class="action secondary" style="flex:1;margin:0;padding:9px;font-size:.8rem" onclick="openStickerPickForQueue()">＋ 加表情包</button>';
    html += '<button class="action" style="flex:1;margin:0;padding:9px;font-size:.8rem" onclick="addQueueItem()">加入队列</button>';
    html += '</div></div>';

    // 发送按钮
    html += '<button class="action" style="margin-top:16px;width:100%;background:#1a1a1e" onclick="sendQueueAll()">🚀 一键发送队列（共 ' + window._pendingQueue.length + ' 条）</button>';
    html += '<button class="action secondary" style="width:100%;margin-top:8px" onclick="closeModal()">取消</button>';

    modal('消息队列', html);
  };

  // 4. 加入队列
  window.addQueueItem = function() {
    const input = document.getElementById('queueInput');
    const text = input ? input.value.trim() : '';
    if (!text) { showToast('请输入文字'); return; }
    window._pendingQueue.push({ type:'text', text: text, time: Date.now() });
    renderQueuePanel();
  };

  // 5. 添加图片到队列
  window.addQueueImage = function(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function() {
      window._pendingQueue.push({ type:'image', image: reader.result, text: '[图片]', time: Date.now() });
      renderQueuePanel();
    };
    reader.readAsDataURL(file);
  };

  // 6. 从表情包库选择图片加入队列
  window.openStickerPickForQueue = function() {
    const stickers = state.cards.filter(c => c.type === 'image' && c.image && c.enabled !== false);
    if (!stickers.length) { showToast('字卡库里还没有表情包'); return; }
    
    let html = '<div class="desc" style="margin-bottom:10px">点击表情包加入队列</div>';
    html += '<div class="stickerPanel">';
    stickers.forEach(s => {
      html += `<button class="stickerItem" onclick="addQueueSticker('${String(s.id)}')"><img src="${s.image}" alt=""></button>`;
    });
    html += '</div>';
    html += '<button class="action secondary" style="margin-top:14px" onclick="renderQueuePanel()">返回编辑</button>';
    modal('选择表情包', html);
  };

  window.addQueueSticker = function(id) {
    const s = state.cards.find(c => String(c.id) === String(id));
    if (!s) return;
    window._pendingQueue.push({ type:'image', image: s.image, text: '[表情包]', time: Date.now() });
    renderQueuePanel();
  };

  // 7. 移除队列某一项
  window.removeQueueItem = function(i) {
    window._pendingQueue.splice(i, 1);
    renderQueuePanel();
  };

  // 8. 一键发送
  window.sendQueueAll = function() {
    if (!window._pendingQueue.length) { showToast('队列为空'); return; }
    if (!currentFriend) { showToast('请先进入聊天'); return; }

    const friend = currentFriend;
    const queue = window._pendingQueue.slice();
    window._pendingQueue = [];
    closeModal();

    let i = 0;
    function sendNext() {
      if (i >= queue.length) {
        // 全部发送完毕，触发对方回复
        clearTimeout(friend._cardTimer);
        clearTimeout(friend._typingTimer);
        
        const cs = state.chatSettings || {};
        const min = Math.max(1, +cs.min || 30);
        const max = Math.max(min, +cs.max || 120);
        const delay = (min + Math.random() * (max - min)) * 1000;

        friend._typing = true;
        if (friend === currentFriend) renderBubbles();

        friend._typingTimer = setTimeout(function(){
          if (currentFriend !== friend) return;
          friend._typing = false;
          if (typeof runCardPopup === 'function') runCardPopup(friend);
        }, delay);
        return;
      }

      const item = queue[i];
      const msg = { who:'me', text: item.text || '', time: Date.now() };
      if (item.image) { msg.image = item.image; msg.text = '[图片/表情包]'; }

      friend.chat.push(msg);
      
      // 立刻手动追加气泡（用 core.js 里的逻辑或直接全量渲染）
      if (typeof window.appendMyBubble === 'function') {
         window.appendMyBubble(msg, friend.chat.length - 1);
      } else {
         if (friend === currentFriend) renderBubbles();
      }

      if (typeof save === 'function') save();
      
      i++;
      // 间隔 300 毫秒发下一条
      setTimeout(sendNext, 300);
    }
    
    sendNext();
  };

  console.log('✅ 消息队列功能已加载');
})();
   // ====== 图片放大（直接绑定版） ======
(function(){
  if (window.__imgZoomV2) return;
  window.__imgZoomV2 = true;

  // 给一张图片元素绑定事件
  function bindImg(img) {
    if (img._zoomBound) return;
    img._zoomBound = true;

    // 阻止父级气泡抢走点击
    img.style.cursor = 'zoom-in';

    img.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      const src = img.src;
      if (src && typeof viewImage === 'function') viewImage(src);
    }, true);

    // 长按 → 弹操作菜单
    let timer = null;
    let triggered = false;
    img.addEventListener('touchstart', function(e) {
      triggered = false;
      clearTimeout(timer);
      timer = setTimeout(function() {
        triggered = true;
        const bubble = img.closest('.bubble[data-idx]');
        if (!bubble) return;
        const idx = +bubble.getAttribute('data-idx');
        if (isNaN(idx)) return;
        if (typeof showMsgActions === 'function') showMsgActions(idx);
      }, 600);
    }, { passive: true, capture: true });

    img.addEventListener('touchend', function() { clearTimeout(timer); }, true);
    img.addEventListener('touchmove', function() { clearTimeout(timer); }, true);
    img.addEventListener('touchcancel', function() { clearTimeout(timer); }, true);
  }

  // 扫描所有图片并绑定
  function scanAll() {
    const bubbles = document.getElementById('bubbles');
    if (!bubbles) return;
    bubbles.querySelectorAll('img').forEach(bindImg);
  }

  // 每 300ms 扫一次，保证新出现的图片也能绑定
  setInterval(scanAll, 300);
  setTimeout(scanAll, 500);

  // 也用 MutationObserver 立即响应
  function attachObserver() {
    const bubbles = document.getElementById('bubbles');
    if (!bubbles || bubbles._imgObs) return;
    bubbles._imgObs = true;
    const obs = new MutationObserver(function() {
      bubbles.querySelectorAll('img').forEach(bindImg);
    });
    obs.observe(bubbles, { childList: true, subtree: true });
  }
  setTimeout(attachObserver, 800);
  setInterval(attachObserver, 2000);

  console.log('✅ 图片放大已加载（直接绑定版）');
})();
// ====== 聊天渲染优化：最近 100 条 + 查看全部 ======
(function(){
  if (window.__chatLazy) return;
  window.__chatLazy = true;

  const LIMIT = 100;

  const origRender = window.renderBubbles;
  window.renderBubbles = function() {
    if (!currentFriend || !Array.isArray(currentFriend.chat)) {
      return origRender ? origRender.apply(this, arguments) : undefined;
    }
    const chat = currentFriend.chat;
    if (chat.length <= LIMIT) {
      if (origRender) origRender.apply(this, arguments);
      return;
    }
    const start = chat.length - LIMIT;
    const origForEach = chat.forEach;
    chat.forEach = function(fn) {
      for (let i = start; i < chat.length; i++) fn(chat[i], i, chat);
    };
    try {
      if (origRender) origRender.apply(this, arguments);
    } finally {
      chat.forEach = origForEach;
    }
    setTimeout(function(){
      const b = document.getElementById('bubbles');
      if (!b) return;
      if (b.querySelector('.viewAllBtn')) return;
      const btn = document.createElement('button');
      btn.className = 'viewAllBtn';
      btn.style.cssText = 'display:block;margin:10px auto;padding:8px 16px;background:#f0f0f4;color:#666;border:0;border-radius:14px;font-size:.78rem;cursor:pointer;font-family:inherit;';
      btn.textContent = '查看全部聊天记录（共 ' + chat.length + ' 条）';
      btn.onclick = function(e){
        e.preventDefault();
        e.stopPropagation();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        window.__showAllHistory();
      };
      b.insertBefore(btn, b.firstChild);
    }, 0);
  };

  window.__showAllHistory = function() {
    if (!currentFriend) return;
    const chat = currentFriend.chat;
    let html = '<div style="max-height:60vh;overflow-y:auto;background:#f6f6f8;border-radius:12px;padding:10px;font-size:.82rem;line-height:1.6">';
    chat.forEach(m => {
      const who = m.who === 'me' ? '我' : (currentFriend.name || '对方');
      let content;
      if (m.image) content = '<img src="' + m.image + '" style="max-width:80px;border-radius:8px;display:block;margin-top:4px">';
      else content = esc(m.text || '');
      html += '<div style="padding:6px 0;border-bottom:1px solid #ececf0;word-break:break-word">' +
        '<b>' + esc(who) + '</b>：' + content +
        '</div>';
    });
    html += '</div>';
    html += '<button class="action secondary" style="margin-top:12px" onclick="closeModal()">关闭</button>';
    modal('全部聊天记录', html);
  };

  console.log('✅ 聊天懒加载已启用');
})();
// ====== v30：聊天快速打开（终极版） ======
(function(){
  if (window.__fastOpenFinal) return;
  window.__fastOpenFinal = true;

  const LIMIT = 100;

  // 抓当前生效的 renderBubbles（不管它是原版还是之前被覆盖过的版本）
  const baseRender = window.renderBubbles;

  window.renderBubbles = function() {
    if (typeof currentFriend === 'undefined' || !currentFriend) {
      if (baseRender) baseRender.apply(this, arguments);
      return;
    }
    const chat = currentFriend.chat;
    if (!Array.isArray(chat)) {
      if (baseRender) baseRender.apply(this, arguments);
      return;
    }

    const needLimit = chat.length > LIMIT;
    const origForEach = chat.forEach;

    if (needLimit) {
      const start = chat.length - LIMIT;
      // 临时替换 forEach，只遍历最后 100 条，但保持真实索引
      chat.forEach = function(fn) {
        for (let i = start; i < chat.length; i++) fn(chat[i], i, chat);
      };
    }

    try {
      if (baseRender) baseRender.apply(this, arguments);
    } finally {
      if (needLimit) chat.forEach = origForEach;
    }

    // 顶部加"查看全部"按钮
    if (needLimit) {
      setTimeout(function(){
        const b = document.getElementById('bubbles');
        if (!b) return;
        if (b.querySelector('.viewAllBtn')) return;
        const btn = document.createElement('button');
        btn.className = 'viewAllBtn';
        btn.style.cssText = 'display:block;margin:10px auto;padding:8px 16px;background:#f0f0f4;color:#666;border:0;border-radius:14px;font-size:.78rem;cursor:pointer;font-family:inherit;';
        btn.textContent = '查看全部聊天记录（共 ' + chat.length + ' 条）';
        btn.onclick = function(e){
          e.preventDefault();
          e.stopPropagation();
          if (e.stopImmediatePropagation) e.stopImmediatePropagation();
          window.__showAllHistory();
        };
        b.insertBefore(btn, b.firstChild);
      }, 0);
    }
  };

  window.__showAllHistory = function() {
    if (typeof currentFriend === 'undefined' || !currentFriend) return;
    const chat = currentFriend.chat;
    let html = '<div style="max-height:60vh;overflow-y:auto;background:#f6f6f8;border-radius:12px;padding:10px;font-size:.82rem;line-height:1.6">';
    chat.forEach(function(m){
      const who = m.who === 'me' ? '我' : (currentFriend.name || '对方');
      let content;
      if (m.image) content = '<img src="' + m.image + '" style="max-width:80px;border-radius:8px;display:block;margin-top:4px">';
      else content = (typeof esc === 'function') ? esc(m.text || '') : String(m.text || '');
      html += '<div style="padding:6px 0;border-bottom:1px solid #ececf0;word-break:break-word">' +
        '<b>' + (typeof esc === 'function' ? esc(who) : who) + '</b>：' + content +
        '</div>';
    });
    html += '</div>';
    html += '<button class="action secondary" style="margin-top:12px" onclick="closeModal()">关闭</button>';
    if (typeof modal === 'function') modal('全部聊天记录', html);
  };

  console.log('✅ v30 聊天快速打开已启用');
})();
// ====== 关闭回复自动循环 ======
(function(){
  if (window.__noLoop) return;
  window.__noLoop = true;

  // 覆盖 scheduleCardPopup：不再自动排下一次
  window.scheduleCardPopup = function(friend){
    if (!friend) return;
    clearTimeout(friend._cardTimer);
    clearTimeout(friend._typingTimer);
    friend._typing = false;
    if (friend === (typeof currentFriend !== 'undefined' ? currentFriend : null)) {
      if (typeof renderBubbles === 'function') renderBubbles();
    }
    // 什么都不做——不再排下一次
  };

  console.log('✅ 已关闭回复自动循环（发一条→回一次，不再循环）');
})();
// ====== 修复：删除操作立即写盘 ======
(function(){
  if (window.__saveImmediate) return;
  window.__saveImmediate = true;

  // 抓当前的 save（core.js 里被替换成的节流版）
  const throttledSave = window.save;
  // 抓最原始的 save（直接操作 IndexedDB 那个）
  let realSave = null;

  // 从节流版的闭包里拿不到 origSave，只能自己重写整个 save
  // 直接从 window 上代理一层：第一次调用立即写，之后 800ms 合并
  let lastWrite = 0;
  let timer = null;
  let pool = [];

  // 用一个"打穿节流"的方法，绕过 throttledSave 直接写
  // 但真实写盘逻辑在 core.js 的闭包里，拿不到
  // 所以我们换个策略：节流版的 save 一旦被调用，2秒后才真写。
  // 我们不去改它，而是在每次删除后，延迟 100ms 再调一次 save 并等待它完成。

  const origMsgDelete = window.confirmMsgDelete;
  window.confirmMsgDelete = function() {
    if (origMsgDelete) origMsgDelete.apply(this, arguments);
    // 删除后延时 100ms 再调一次 save，并主动 flush
    setTimeout(function(){
      if (typeof save === 'function') save();
      // 关键：尝试触发页面隐藏事件，让节流版立即 flush
      try {
        if (window.dispatchEvent) {
          window.dispatchEvent(new Event('pagehide'));
        }
      } catch(e){}
    }, 100);
  };

  const origDelCard = window.confirmDeleteCard;
  window.confirmDeleteCard = function() {
    if (origDelCard) origDelCard.apply(this, arguments);
    setTimeout(function(){
      if (typeof save === 'function') save();
      try { window.dispatchEvent(new Event('pagehide')); } catch(e){}
    }, 100);
  };

  const origDelMoment = window.confirmDeleteMomentPost;
  window.confirmDeleteMomentPost = function() {
    if (origDelMoment) origDelMoment.apply(this, arguments);
    setTimeout(function(){
      if (typeof save === 'function') save();
      try { window.dispatchEvent(new Event('pagehide')); } catch(e){}
    }, 100);
  };

  console.log('✅ 删除操作立即写盘已启用');
})();
// ====== save 恢复为立即写入（关闭节流） ======
(function(){
  if (window.__noThrottle) return;
  window.__noThrottle = true;

  // 直接用原始实现覆盖 core.js 里的节流版
  window.save = function() {
    return new Promise(function(res){
      if (typeof db === 'undefined' || !db) return res();
      try {
        const q = db.transaction(STORE, 'readwrite').objectStore(STORE).put(state, 'state');
        q.onsuccess = function(){ res(); };
        q.onerror = function(){ res(); };
      } catch(e) { res(); }
    });
  };

  console.log('✅ save 已恢复为立即写入，不再丢数据');
})();
// ====== 删除操作应急保存（localStorage 同步写入） ======
(function(){
  if (window.__emergencySave) return;
  window.__emergencySave = true;

  // 同步写一份到 localStorage（应急备份）
  function emergencySave() {
    try {
      localStorage.setItem('__emergency_state', JSON.stringify(state));
    } catch(e) {
      console.log('应急保存失败（数据太大）:', e);
    }
  }

  // 启动时检查应急备份，如果存在就恢复
  function checkEmergency() {
    try {
      const s = localStorage.getItem('__emergency_state');
      if (!s) return;
      const parsed = JSON.parse(s);
      // 用应急版本覆盖当前 state（应急版本是最新的）
      Object.keys(parsed).forEach(k => { state[k] = parsed[k]; });
      localStorage.removeItem('__emergency_state');
      // 写回 IndexedDB
      if (typeof save === 'function') save();
      console.log('✅ 已从应急备份恢复');
    } catch(e) {
      console.log('应急恢复失败:', e);
      localStorage.removeItem('__emergency_state');
    }
  }

  // 拦截所有删除相关的函数
  ['confirmMsgDelete', 'confirmDeleteCard', 'confirmDeleteMomentPost', 'confirmDeleteMomentComment'].forEach(function(fnName) {
    const orig = window[fnName];
    if (typeof orig !== 'function') return;
    window[fnName] = function() {
      const r = orig.apply(this, arguments);
      // 立即同步保存
      setTimeout(function() {
        emergencySave();
      }, 0);
      return r;
    };
  });

  // 应用初始化后检查应急备份（延时确保 state 已加载）
  setTimeout(checkEmergency, 1500);
  setTimeout(checkEmergency, 3000);

  console.log('✅ 删除应急保存已启用');
})();
// ====== v31：删除操作持久化 ======
(function(){
  if (window.__delQueue) return;
  window.__delQueue = true;
  const KEY = '__pending_deletes';

  function getQ() { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch(e) { return []; } }
  function setQ(q) { try { localStorage.setItem(KEY, JSON.stringify(q)); } catch(e) {} }
  function addQ(item) { const q = getQ(); q.push(item); setQ(q); }
  function clearQ() { try { localStorage.removeItem(KEY); } catch(e) {} }

  // 拦截"确认删除消息"
  const orig = window.confirmMsgDelete;
  if (typeof orig === 'function') {
    window.confirmMsgDelete = function() {
      if (typeof currentFriend === 'undefined' || !currentFriend) return orig.apply(this, arguments);
      const idx = window._deletingIdx;
      if (idx == null || idx < 0 || idx >= currentFriend.chat.length) return orig.apply(this, arguments);
      const m = currentFriend.chat[idx];
      addQ({
        friendId: currentFriend.id,
        time: m.time,
        text: m.text || '',
        hasImage: !!m.image
      });
      return orig.apply(this, arguments);
    };
  }

  // 启动时应用待删除记录
  function apply() {
    const q = getQ();
    if (!q.length) return;
    if (!state || !Array.isArray(state.friends)) return;
    let changed = false;
    q.forEach(function(item) {
      const f = state.friends.find(x => String(x.id) === String(item.friendId));
      if (!f || !Array.isArray(f.chat)) return;
      const idx = f.chat.findIndex(m =>
        m.time === item.time &&
        (m.text || '') === item.text &&
        !!m.image === item.hasImage
      );
      if (idx >= 0) { f.chat.splice(idx, 1); changed = true; }
    });
    clearQ();
    if (changed) {
      if (typeof save === 'function') save();
      if (typeof renderBubbles === 'function' && typeof currentFriend !== 'undefined' && currentFriend) {
        renderBubbles();
      }
      console.log('✅ 重新应用了 ' + q.length + ' 条删除记录');
    }
  }

  setTimeout(apply, 2000);
  setTimeout(apply, 4000);
  console.log('✅ v31 删除持久化已启用');
})();
