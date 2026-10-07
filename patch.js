// ============ 字卡导入 ============
window.restoreBackup = function() {
  let input = document.createElement('input');
  input.type = 'file'; input.accept = '.json,application/json';
  input.onchange = () => {
    let f = input.files && input.files[0]; if (!f) return;
    let r = new FileReader();
    r.onload = () => {
      try {
        let data = JSON.parse(r.result);
        if (data && (data.customReplyGroups || data.customReplies)) { window.importExternalGroupedBackup(data); return; }
        let kind = '';
        if (Array.isArray(data)) {
          if (data.length > 0 && (data[0].text !== undefined || data[0].image !== undefined || data[0].type !== undefined)) kind = 'cards_array';
          else { alert('无法识别'); return; }
        } else if (data && typeof data === 'object') {
          if (data.kind === 'full' || (data.friends && data.cards)) kind = 'full';
          else if (data.kind === 'cards' || data.cards) kind = 'cards';
          else if (data.kind === 'chats' || data.friends) kind = 'chats';
        }
        if (kind === 'full') window.restoreAll(data);
        else if (kind === 'cards' || kind === 'cards_array') window.restoreCards(Array.isArray(data) ? {cards: data} : data);
        else if (kind === 'chats') window.restoreChats(data);
        else alert('无法识别');
      } catch (e) { alert('JSON 解析失败'); }
    };
    r.readAsText(f);
  };
  input.click();
};

window.importExternalGroupedBackup = function(data) {
  if (!confirm('检测到外部字卡备份（含分组），将覆盖当前字卡库。确定吗？')) return;
  let newGroups = [{id:'public',name:'公共（未分组）',enabled:true,probability:50}];
  let newCards = []; let now = Date.now();
  if (Array.isArray(data.customReplyGroups)) {
    data.customReplyGroups.forEach((g, i) => {
      let gid = 'ext_g_' + now + '_' + i;
      newGroups.push({id:gid, name:g.name||('外部分组_'+i), enabled:true, probability:50});
      if (Array.isArray(g.items)) g.items.forEach((t, j) => {
        if (!t || typeof t !== 'string') return;
        newCards.push({id:'ext_c_'+now+'_'+i+'_'+j, type:'text', text:t.trim(), group:gid, enabled:true, probability:50, cooldown:0});
      });
    });
  }
  if (Array.isArray(data.customReplies)) {
    let seen = new Set(newCards.map(c => c.text));
    data.customReplies.forEach((t, i) => {
      if (!t || typeof t !== 'string') return;
      let s = t.trim();
      if (!seen.has(s)) {
        newCards.push({id:'ext_c_flat_'+now+'_'+i, type:'text', text:s, group:'public', enabled:true, probability:50, cooldown:0});
        seen.add(s);
      }
    });
  }
  state.groups = newGroups; state.cards = newCards;
  currentGroup = '全部'; currentType = '全部';
  save().then(() => { closeModal(); renderCards(); alert('字卡已导入（含分组）'); });
};

window.importCardsJson = function() {
  if (typeof restoreBackup === 'function') restoreBackup();
};

// ============ 性能优化 ============
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

window.sendMsg = function() {
  let i = $('msgInput'), t = i.value.trim();
  if(!t || !currentFriend) return;
  let msg = { who:'me', text:t, time:now() };
  if(window._pendingQuote){ msg.quote = window._pendingQuote; clearPendingQuote(); }
  currentFriend.chat.push(msg);
  i.value = ''; save(); renderBubbles();
  const friend = currentFriend;
  clearTimeout(friend._cardTimer); clearTimeout(friend._typingTimer);
  friend._typing = true;
  if(friend === currentFriend) renderBubbles();
  let cs = state.chatSettings || {};
  let min = Math.max(1, +cs.min || 30), max = Math.max(min, +cs.max || 120);
  let delay = (min + Math.random() * (max - min)) * 1000;
  friend._typingTimer = setTimeout(() => {
    friend._typing = false;
    if(friend === currentFriend) renderBubbles();
    if (typeof runCardPopup === 'function') runCardPopup(friend);
  }, delay);
};

