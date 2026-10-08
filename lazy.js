// ============ lazy.js：聊天快速打开 + 关闭回复循环 ============

// 1. 长聊天记录只渲染最近 100 条
(function(){
  if (window.__chatLazyFinal) return;
  window.__chatLazyFinal = true;
  const LIMIT = 100;
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
      chat.forEach = function(fn) {
        for (let i = start; i < chat.length; i++) fn(chat[i], i, chat);
      };
    }
    try {
      if (baseRender) baseRender.apply(this, arguments);
    } finally {
      if (needLimit) chat.forEach = origForEach;
    }
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
      html += '<div style="padding:6px 0;border-bottom:1px solid #ececf0;word-break:break-word"><b>' + (typeof esc === 'function' ? esc(who) : who) + '</b>：' + content + '</div>';
    });
    html += '</div><button class="action secondary" style="margin-top:12px" onclick="closeModal()">关闭</button>';
    if (typeof modal === 'function') modal('全部聊天记录', html);
  };

  console.log('✅ lazy.js：聊天快速打开已加载');
})();

// 2. 关闭"回复后自动排下一次"
(function(){
  if (window.__noLoop) return;
  window.__noLoop = true;
  window.scheduleCardPopup = function(friend){
    if (!friend) return;
    clearTimeout(friend._cardTimer);
    clearTimeout(friend._typingTimer);
    friend._typing = false;
    if (typeof currentFriend !== 'undefined' && friend === currentFriend) {
      if (typeof renderBubbles === 'function') renderBubbles();
    }
  };
  console.log('✅ lazy.js：回复不再自动循环');
})();
