// ============ core.js：性能 + 保活 ============

// 1. 打开聊天：立即渲染
window.openChat = function(id) {
  currentFriend = state.friends.find(f=>f.id===id)||state.friends[0];
  if(!currentFriend){showToast('没有好友');return;}
  if(!Array.isArray(currentFriend.chat)) currentFriend.chat=[];
  currentFriend.unread=0;
  $('chatName').textContent = currentFriend.name;
  $('chatId').textContent = 'ID：' + currentFriend.uid;
  let ca = $('chatAvatar');
  if (isImgAvatar(currentFriend.avatar)) ca.innerHTML = '<img src="'+currentFriend.avatar+'" alt="">';
  else ca.textContent = (currentFriend.avatar || currentFriend.name || '?').toString().charAt(0);
  renderBubbles(); applyChatBg(); applyDecorationToChat(); showPage('chat');
};

// 2. 发消息：只追加一条气泡（治卡顿核心）
(function(){
  if (window.__fastSend) return;
  window.__fastSend = true;
  function E(s){ return typeof esc === 'function' ? esc(s) : String(s); }
  function meAv(){ return typeof meAvatarHtml === 'function' ? meAvatarHtml() : '<div class="avatarSmall">我</div>'; }
  function friAv(f){ return typeof avatarHtml === 'function' ? avatarHtml(f.avatar, 'avatarSmall', f.name ? f.name[0] : '?') : ''; }
  function fmtTime(t){
    if (!state || !state.chatSettings) return '';
    if (state.chatSettings.timeFormat === 'hide' || !t) return '';
    if (typeof t === 'number') {
      const d = new Date(t);
      const hh = String(d.getHours()).padStart(2,'0'), mi = String(d.getMinutes()).padStart(2,'0'), se = String(d.getSeconds()).padStart(2,'0');
      return state.chatSettings.timeFormat === 'minutes' ? hh+':'+mi : hh+':'+mi+':'+se;
    }
    return String(t);
  }
  function append(m, idx){
    const b = document.getElementById('bubbles'); if (!b) return;
    const q = m.quote ? '<div class="quoteBubble">↩ ' + E(m.quote) + '</div>' : '';
    const inner = m.image ? '<img class="sticker" src="'+m.image+'" style="cursor:pointer">' : E(m.text);
    const t = fmtTime(m.time);
    const html = '<div class="bubbleRow me" data-idx="'+idx+'"><div class="msgWrap"><div class="bubble'+(m.image?' stickerBubble':'')+'" data-idx="'+idx+'">'+q+inner+'</div></div><div class="avatarCol">'+meAv()+(t?'<div class="bubbleMeta">'+t+'</div>':'')+'</div></div>';
    const tmp = document.createElement('div'); tmp.innerHTML = html;
    b.appendChild(tmp.firstChild);
    requestAnimationFrame(function(){ b.scrollTop = b.scrollHeight; });
  }
  function typing(f){
    const b = document.getElementById('bubbles'); if (!b) return;
    let t = document.getElementById('typingIndicator');
    if (!t) { t = document.createElement('div'); t.id = 'typingIndicator'; t.className = 'bubbleRow'; }
    t.innerHTML = '<div class="avatarCol">'+friAv(f)+'</div><div class="msgWrap"><div class="bubble typing"><span class="dotting"></span><span class="dotting"></span><span class="dotting"></span></div></div>';
    b.appendChild(t);
    requestAnimationFrame(function(){ b.scrollTop = b.scrollHeight; });
  }
  function doSend(){
    const input = document.getElementById('msgInput'); if (!input) return;
    const txt = input.value.trim(); if (!txt || !currentFriend) return;
    const msg = { who:'me', text: txt, time: Date.now() };
    if (window._pendingQuote) { msg.quote = window._pendingQuote; if (typeof clearPendingQuote === 'function') clearPendingQuote(); }
    currentFriend.chat.push(msg); input.value = '';
    if (typeof save === 'function') save();
    append(msg, currentFriend.chat.length - 1);
    const f = currentFriend;
    clearTimeout(f._cardTimer); clearTimeout(f._typingTimer);
    const cs = state.chatSettings || {};
    const min = Math.max(1, +cs.min || 30), max = Math.max(min, +cs.max || 120);
    const delay = (min + Math.random() * (max - min)) * 1000;
    f._typing = true; typing(f);
    f._typingTimer = setTimeout(function(){
      if (currentFriend !== f) return;
      f._typing = false;
      if (typeof runCardPopup === 'function') runCardPopup(f);
    }, delay);
  }
  document.addEventListener('click', function(e){
    const btn = e.target.closest('#chat .composer .send'); if (!btn) return;
    e.preventDefault(); e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    doSend();
  }, true);
  document.addEventListener('keydown', function(e){
    if (e.key !== 'Enter' || e.isComposing || e.keyCode === 229) return;
    if (!e.target.closest('#msgInput')) return;
    e.preventDefault(); e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    doSend();
  }, true);
})();
// 4. 锁横向滑动
(function() {
  const s = document.createElement('style');
  s.textContent = `
    #bubbles{overflow-x:hidden!important;touch-action:pan-y!important;overscroll-behavior-x:none!important;max-width:100%!important;width:100%!important}
    #bubbles .bubbleRow,#bubbles .msgWrap,#bubbles .bubble{max-width:100%!important;min-width:0!important}
    #bubbles img{max-width:100%!important;height:auto}
    html,body,.app{overflow-x:hidden!important;max-width:100vw!important}
  `;
  document.head.appendChild(s);
})();