// save 节流
(function(){
  if (window.__saveThrottle) return;
  window.__saveThrottle = true;
  const origSave = window.save;
  let timer = null, resolvers = [];
  window.save = function() {
    return new Promise(function(resolve) {
      resolvers.push(resolve);
      clearTimeout(timer);
      timer = setTimeout(function() {
        const rs = resolvers.slice(); resolvers = [];
        try {
          const p = origSave ? origSave() : null;
          if (p && p.then) p.then(()=>rs.forEach(r=>r())).catch(()=>rs.forEach(r=>r()));
          else rs.forEach(r=>r());
        } catch(e) { rs.forEach(r=>r()); }
      }, 600);
    });
  };
  function flush() {
    if (!timer) return;
    clearTimeout(timer); timer = null;
    try { if (origSave) origSave(); } catch(e){}
    const rs = resolvers.slice(); resolvers = [];
    rs.forEach(r=>r());
  }
  document.addEventListener('visibilitychange', ()=>{ if (document.hidden) flush(); });
  window.addEventListener('pagehide', flush);
  window.addEventListener('beforeunload', flush);
})();

// ============ 锁横向滑动 ============
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

// ============ 后台消息通知 ============
(function() {
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

// ============ 时间显示修复 ============
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

// ============ 保活 ============
(function() {
  window.startKeepAlive = function() {
    if (window.keepAliveAudio && !window.keepAliveAudio.paused) return;
    const WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
    window.keepAliveAudio = new Audio(WAV);
    window.keepAliveAudio.loop = true;
    window.keepAliveAudio.volume = 0.01;
    window.keepAliveAudio.setAttribute('playsinline', 'true');
    window.keepAliveAudio.play().catch(()=>{});
    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title:'简约聊天', artist:'后台运行中', album:'聊天保活',
          artwork:[{src:'icon-192.PNG', sizes:'192x192', type:'image/png'}]
        });
        navigator.mediaSession.playbackState = 'playing';
      } catch(e){}
    }
  };
})();

