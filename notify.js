// ============ notify.js：通知 + 控制中心名字 ============

// 1. 后台消息通知监听器
(function() {
  if (window.__notifyScanner) return;
  window.__notifyScanner = true;
  const notified = {};

  function init() {
    (state.friends || []).forEach(f => {
      if (!Array.isArray(f.chat) || !f.chat.length) return;
      const l = f.chat[f.chat.length-1]; if (!l) return;
      notified[f.id] = (l.text||'')+'|'+l.time+'|'+(l.image?'img':'');
    });
  }
  function scan() {
    if (!Array.isArray(state.friends)) return;
    state.friends.forEach(f => {
      if (!Array.isArray(f.chat) || !f.chat.length) return;
      const l = f.chat[f.chat.length-1];
      if (!l || l.who !== 'other') return;
      const k = (l.text||'')+'|'+l.time+'|'+(l.image?'img':'');
      if (notified[f.id] === k) return;
      notified[f.id] = k;
      if (typeof currentFriend !== 'undefined' && currentFriend && currentFriend.id === f.id && !document.hidden) return;
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        let body = l.text || (l.image ? '[图片/表情包]' : '');
        if (typeof showNotification === 'function') showNotification(f.name || '新消息', body);
        else if (navigator.serviceWorker && navigator.serviceWorker.ready) {
          navigator.serviceWorker.ready.then(reg => reg.showNotification(f.name || '新消息', {body: body, icon:'icon-192.PNG', tag:'chat-'+f.id})).catch(()=>{});
        }
      }
    });
  }
  setTimeout(() => { init(); setInterval(scan, 3000); }, 2000);
})();

// 2. 后台消息推送卡片
(function() {
  if (window.__pushCard) return;
  window.__pushCard = true;

  function build() {
    const me = document.getElementById('me'); if (!me) { setTimeout(build, 500); return; }
    const old = document.getElementById('notifyBtn');
    if (old) { const oc = old.closest('.section.card'); if (oc) oc.remove(); }
    if (document.getElementById('pushCard')) return;

    const card = document.createElement('div');
    card.className = 'section card'; card.id = 'pushCard';
    const granted = (typeof Notification !== 'undefined' && Notification.permission === 'granted');
    card.innerHTML = '<div class="row" style="align-items:flex-start;padding:14px 13px;gap:10px">' +
      '<div class="icon settingsIcon iconSvg" style="background:#e9e9ec!important;color:#333!important">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:19px;height:19px"><path d="M6 17h12l-1.4-1.8V10a4.6 4.6 0 0 0-9.2 0v5.2L6 17Z"></path><path d="M10 20h4"></path></svg></div>' +
      '<div class="rowmain" id="pushCardText" style="cursor:pointer;line-height:1.5">' +
      '<div class="title" style="font-size:.92rem">' + (granted ? '后台消息推送✅ 已开启' : '后台消息推送 — 点击右侧开关，允许系统通知') + '</div>' +
      '<div class="desc" style="margin-top:4px">点击文字区域可发送一条测试通知</div></div>' +
      '<button class="switch ' + (granted?'on':'') + '" id="pushSwitch"><i></i></button></div>';
    const sc = me.querySelector('.section.card');
    if (sc && sc.nextSibling) me.insertBefore(card, sc.nextSibling); else me.appendChild(card);

    const sw = card.querySelector('#pushSwitch'), tx = card.querySelector('#pushCardText');
    function upd() {
      const ok = Notification.permission === 'granted';
      sw.classList.toggle('on', ok);
      tx.querySelector('.title').textContent = ok ? '后台消息推送✅ 已开启' : '后台消息推送 — 点击右侧开关，允许系统通知';
    }
    function test() {
      if (Notification.permission !== 'granted') { alert('请先开启通知'); return; }
      if (navigator.serviceWorker && navigator.serviceWorker.ready) {
        navigator.serviceWorker.ready.then(reg => reg.showNotification('简约聊天', {body:'这是一条测试通知 ✅', icon:'icon-192.PNG', tag:'test-'+Date.now()})).catch(()=>{});
      } else new Notification('简约聊天', {body:'测试通知 ✅'});
    }
    sw.onclick = function(e) {
      e.stopPropagation();
      if (Notification.permission === 'granted') { alert('关闭请去 iPhone 设置'); return; }
      Notification.requestPermission().then(p => {
        if (p === 'granted') { upd(); if (typeof startKeepAlive === 'function') startKeepAlive(); setTimeout(test, 300); }
        else { alert('已拒绝'); upd(); }
      });
    };
    tx.onclick = test;
  }
  setTimeout(build, 1500);
})();

// 3. 控制中心名字设置
(function(){
  if (window.__mediaName) return;
  window.__mediaName = true;

  function getT(){ return localStorage.getItem('mt') || 'ievan'; }
  function getS(){ return localStorage.getItem('ms') || '在线'; }

  window.__applyMeta = function(){
    if (!('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: getT(), artist: getS(), album: '聊天保活',
        artwork: [{src:'icon-192.PNG', sizes:'192x192', type:'image/png'}]
      });
      navigator.mediaSession.playbackState = 'playing';
    } catch(e){}
  };

  const origStart = window.startKeepAlive;
  window.startKeepAlive = function(){
    if (origStart) origStart();
    setTimeout(window.__applyMeta, 100);
  };

  function buildNameCard(){
    const me = document.getElementById('me');
    if (!me) return;
    if (document.getElementById('mediaNameCard')) return;
    const card = document.createElement('div');
    card.className = 'section card';
    card.id = 'mediaNameCard';
    card.innerHTML =
      '<div class="row" style="cursor:pointer" onclick="window.__editName()">' +
      '<div class="icon settingsIcon iconSvg" style="background:#e9e9ec!important;color:#333!important">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:19px;height:19px"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>' +
      '</div>' +
      '<div class="rowmain"><div class="title">控制中心名字</div><div class="desc" id="mediaNameDesc">' + getT() + ' · ' + getS() + '</div></div>' +
      '<span class="chev">›</span></div>';
    const pushCard = document.getElementById('pushCard');
    if (pushCard && pushCard.nextSibling) me.insertBefore(card, pushCard.nextSibling);
    else me.appendChild(card);
  }

  window.__editName = function(){
    modal('控制中心名字',
      '<div class="desc" style="margin-bottom:12px;line-height:1.6">显示在控制中心和锁屏的媒体卡片上。</div>' +
      '<div class="field"><label>标题（大字）</label><input id="mtInput" class="textinput" maxlength="20" value="' + getT() + '"></div>' +
      '<div class="field"><label>副标题（小字）</label><input id="msInput" class="textinput" maxlength="20" value="' + getS() + '"></div>' +
      '<div style="display:flex;gap:8px;margin-top:14px">' +
      '<button class="action secondary" style="flex:1;margin:0" onclick="closeModal()">取消</button>' +
      '<button class="action" style="flex:1;margin:0" onclick="window.__saveName()">保存</button>' +
      '</div>');
  };

  window.__saveName = function(){
    const t = (document.getElementById('mtInput').value || '').trim() || 'ievan';
    const s = (document.getElementById('msInput').value || '').trim() || '在线';
    localStorage.setItem('mt', t);
    localStorage.setItem('ms', s);
    const d = document.getElementById('mediaNameDesc');
    if (d) d.textContent = t + ' · ' + s;
    window.__applyMeta();
    closeModal();
    if (typeof showToast === 'function') showToast('已保存');
  };

  // 每秒检查一次，保证卡片存在
  setInterval(buildNameCard, 1000);
})();

console.log('✅ notify.js 已加载');