// 5. 时间显示修复
(function() {
  function fmt(str) {
    if (!str) return str;
    const s = String(str).trim();
    if (!/^\d+$/.test(s)) return str;
    let n = Number(s); if (isNaN(n)) return str;
    let ms; if (s.length >= 12) ms = n; else if (s.length >= 9) ms = n*1000; else return str;
    const d = new Date(ms); if (isNaN(d.getTime())) return str;
    const y = d.getFullYear(); if (y<2000||y>2100) return str;
    const hh = String(d.getHours()).padStart(2,'0'), mi = String(d.getMinutes()).padStart(2,'0');
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return hh+':'+mi;
    const ye = new Date(now); ye.setDate(now.getDate()-1);
    if (d.toDateString() === ye.toDateString()) return '昨天';
    return String(d.getMonth()+1).padStart(2,'0')+'/'+String(d.getDate()).padStart(2,'0');
  }
  function fix() {
    document.querySelectorAll('#chatList .value').forEach(el => { const t=el.textContent.trim(); const f=fmt(t); if(f!==t) el.textContent=f; });
    document.querySelectorAll('#bubbles .bubbleMeta').forEach(el => { const t=el.textContent.trim(); const f=fmt(t); if(f!==t) el.textContent=f; });
  }
  const obs = new MutationObserver(fix);
  setTimeout(() => {
    const a = document.getElementById('chatList'), b = document.getElementById('bubbles');
    if (a) obs.observe(a, {childList:true, subtree:true, characterData:true});
    if (b) obs.observe(b, {childList:true, subtree:true, characterData:true});
    fix();
  }, 2000);
})();

// 6. 聊天自动滚到底
(function() {
  if (window.__scrollFix) return;
  window.__scrollFix = true;
  function attach() {
    const b = document.getElementById('bubbles');
    if (!b || b._so) return;
    b._so = true;
    let atBottom = true;
    b.addEventListener('scroll', () => { atBottom = (b.scrollHeight - b.scrollTop - b.clientHeight) < 80; }, {passive:true});
    const obs = new MutationObserver(() => { if (atBottom) requestAnimationFrame(() => { b.scrollTop = b.scrollHeight; }); });
    obs.observe(b, {childList:true, subtree:true});
  }
  setTimeout(attach, 1500);
  setInterval(attach, 2000);
})();

// 7. 保活（真实静音 WAV）
(function(){
  function genSilentWav(sec) {
    const sr = 8000, n = Math.floor(sr * sec);
    const buf = new ArrayBuffer(44 + n), v = new DataView(buf);
    function ws(o, s) { for (let i = 0; i < s.length; i++) v.setUint8(o+i, s.charCodeAt(i)); }
    ws(0,'RIFF'); v.setUint32(4,36+n,true); ws(8,'WAVE'); ws(12,'fmt ');
    v.setUint32(16,16,true); v.setUint16(20,1,true); v.setUint16(22,1,true);
    v.setUint32(24,sr,true); v.setUint32(28,sr,true); v.setUint16(32,1,true); v.setUint16(34,8,true);
    ws(36,'data'); v.setUint32(40,n,true);
    for (let i = 0; i < n; i++) v.setUint8(44+i, 128);
    return new Blob([buf], {type:'audio/wav'});
  }
  window.startKeepAlive = function() {
    if (window.keepAliveAudio && !window.keepAliveAudio.paused) return;
    try {
      if (window.keepAliveAudio) { try { window.keepAliveAudio.pause(); } catch(e){} }
      const url = URL.createObjectURL(genSilentWav(2));
      window.keepAliveAudio = new Audio(url);
      window.keepAliveAudio.loop = true;
      window.keepAliveAudio.volume = 0.01;
      window.keepAliveAudio.setAttribute('playsinline', 'true');
      window.keepAliveAudio.play().catch(()=>{});
      if ('mediaSession' in navigator) {
        try {
          const t = localStorage.getItem('mt') || 'ievan';
          const s = localStorage.getItem('ms') || '在线';
          navigator.mediaSession.metadata = new MediaMetadata({
            title: t, artist: s, album: '聊天保活',
            artwork: [{src:'icon-192.PNG', sizes:'192x192', type:'image/png'}]
          });
          navigator.mediaSession.playbackState = 'playing';
        } catch(e){}
      }
    } catch(e) {}
  };
  document.addEventListener('click', function(){ if (typeof startKeepAlive === 'function') startKeepAlive(); }, true);
  document.addEventListener('touchstart', function(){ if (typeof startKeepAlive === 'function') startKeepAlive(); }, {passive:true, capture:true});
})();

console.log('✅ core.js 已加载');