// ============ 后台消息推送卡片 ============
(function() {
  function build() {
    const me = document.getElementById('me'); if (!me) { setTimeout(build, 500); return; }
    const old = document.getElementById('notifyBtn');
    if (old) { const oc = old.closest('.section.card'); if (oc) oc.remove(); }
    const card = document.createElement('div');
    card.className = 'section card'; card.id = 'pushCard';
    const granted = (typeof Notification !== 'undefined' && Notification.permission === 'granted');
    card.innerHTML = '<div class="row" style="align-items:flex-start;padding:14px 13px;gap:10px">' +
      '<div class="icon settingsIcon iconSvg" style="background:#e9e9ec!important;color:#333!important">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 17h12l-1.4-1.8V10a4.6 4.6 0 0 0-9.2 0v5.2L6 17Z"></path><path d="M10 20h4"></path></svg></div>' +
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

// ============ 字卡库多选 + 按钮委托 + 表情包布局 ============
(function() {
  if (window.__cardsExt) return;
  window.__cardsExt = true;
  window._multiSel = new Set();
  window._multiOn = false;

  const style = document.createElement('style');
  style.textContent = `
    .multi-select-btn{width:auto!important;height:38px!important;border-radius:19px!important;padding:0 16px!important;font-size:.82rem!important;font-weight:600!important;background:#f0f0f4!important;color:#1a1a1e!important;display:grid;place-items:center;box-shadow:none!important;margin-right:8px;font-family:inherit;cursor:pointer}
    #cards.multi-mode .header .plus:not(.multi-select-btn){display:none!important}
    #cards.multi-mode #cardsList{padding-bottom:120px}
    .cardItem.multiSelect{padding-left:48px!important;position:relative;cursor:pointer}
    .cardItem.multiSelect .multiCheck{position:absolute;left:15px;top:50%;transform:translateY(-50%);width:22px;height:22px;border-radius:50%;border:1.5px solid #c7c7cc;display:grid;place-items:center;background:#fff;transition:.15s;pointer-events:none}
    .cardItem.multiSelect .multiCheck.checked{background:#1a1a1e;border-color:#1a1a1e;color:#fff}
    .cardItem.multiSelect .multiCheck svg{width:13px;height:13px;display:none}
    .cardItem.multiSelect .multiCheck.checked svg{display:block}
    .cardItem.multiSelect .switch,.cardItem.multiSelect .cardTools{display:none!important}
    .multi-bar{position:fixed;left:50%;bottom:0;transform:translateX(-50%);width:min(100%,720px);background:#1a1a1e;color:#fff;display:flex;justify-content:space-around;align-items:center;padding:10px 8px calc(18px + env(safe-area-inset-bottom));z-index:99999;box-shadow:0 -4px 20px rgba(0,0,0,.18);border-radius:20px 20px 0 0;box-sizing:border-box;min-height:64px}
    .multi-bar button{color:#fff;font-size:.72rem;padding:6px 4px;display:flex;flex-direction:column;align-items:center;gap:3px;flex:1;background:transparent;border:0;cursor:pointer;min-width:0;font-family:inherit}
    .multi-bar button:disabled{opacity:.32}
    .multi-bar button svg{width:22px;height:22px;display:block}
    .multi-bar button.danger{color:#ff8a8a}
    .stickerPanel{display:grid!important;grid-template-columns:repeat(4,1fr)!important;grid-auto-rows:auto!important;gap:8px!important;max-height:360px!important;overflow-y:auto!important;overflow-x:hidden!important;padding:6px!important;background:#f6f6f8!important;border-radius:12px!important;align-items:start!important;box-sizing:border-box!important}
    .stickerItem{position:relative!important;display:block!important;width:100%!important;height:auto!important;padding:0!important;aspect-ratio:1/1!important;border-radius:10px!important;overflow:hidden!important;background:#fff!important;box-sizing:border-box!important}
    .stickerItem img{position:absolute!important;top:0!important;left:0!important;width:100%!important;height:100%!important;object-fit:cover!important;display:block!important;cursor:pointer!important}
    .stickerDel{position:absolute!important;top:4px!important;right:4px!important;z-index:10!important;width:20px!important;height:20px!important;border-radius:50%!important;background:rgba(0,0,0,.5)!important;color:#fff!important;font-size:13px!important;line-height:1!important;display:grid!important;place-items:center!important;cursor:pointer!important;border:0!important;padding:0!important;font-family:inherit!important}
  `;
  document.head.appendChild(style);

  function getFilteredIds() {
    const search = document.getElementById('cardSearch');
    const q = (search && search.value || '').trim().toLowerCase();
    return state.cards.filter(c => {
      if (currentType !== '全部' && c.type !== currentType) return false;
      if (currentGroup !== '全部' && c.group !== currentGroup) return false;
      if (q) { const t = (c.text || '').toLowerCase(); if (!t.includes(q)) return false; }
      return true;
    }).map(c => String(c.id));
  }
  function getCardId(item) {
    if (item.dataset.cardId) return item.dataset.cardId;
    const items = Array.from(document.querySelectorAll('#cardsList .cardItem'));
    const idx = items.indexOf(item); if (idx < 0) return null;
    const ids = getFilteredIds(); if (idx >= ids.length) return null;
    item.dataset.cardId = ids[idx]; return ids[idx];
  }
  function createCheck() {
    const c = document.createElement('div');
    c.className = 'multiCheck';
    c.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5L20 7"></path></svg>';
    return c;
  }
  function apply() {
    if (!window._multiOn) return;
    const page = document.getElementById('cards'); if (!page) return;
    page.classList.add('multi-mode');
    const items = document.querySelectorAll('#cardsList .cardItem');
    const ids = getFilteredIds();
    items.forEach((item, idx) => {
      item.classList.add('multiSelect');
      if (!item.querySelector('.multiCheck')) item.insertBefore(createCheck(), item.firstChild);
      if (idx < ids.length) {
        item.dataset.cardId = ids[idx];
        const chk = item.querySelector('.multiCheck');
        if (window._multiSel.has(ids[idx])) chk.classList.add('checked');
        else chk.classList.remove('checked');
      }
    });
    createBar(); updateBar();
  }
  function createBar() {
    if (document.getElementById('multiBar')) return;
    const bar = document.createElement('div');
    bar.id = 'multiBar'; bar.className = 'multi-bar';
    bar.innerHTML =
      '<button id="mbSelectAll"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3 8-8"></path><path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9"></path></svg><span>全选</span></button>' +
      '<button id="mbMove"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h13l-3-3"></path><path d="M3 17h13l-3 3"></path><path d="M3 12h18"></path></svg><span>移组</span></button>' +
      '<button id="mbToggle"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><path d="M8 12h8"></path></svg><span id="mbToggleText">禁用</span></button>' +
      '<button id="mbDelete" class="danger"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 7h14M9 7V5h6v2M8 7l1 13h6l1-13M10 10v7M14 10v7"></path></svg><span>删除</span></button>';
    document.body.appendChild(bar);
    bar.querySelector('#mbSelectAll').onclick = selAll;
    bar.querySelector('#mbMove').onclick = moveSel;
    bar.querySelector('#mbToggle').onclick = toggleSel;
    bar.querySelector('#mbDelete').onclick = deleteSel;
  }
  function updateBar() {
    const bar = document.getElementById('multiBar'); if (!bar) return;
    const no = window._multiSel.size === 0;
    ['mbMove','mbToggle','mbDelete'].forEach(x => { const b = bar.querySelector('#'+x); if (b) b.disabled = no; });
    const btn = document.querySelector('#cards .multi-select-btn');
    if (btn) btn.textContent = window._multiSel.size > 0 ? '完成·' + window._multiSel.size : '完成';
    const cards = state.cards.filter(c => window._multiSel.has(String(c.id)));
    const t = bar.querySelector('#mbToggleText');
    if (t) t.textContent = (cards.length > 0 && cards.every(c => c.enabled !== false)) ? '禁用' : '启用';
  }
  function selAll() {
    const items = document.querySelectorAll('#cardsList .cardItem');
    const all = items.length > 0 && Array.from(items).every(it => it.dataset.cardId && window._multiSel.has(it.dataset.cardId));
    items.forEach(it => {
      const id = it.dataset.cardId, c = it.querySelector('.multiCheck'); if (!id) return;
      if (all) { window._multiSel.delete(id); if (c) c.classList.remove('checked'); }
      else { window._multiSel.add(id); if (c) c.classList.add('checked'); }
    });
    updateBar();
  }
  function moveSel() {
    if (window._multiSel.size === 0) return;
    const groups = [{id:'public',name:'公共（未分组）'}, ...state.groups.filter(g=>g.id!=='public')];
    let html = '<div class="desc" style="margin-bottom:12px">将选中的 <b>' + window._multiSel.size + '</b> 张移动到：</div><div style="max-height:52vh;overflow:auto;background:#f6f6f8;border-radius:12px">';
    groups.forEach(g => { html += '<div class="row" style="cursor:pointer;border-bottom:1px solid #ececf0;padding:14px" onclick="window._moveTo(\'' + g.id + '\')"><div class="rowmain"><div class="title">' + esc(g.name) + '</div></div><span class="chev">›</span></div>'; });
    html += '</div><button class="action" style="margin-top:14px" onclick="window._createAndMove()">＋ 新建分组并移入</button>';
    modal('移动到分组', html);
  }
  window._moveTo = function(gid) {
    let c = 0;
    state.cards.forEach(x => { if (window._multiSel.has(String(x.id))) { x.group = gid; c++; } });
    save().then(() => { closeModal(); showToast('已移动 ' + c + ' 张'); window._multiSel.clear(); renderCards(); setTimeout(() => { apply(); updateBar(); }, 100); });
  };
  window._createAndMove = function() {
    const name = prompt('新建分组名称：'); if (!name || !name.trim()) return;
    const trim = name.trim();
    if (state.groups.some(g => String(g.name).trim() === trim)) { alert('分组已存在'); return; }
    const gid = 'g' + Date.now() + Math.random().toString(36).slice(2,7);
    state.groups.push({id:gid, name:trim, enabled:true, probability:50});
    let c = 0;
    state.cards.forEach(x => { if (window._multiSel.has(String(x.id))) { x.group = gid; c++; } });
    save().then(() => { closeModal(); showToast('已新建并移动 ' + c + ' 张'); window._multiSel.clear(); renderCards(); setTimeout(() => { apply(); updateBar(); }, 100); });
  };
  function toggleSel() {
    if (window._multiSel.size === 0) return;
    const cards = state.cards.filter(c => window._multiSel.has(String(c.id))); if (!cards.length) return;
    const ns = !cards.every(c => c.enabled !== false);
    cards.forEach(c => c.enabled = ns);
    save().then(() => { showToast(ns ? '已启用 ' + cards.length + ' 张' : '已停用 ' + cards.length + ' 张'); window._multiSel.clear(); renderCards(); setTimeout(() => { apply(); updateBar(); }, 100); });
  }
  function deleteSel() {
    if (window._multiSel.size === 0) return;
    if (!confirm('确定删除选中的 ' + window._multiSel.size + ' 张吗？不可恢复。')) return;
    state.cards = state.cards.filter(c => !window._multiSel.has(String(c.id)));
    save().then(() => { showToast('已删除'); window._multiSel.clear(); renderCards(); setTimeout(() => { apply(); updateBar(); }, 100); });
  }
  function injectBtn() {
    const page = document.getElementById('cards'); if (!page) return;
    const header = page.querySelector('.header'); if (!header) return;
    if (header.querySelector('.multi-select-btn')) return;
    const plus = header.querySelector('.plus'); if (!plus) return;
    const btn = document.createElement('button');
    btn.className = 'plus multi-select-btn';
    btn.textContent = window._multiOn ? '完成' : '选择';
    btn.onclick = toggleMulti;
    header.insertBefore(btn, plus);
  }
  function toggleMulti() {
    if (window._multiOn) {
      window._multiOn = false; window._multiSel.clear();
      const p = document.getElementById('cards'); if (p) p.classList.remove('multi-mode');
      const b = document.getElementById('multiBar'); if (b) b.remove();
      if (typeof renderCards === 'function') renderCards();
      setTimeout(injectBtn, 50);
    } else {
      window._multiOn = true; window._multiSel.clear(); apply();
      setTimeout(injectBtn, 50);
    }
  }
  // 捕获阶段拦截点击
  document.addEventListener('click', function(e) {
    const page = document.getElementById('cards');
    if (!page || !page.classList.contains('active')) return;

    if (window._multiOn) {
      // 多选模式：勾选
      const item = e.target.closest('#cardsList .cardItem'); if (!item) return;
      e.preventDefault(); e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      const id = getCardId(item); if (!id) return;
      const chk = item.querySelector('.multiCheck'); if (!chk) return;
      if (window._multiSel.has(id)) { window._multiSel.delete(id); chk.classList.remove('checked'); }
      else { window._multiSel.add(id); chk.classList.add('checked'); }
      updateBar();
      return;
    }

    // 非多选模式：接管三个按钮
    const item = e.target.closest('#cardsList .cardItem'); if (!item) return;
    const btn = e.target.closest('button'); if (!btn) return;
    let action = null;
    if (btn.classList.contains('switch')) action = 'toggle';
    else if (btn.getAttribute('aria-label') === '编辑') action = 'edit';
    else if (btn.getAttribute('aria-label') === '删除') action = 'delete';
    else return;
    e.preventDefault(); e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    const id = getCardId(item); if (!id) return;
    if (action === 'toggle' && typeof toggleCard === 'function') toggleCard(id);
    else if (action === 'edit' && typeof editCard === 'function') editCard(id);
    else if (action === 'delete' && typeof deleteCard === 'function') deleteCard(id);
  }, true);

  setInterval(function() {
    if (!window._multiOn) return;
    const page = document.getElementById('cards'); if (!page) return;
    if (!page.classList.contains('multi-mode')) apply();
    const need = Array.from(document.querySelectorAll('#cardsList .cardItem')).some(it => !it.classList.contains('multiSelect') || !it.dataset.cardId);
    if (need) apply();
  }, 400);

  setTimeout(() => {
    injectBtn();
    const obs = new MutationObserver(() => injectBtn());
    obs.observe(document.body, {childList: true, subtree: false});
  }, 2500);
})();

// ============ 聊天自动滚到底部 ============
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
  // 打开聊天页时也滚到底
  const orig = window.showPage;
  window.showPage = function(id) {
    const r = orig ? orig.apply(this, arguments) : undefined;
    if (id === 'chat') {
      const b = document.getElementById('bubbles');
      if (b) { requestAnimationFrame(() => { b.scrollTop = b.scrollHeight; }); setTimeout(() => { b.scrollTop = b.scrollHeight; }, 150); setTimeout(() => { b.scrollTop = b.scrollHeight; }, 400); }
    }
    return r;
  };
})();

// ============ 朋友圈：调度 + 按钮 + 频率设置 ============
(function() {
  if (window.__momExt) return;
  window.__momExt = true;
  window.__momNext = { post: 0, like: 0, comment: 0, reply: 0 };

  function pick(a, b) { a = Math.max(1, Number(a)||1); b = Math.max(a, Number(b)||a); return (a + Math.random()*(b-a)) * 60000; }
  function sched(k, a, b) { window.__momNext[k] = Date.now() + pick(a, b); }
  function ensure() {
    if (!state || !state.chatSettings) return;
    const c = state.chatSettings;
    if (!window.__momNext.post) sched('post', c.momentPostMin, c.momentPostMax);
    if (!window.__momNext.like) sched('like', c.momentLikeMin, c.momentLikeMax);
    if (!window.__momNext.comment) sched('comment', c.momentCommentMin, c.momentCommentMax);
    if (!window.__momNext.reply) sched('reply', c.momentReplyMin, c.momentReplyMax);
  }
  setInterval(function() {
    if (!state || !state.chatSettings) return;
    ensure();
    const c = state.chatSettings, t = Date.now();
    if (t >= window.__momNext.post) { if (typeof autoFriendMoment === 'function') autoFriendMoment(); sched('post', c.momentPostMin, c.momentPostMax); }
    if (t >= window.__momNext.like) { if (typeof autoFriendLike === 'function') autoFriendLike(); sched('like', c.momentLikeMin, c.momentLikeMax); }
    if (t >= window.__momNext.comment) { if (typeof autoFriendComment === 'function') autoFriendComment(); sched('comment', c.momentCommentMin, c.momentCommentMax); }
    if (t >= window.__momNext.reply) { if (typeof autoFriendReply === 'function') autoFriendReply(); sched('reply', c.momentReplyMin, c.momentReplyMax); }
  }, 10000);

  // 朋友圈右上角按钮
  setInterval(function() {
    const top = document.querySelector('#moments .momActionsTop'); if (!top) return;
    const all = top.querySelectorAll('.momTestBtn');
    for (let i = 1; i < all.length; i++) all[i].remove();
    // 清理旧 ⚡
    top.querySelectorAll('button').forEach(b => {
      if (b.textContent && b.textContent.trim() === '⚡') b.remove();
    });
    if (top.querySelector('.momTestBtn')) return;
    const b = document.createElement('button');
    b.className = 'momMore momTestBtn';
    b.setAttribute('aria-label', '触发朋友圈互动');
    b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px;display:block"><path d="M21 12a9 9 0 1 1-3-6.7"></path><path d="M21 4v5h-5"></path></svg>';
    b.onclick = function() {
      if (typeof autoFriendMoment === 'function') autoFriendMoment();
      setTimeout(() => { if (typeof autoFriendLike === 'function') autoFriendLike(); }, 300);
      setTimeout(() => { if (typeof autoFriendComment === 'function') autoFriendComment(); }, 600);
      if (typeof showToast === 'function') showToast('已触发');
    };
    top.appendChild(b);
  }, 800);

  // 描述改分钟
  setInterval(function() {
    const d = document.getElementById('momentInteractionDesc');
    if (!d || !state || !state.chatSettings) return;
    const c = state.chatSettings;
    const txt = '发动态 ' + c.momentPostMin + '–' + c.momentPostMax + '分钟 · 点赞 ' + c.momentLikeMin + '–' + c.momentLikeMax + '分钟 · 评论 ' + c.momentCommentMin + '–' + c.momentCommentMax + '分钟 · 回复 ' + c.momentReplyMin + '–' + c.momentReplyMax + '分钟';
    if (d.textContent !== txt) d.textContent = txt;
  }, 2000);

  // 设置弹窗
  window.__momShow = function() {
    const c = state.chatSettings;
    function f(id, label, val) { return '<div class="field"><label>' + label + '</label><input id="' + id + '" class="textinput" type="number" min="1" value="' + val + '"></div>'; }
    modal('朋友圈互动 · 分钟',
      '<div class="desc" style="margin-bottom:12px;line-height:1.6">每项都按分钟设置。</div>' +
      '<div style="font-weight:600;margin:6px 0">对方发朋友圈</div>' + f('mpMin','最短（分钟）', c.momentPostMin) + f('mpMax','最长（分钟）', c.momentPostMax) +
      '<div style="font-weight:600;margin:14px 0 6px">对方点赞</div>' + f('mlMin','最短（分钟）', c.momentLikeMin) + f('mlMax','最长（分钟）', c.momentLikeMax) +
      '<div style="font-weight:600;margin:14px 0 6px">对方评论</div>' + f('mcMin','最短（分钟）', c.momentCommentMin) + f('mcMax','最长（分钟）', c.momentCommentMax) +
      '<div style="font-weight:600;margin:14px 0 6px">对方回复我的评论</div>' + f('mrMin','最短（分钟）', c.momentReplyMin) + f('mrMax','最长（分钟）', c.momentReplyMax) +
      '<div style="display:flex;gap:8px;margin-top:16px"><button class="action secondary" style="flex:1;margin:0" onclick="closeModal()">取消</button><button class="action" style="flex:1;margin:0" onclick="window.__momSave()">保存</button></div>'
    );
  };
  window.__momSave = function() {
    const c = state.chatSettings;
    function v(id){ const el = document.getElementById(id); return Math.max(1, Number(el ? el.value : 1)||1); }
    let a, b;
    a = v('mpMin'); b = v('mpMax'); if (b < a) b = a; c.momentPostMin = a; c.momentPostMax = b;
    a = v('mlMin'); b = v('mlMax'); if (b < a) b = a; c.momentLikeMin = a; c.momentLikeMax = b;
    a = v('mcMin'); b = v('mcMax'); if (b < a) b = a; c.momentCommentMin = a; c.momentCommentMax = b;
    a = v('mrMin'); b = v('mrMax'); if (b < a) b = a; c.momentReplyMin = a; c.momentReplyMax = b;
    save(); closeModal();
    window.__momNext = {post:0, like:0, comment:0, reply:0};
    showToast('已保存（分钟）');
  };
  setInterval(function() {
    document.querySelectorAll('[onclick*="showMomentInteractionSettings"]').forEach(function(el) {
      el.setAttribute('onclick', 'window.__momShow()');
    });
  }, 500);
})();

// ============ 点头像触发回复 ============
(function() {
  if (window.__tapAvatar) return;
  window.__tapAvatar = true;
  let lastTap = 0;

  const style = document.createElement('style');
  style.textContent = '.chatTopAvatar.tapped{animation:avatarTap .45s cubic-bezier(.34,1.56,.64,1)}@keyframes avatarTap{0%{transform:scale(1)}35%{transform:scale(.82)}70%{transform:scale(1.08)}100%{transform:scale(1)}}';
  document.head.appendChild(style);

  function pickCards(friend) {
    const cs = state.chatSettings || {};
    const now = Date.now();
    const cd = friend._cardCooldowns || {};
    const active = state.cards.filter(c => {
      if (c.enabled === false) return false;
      if (c.probability === undefined || c.probability <= 0) return false;
      const g = state.groups.find(x => x.id === c.group);
      if (!g || g.enabled === false) return false;
      if (cd[c.id] && now - cd[c.id] < (Number(c.cooldown)||0)*1000) return false;
      return true;
    });
    if (!active.length) return [];
    const cMin = Math.max(1, Math.min(10, parseInt(cs.cardMinCount)||1));
    const cMax = Math.max(cMin, Math.min(10, parseInt(cs.cardMaxCount)||3));
    const count = cMin + Math.floor(Math.random()*(cMax-cMin+1));
    const pool = active.slice(), picks = [];
    for (let i = 0; i < count && pool.length; i++) {
      let total = 0;
      for (const it of pool) total += Math.max(0, Number(it.probability===undefined?50:it.probability)||0);
      let pk = null;
      if (total <= 0) pk = pool[Math.floor(Math.random()*pool.length)];
      else {
        let r = Math.random()*total;
        for (const it of pool) { r -= Math.max(0, Number(it.probability===undefined?50:it.probability)||0); if (r <= 0) { pk = it; break; } }
        if (!pk) pk = pool[pool.length-1];
      }
      picks.push(pk); pool.splice(pool.indexOf(pk), 1);
    }
    return picks;
  }
  function cardToMsg(card, friend) {
    const cs = state.chatSettings || {};
    const msg = {who:'other', time: Date.now()};
    const recent = friend.chat.filter(m => m.who === 'me').slice(-10);
    if (cs.quoteEnabled !== false && recent.length && Math.random()*100 < (+cs.quoteProb||0)) {
      const q = recent[Math.floor(Math.random()*recent.length)];
      msg.quote = q.text || '[表情包]';
    }
    if (card.type === 'image' && card.image) { msg.image = card.image; msg.text = '[表情包]'; }
    else if (card.type === 'emoji') { msg.text = card.text; }
    else {
      let t = card.text || '';
      if (cs.emojiMixMode !== false && state.emojis.length && Math.random()*100 < (+cs.emojiProb||0)) {
        const e = state.emojis[Math.floor(Math.random()*state.emojis.length)];
        t = Math.random() < 0.5 ? (e+' '+t) : (t+' '+e);
      }
      msg.text = t;
    }
    return msg;
  }
  function play(friend, picks) {
    let i = 0;
    function step() {
      if (currentFriend !== friend) return;
      if (i >= picks.length) { friend._typing = false; if (currentFriend === friend) renderBubbles(); return; }
      friend._typing = true; if (currentFriend === friend) renderBubbles();
      const tMs = 700 + Math.random()*800;
      friend._typingTimer = setTimeout(() => {
        if (currentFriend !== friend) return;
        friend._typing = false; if (currentFriend === friend) renderBubbles();
        const card = picks[i];
        if (!friend._cardCooldowns) friend._cardCooldowns = {};
        friend._cardCooldowns[card.id] = Date.now();
        friend.chat.push(cardToMsg(card, friend));
        const cs = state.chatSettings || {};
        if (card.type !== 'image' && Math.random()*100 < (+cs.stickerProb||0)) {
          const imgs = state.cards.filter(x => x.type === 'image' && x.image && x.enabled !== false);
          if (imgs.length) {
            const s = imgs[Math.floor(Math.random()*imgs.length)];
            friend.chat.push({who:'other', image:s.image, text:'[表情包]', time: Date.now()});
          }
        }
        friend.unread = 0; save();
        if (currentFriend === friend) renderBubbles();
        i++;
        const gap = 500 + Math.random()*500;
        friend._typingTimer = setTimeout(step, gap);
      }, tMs);
    }
    friend._typingTimer = setTimeout(step, 400);
  }
  document.addEventListener('click', function(e) {
    const av = e.target.closest('#chat .chatTopAvatar'); if (!av) return;
    const cp = document.getElementById('chat'); if (!cp || !cp.classList.contains('active')) return;
    if (typeof currentFriend === 'undefined' || !currentFriend) return;
    e.preventDefault(); e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    const now = Date.now();
    if (now - lastTap < 2000) { if (typeof showToast === 'function') showToast('稍等一下再点'); return; }
    lastTap = now;
    if (navigator.vibrate) { try { navigator.vibrate(30); } catch(err) {} }
    av.classList.remove('tapped'); void av.offsetWidth; av.classList.add('tapped');
    const friend = currentFriend;
    const picks = pickCards(friend);
    if (!picks.length) { if (typeof showToast === 'function') showToast('字卡库里没有可用的字卡'); return; }
    clearTimeout(friend._cardTimer); clearTimeout(friend._typingTimer);
    play(friend, picks);
  }, true);
})();

console.log('✅ patch.js 精简版已加载');
// ====== v23：修复保活音频 + 增强性能 ======
(function(){
  if (window.__v23) return;
  window.__v23 = true;

  // 生成一个真正的静音 WAV
  function genSilentWav(seconds) {
    const sampleRate = 8000;
    const numSamples = Math.floor(sampleRate * seconds);
    const buf = new ArrayBuffer(44 + numSamples);
    const view = new DataView(buf);
    function ws(o, s) { for (let i = 0; i < s.length; i++) view.setUint8(o+i, s.charCodeAt(i)); }
    ws(0, 'RIFF'); view.setUint32(4, 36 + numSamples, true);
    ws(8, 'WAVE'); ws(12, 'fmt ');
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate, true);
    view.setUint16(32, 1, true); view.setUint16(34, 8, true);
    ws(36, 'data'); view.setUint32(40, numSamples, true);
    for (let i = 0; i < numSamples; i++) view.setUint8(44 + i, 128);
    return new Blob([buf], {type: 'audio/wav'});
  }

  // 覆盖保活函数
  window.startKeepAlive = function() {
    if (window.keepAliveAudio && !window.keepAliveAudio.paused) return;
    try {
      const blob = genSilentWav(2);
      const url = URL.createObjectURL(blob);
      if (window.keepAliveAudio) { try { window.keepAliveAudio.pause(); } catch(e){} }
      window.keepAliveAudio = new Audio(url);
      window.keepAliveAudio.loop = true;
      window.keepAliveAudio.volume = 0.01;
      window.keepAliveAudio.setAttribute('playsinline', 'true');
      window.keepAliveAudio.play().then(() => {
        console.log('✅ 保活音频已开始播放');
      }).catch(err => console.log('播放失败:', err));
      if ('mediaSession' in navigator) {
        try {
          navigator.mediaSession.metadata = new MediaMetadata({
            title: '简约聊天', artist: '后台运行中', album: '聊天保活',
            artwork: [{src:'icon-192.PNG', sizes:'192x192', type:'image/png'}]
          });
          navigator.mediaSession.playbackState = 'playing';
        } catch(e) {}
      }
    } catch(err) { console.log('保活初始化失败:', err); }
  };

  // 第一次用户交互时自动启动（绕过 iOS 自动播放限制）
  function onFirstTouch() {
    if (typeof window.startKeepAlive === 'function') window.startKeepAlive();
  }
  document.addEventListener('touchstart', onFirstTouch, {once: true, passive: true});
  document.addEventListener('click', onFirstTouch, {once: true, passive: true});

  // 如果之前已授权通知，延迟启动
  setTimeout(function(){
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      if (typeof window.startKeepAlive === 'function') window.startKeepAlive();
    }
  }, 2000);

  // 进一步优化 save：改用 requestIdleCallback
  if (!window.__saveIdle) {
    window.__saveIdle = true;
    const curSave = window.save;
    let scheduled = false, res2 = [];
    window.save = function() {
      return new Promise(function(resolve) {
        res2.push(resolve);
        if (scheduled) return;
        scheduled = true;
        function doSave() {
          scheduled = false;
          const rs = res2.slice(); res2 = [];
          try {
            const p = curSave ? curSave() : null;
            if (p && p.then) p.then(() => rs.forEach(r => r())).catch(() => rs.forEach(r => r()));
            else rs.forEach(r => r());
          } catch(e) { rs.forEach(r => r()); }
        }
        if (window.requestIdleCallback) requestIdleCallback(doSave, {timeout: 1500});
        else setTimeout(doSave, 800);
      });
    };
  }

  console.log('✅ v23 已加载');
})();
