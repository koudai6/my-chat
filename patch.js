// ====== 字卡导入外挂补丁 ======
window.restoreBackup = function() {
  let input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.onchange = () => {
    let f = input.files && input.files[0];
    if (!f) return;
    let r = new FileReader();
    r.onload = () => {
      try {
        let data = JSON.parse(r.result);
        if (data && (data.customReplyGroups || data.customReplies)) {
          window.importExternalGroupedBackup(data);
          return;
        }
        let kind = '';
        if (Array.isArray(data)) {
          if (data.length > 0 && (data[0].text !== undefined || data[0].image !== undefined || data[0].type !== undefined)) {
            kind = 'cards_array';
          } else {
            alert('无法识别：空的数组或未知格式');
            return;
          }
        } else if (data && typeof data === 'object') {
          if (data.kind === 'full' || (data.friends && data.cards)) kind = 'full';
          else if (data.kind === 'cards' || data.cards) kind = 'cards';
          else if (data.kind === 'chats' || data.friends) kind = 'chats';
        }
        if (kind === 'full') window.restoreAll(data);
        else if (kind === 'cards' || kind === 'cards_array') {
           let newX = Array.isArray(data) ? { cards: data } : data;
           window.restoreCards(newX);
        }
        else if (kind === 'chats') window.restoreChats(data);
        else alert('无法识别：数据格式不匹配');
      } catch (e) {
        console.error(e);
        alert('解析失败：文件不是有效的 JSON 格式');
      }
    };
    r.readAsText(f);
  };
  input.click();
};

window.importExternalGroupedBackup = function(data) {
  if (!confirm('检测到外部网站的字卡备份（含分组），将覆盖当前字卡库。确定继续吗？')) return;
  let newGroups = [{id: 'public', name: '公共（未分组）', enabled: true, probability: 50}];
  let newCards = [];
  let now = Date.now();
  if (Array.isArray(data.customReplyGroups)) {
     data.customReplyGroups.forEach((g, index) => {
        let groupId = 'ext_g_' + now + '_' + index;
        newGroups.push({ id: groupId, name: g.name || ('外部分组_' + index), enabled: true, probability: 50 });
        if (Array.isArray(g.items)) {
           g.items.forEach((text, tIndex) => {
              if (!text || typeof text !== 'string') return;
              newCards.push({ id: 'ext_c_' + now + '_' + index + '_' + tIndex, type: 'text', text: text.trim(), group: groupId, enabled: true, probability: 50, cooldown: 0 });
           });
        }
     });
  }
  if (Array.isArray(data.customReplies)) {
     let existingTexts = new Set(newCards.map(c => c.text));
     data.customReplies.forEach((text, index) => {
        if (!text || typeof text !== 'string') return;
        let trimmed = text.trim();
        if (!existingTexts.has(trimmed)) {
           newCards.push({ id: 'ext_c_flat_' + now + '_' + index, type: 'text', text: trimmed, group: 'public', enabled: true, probability: 50, cooldown: 0 });
           existingTexts.add(trimmed);
        }
     });
  }
  state.groups = newGroups;
  state.cards = newCards;
  currentGroup = '全部';
  currentType = '全部';
  save().then(() => {
     closeModal();
     renderCards();
     alert('外部字卡已成功导入（含分组）');
  });
};

window.importCardsJson = function() {
  if (typeof restoreBackup === 'function') restoreBackup();
  else alert('导入功能未就绪');
};
console.log('✅ 字卡导入补丁已加载');

// ====== 性能与回复体验优化 ======
window.openChat = function(id) {
  currentFriend = state.friends.find(f=>f.id===id)||state.friends[0];
  if(!currentFriend){showToast('没有好友');return;}
  if(!Array.isArray(currentFriend.chat)) currentFriend.chat=[];
  currentFriend.unread=0;
  $('chatName').textContent = currentFriend.name;
  $('chatId').textContent = 'ID：' + currentFriend.uid;
  let ca = $('chatAvatar');
  if (isImgAvatar(currentFriend.avatar)) ca.innerHTML = `<img src="${currentFriend.avatar}" alt="">`;
  else ca.textContent = (currentFriend.avatar || currentFriend.name || '?').toString().charAt(0);
  renderBubbles(); applyChatBg(); applyDecorationToChat(); showPage('chat');
  if (window.requestIdleCallback) requestIdleCallback(()=>save());
  else setTimeout(()=>save(), 100);
};

window.sendMsg = function() {
  let i = $('msgInput'), t = i.value.trim();
  if(!t || !currentFriend) return;
  let msg = { who:'me', text:t, time:now() };
  if(window._pendingQuote){ msg.quote = window._pendingQuote; clearPendingQuote(); }
  currentFriend.chat.push(msg);
  i.value = '';
  save();
  renderBubbles();
  const friend = currentFriend;
  clearTimeout(friend._cardTimer);
  clearTimeout(friend._typingTimer);
  friend._typing = true;
  if(friend === currentFriend) renderBubbles();
  let cs = state.chatSettings || {};
  let min = Math.max(1, +cs.min || 30);
  let max = Math.max(min, +cs.max || 120);
  let delay = (min + Math.random() * (max - min)) * 1000;
  friend._typingTimer = setTimeout(() => {
    friend._typing = false;
    if(friend === currentFriend) renderBubbles();
    if (typeof runCardPopup === 'function') runCardPopup(friend);
  }, delay);
};
console.log('✅ 性能与回复体验优化补丁已加载');

// ====== 锁定横向滑动 ======
(function() {
  const style = document.createElement('style');
  style.textContent = `
    #bubbles{overflow-x:hidden!important;touch-action:pan-y!important;overscroll-behavior-x:none!important;max-width:100%!important;width:100%!important}
    #bubbles .bubbleRow,#bubbles .msgWrap,#bubbles .bubble{max-width:100%!important;min-width:0!important}
    #bubbles img{max-width:100%!important;height:auto}
    html,body,.app{overflow-x:hidden!important;max-width:100vw!important}
  `;
  document.head.appendChild(style);
  console.log('✅ 锁定横向滑动补丁已加载');
})();

// ====== 后台消息通知监听器 ======
(function() {
  const notifiedKeys = {};
  function initSeen() {
    (state.friends || []).forEach(f => {
      if (!Array.isArray(f.chat) || !f.chat.length) return;
      const last = f.chat[f.chat.length - 1];
      if (!last) return;
      notifiedKeys[f.id] = (last.text || '') + '|' + last.time + '|' + (last.image ? 'img' : '');
    });
  }
  function scan() {
    if (!Array.isArray(state.friends)) return;
    state.friends.forEach(f => {
      if (!Array.isArray(f.chat) || !f.chat.length) return;
      const last = f.chat[f.chat.length - 1];
      if (!last || last.who !== 'other') return;
      const key = (last.text || '') + '|' + last.time + '|' + (last.image ? 'img' : '');
      if (notifiedKeys[f.id] === key) return;
      notifiedKeys[f.id] = key;
      const isViewingThis = (typeof currentFriend !== 'undefined' && currentFriend && currentFriend.id === f.id && !document.hidden);
      if (isViewingThis) return;
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        const title = f.name || '新消息';
        let body = last.text || '';
        if (last.image && !body) body = '[图片/表情包]';
        if (typeof showNotification === 'function') showNotification(title, body);
        else if (navigator.serviceWorker && navigator.serviceWorker.ready) {
          navigator.serviceWorker.ready.then(reg => {
            reg.showNotification(title, { body: body, icon: 'icon-192.PNG', tag: 'chat-' + f.id });
          }).catch(()=>{});
        }
      }
    });
  }
  setTimeout(() => { initSeen(); setInterval(scan, 3000); console.log('✅ 后台消息通知监听器已启动'); }, 2000);
})();

// ====== 时间显示修复 ======
(function() {
  function formatTs(str) {
    if (!str) return str;
    const s = String(str).trim();
    if (!/^\d+$/.test(s)) return str;
    let num = Number(s);
    if (isNaN(num)) return str;
    let ms;
    if (s.length >= 12) ms = num;
    else if (s.length >= 9) ms = num * 1000;
    else return str;
    const d = new Date(ms);
    if (isNaN(d.getTime())) return str;
    const y = d.getFullYear();
    if (y < 2000 || y > 2100) return str;
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return hh + ':' + mi;
    const yest = new Date(now);
    yest.setDate(now.getDate() - 1);
    if (d.toDateString() === yest.toDateString()) return '昨天';
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return mm + '/' + dd;
  }
  function fixTimeDisplay() {
    document.querySelectorAll('#chatList .value').forEach(el => {
      const t = el.textContent.trim(); const f = formatTs(t); if (f !== t) el.textContent = f;
    });
    document.querySelectorAll('#bubbles .bubbleMeta').forEach(el => {
      const t = el.textContent.trim(); const f = formatTs(t); if (f !== t) el.textContent = f;
    });
  }
  const observer = new MutationObserver(fixTimeDisplay);
  setTimeout(() => {
    const chatList = document.getElementById('chatList');
    const bubbles = document.getElementById('bubbles');
    if (chatList) observer.observe(chatList, { childList: true, subtree: true, characterData: true });
    if (bubbles) observer.observe(bubbles, { childList: true, subtree: true, characterData: true });
    fixTimeDisplay();
    console.log('✅ 时间显示修复补丁已加载');
  }, 2000);
})();

// ====== 强化版保活 ======
(function() {
  window.startKeepAlive = function() {
    if (window.keepAliveAudio && !window.keepAliveAudio.paused) return;
    const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
    window.keepAliveAudio = new Audio(SILENT_WAV);
    window.keepAliveAudio.loop = true;
    window.keepAliveAudio.volume = 0.01;
    window.keepAliveAudio.setAttribute('playsinline', 'true');
    window.keepAliveAudio.play().then(() => console.log('✅ 保活已启动')).catch(e => console.log('保活失败:', e));
    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: '简约聊天', artist: '后台运行中', album: '聊天保活',
          artwork: [
            { src: 'icon-192.PNG', sizes: '192x192', type: 'image/png' },
            { src: 'icon-192.PNG', sizes: '512x512', type: 'image/png' }
          ]
        });
        navigator.mediaSession.playbackState = 'playing';
        navigator.mediaSession.setActionHandler('play', () => { if (window.keepAliveAudio) window.keepAliveAudio.play(); });
        navigator.mediaSession.setActionHandler('pause', () => { if (window.keepAliveAudio) window.keepAliveAudio.pause(); });
        navigator.mediaSession.setActionHandler('seekbackward', () => {});
        navigator.mediaSession.setActionHandler('seekforward', () => {});
      } catch (e) { console.log('MediaSession 失败:', e); }
    }
  };
})();

// ====== 后台消息推送卡片 ======
(function() {
  function buildCard() {
    const mePage = document.getElementById('me');
    if (!mePage) { setTimeout(buildCard, 500); return; }
    const oldBtn = document.getElementById('notifyBtn');
    if (oldBtn) { const oc = oldBtn.closest('.section.card'); if (oc) oc.remove(); }
    const card = document.createElement('div');
    card.className = 'section card';
    card.id = 'pushCard';
    const granted = (typeof Notification !== 'undefined' && Notification.permission === 'granted');
    card.innerHTML = `
      <div class="row" style="align-items:flex-start;padding:14px 13px;gap:10px">
        <div class="icon settingsIcon iconSvg" style="background:#e9e9ec!important;color:#333!important">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 17h12l-1.4-1.8V10a4.6 4.6 0 0 0-9.2 0v5.2L6 17Z"></path><path d="M10 20h4"></path></svg>
        </div>
        <div class="rowmain" id="pushCardText" style="cursor:pointer;line-height:1.5">
          <div class="title" style="font-size:.92rem">${granted ? '后台消息推送✅ 已开启 — 当页面在后台时，收到消息会弹出系统通知' : '后台消息推送 — 点击右侧开关，允许系统通知'}</div>
          <div class="desc" style="margin-top:4px">点击文字区域可发送一条测试通知</div>
        </div>
        <button class="switch ${granted ? 'on' : ''}" id="pushSwitch"><i></i></button>
      </div>`;
    const settingsCard = mePage.querySelector('.section.card');
    if (settingsCard && settingsCard.nextSibling) mePage.insertBefore(card, settingsCard.nextSibling);
    else mePage.appendChild(card);
    const sw = card.querySelector('#pushSwitch');
    const textEl = card.querySelector('#pushCardText');
    function updateCard() {
      const ok = (Notification.permission === 'granted');
      sw.classList.toggle('on', ok);
      textEl.querySelector('.title').textContent = ok ? '后台消息推送✅ 已开启 — 当页面在后台时，收到消息会弹出系统通知' : '后台消息推送 — 点击右侧开关，允许系统通知';
    }
    function sendTestNotification() {
      if (Notification.permission !== 'granted') { alert('请先开启通知'); return; }
      if (navigator.serviceWorker && navigator.serviceWorker.ready) {
        navigator.serviceWorker.ready.then(reg => {
          reg.showNotification('简约聊天', { body: '这是一条测试通知，说明推送已生效 ✅', icon: 'icon-192.PNG', tag: 'test-' + Date.now() });
        }).catch(()=>{});
      } else new Notification('简约聊天', { body: '测试通知 ✅' });
    }
    sw.onclick = function(e) {
      e.stopPropagation();
      if (Notification.permission === 'granted') { alert('若想关闭，请前往设置手动关闭'); return; }
      Notification.requestPermission().then(perm => {
        if (perm === 'granted') { updateCard(); if (typeof startKeepAlive === 'function') startKeepAlive(); setTimeout(sendTestNotification, 300); }
        else { alert('已拒绝，可在设置中开启'); updateCard(); }
      });
    };
    textEl.onclick = function() { sendTestNotification(); };
  }
  setTimeout(buildCard, 1500);
  const origShowPage = window.showPage;
  window.showPage = function(id) {
    const r = origShowPage ? origShowPage.apply(this, arguments) : undefined;
    if (id === 'me') {
      const card = document.getElementById('pushCard');
      if (card) {
        const sw = card.querySelector('#pushSwitch');
        const title = card.querySelector('.title');
        const ok = (Notification.permission === 'granted');
        if (sw) sw.classList.toggle('on', ok);
        if (title) title.textContent = ok ? '后台消息推送✅ 已开启 — 当页面在后台时，收到消息会弹出系统通知' : '后台消息推送 — 点击右侧开关，允许系统通知';
      }
    }
    return r;
  };
})();

// ====== 多选栏位置修正 ======
(function() {
  function fixBar() {
    const bar = document.getElementById('multiBar');
    if (bar && bar.parentElement !== document.body) document.body.appendChild(bar);
    if (bar) {
      bar.style.setProperty('z-index', '99999', 'important');
      bar.style.setProperty('padding-bottom', 'calc(18px + env(safe-area-inset-bottom))', 'important');
      bar.style.setProperty('min-height', '64px', 'important');
    }
  }
  setInterval(fixBar, 300);
})();
// ====== 字卡库多选模式 v10（接管 renderCards） ======
(function() {
  if (window.__v10Loaded) return;
  window.__v10Loaded = true;

  window._v10Sel = new Set();
  window._v10Multi = false;

  const styleEl = document.createElement('style');
  styleEl.textContent = `
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
  `;
  document.head.appendChild(styleEl);

  function createCheck() {
    const c = document.createElement('div');
    c.className = 'multiCheck';
    c.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5L20 7"></path></svg>';
    return c;
  }

  // 给每张卡片打上 data-card-id（从 onclick 里提取，因为渲染时一定有）
  function tagCards() {
    document.querySelectorAll('#cardsList .cardItem').forEach(item => {
      if (item.dataset.cardId) return;
      const btn = item.querySelector('button[onclick*="toggleCard"]');
      if (!btn) return;
      const oc = btn.getAttribute('onclick') || '';
      const m = oc.match(/toggleCard\((.+)\)/);
      if (!m) return;
      let raw = m[1].trim();
      if (raw.startsWith('"') || raw.startsWith("'")) raw = raw.slice(1, -1);
      item.dataset.cardId = raw;
    });
  }

  // 进入多选模式后，给卡片加勾选圈
  function applyMultiToCards() {
    if (!window._v10Multi) return;
    const page = document.getElementById('cards');
    if (!page) return;
    page.classList.add('multi-mode');
    tagCards();
    document.querySelectorAll('#cardsList .cardItem').forEach(item => {
      item.classList.add('multiSelect');
      if (!item.querySelector('.multiCheck')) {
        item.insertBefore(createCheck(), item.firstChild);
      }
      const id = item.dataset.cardId;
      const check = item.querySelector('.multiCheck');
      if (id && window._v10Sel.has(id)) check.classList.add('checked');
      else check.classList.remove('checked');
    });
    createBar();
    updateBar();
  }

  function createBar() {
    if (document.getElementById('multiBar')) return;
    const bar = document.createElement('div');
    bar.id = 'multiBar';
    bar.className = 'multi-bar';
    bar.innerHTML = `
      <button id="mbSelectAll"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3 8-8"></path><path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9"></path></svg><span>全选</span></button>
      <button id="mbMove"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h13l-3-3"></path><path d="M3 17h13l-3 3"></path><path d="M3 12h18"></path></svg><span>移组</span></button>
      <button id="mbToggle"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><path d="M8 12h8"></path></svg><span id="mbToggleText">禁用</span></button>
      <button id="mbDelete" class="danger"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 7h14M9 7V5h6v2M8 7l1 13h6l1-13M10 10v7M14 10v7"></path></svg><span>删除</span></button>
    `;
    document.body.appendChild(bar);
    bar.querySelector('#mbSelectAll').onclick = selectAllCurrent;
    bar.querySelector('#mbMove').onclick = moveSelected;
    bar.querySelector('#mbToggle').onclick = toggleSelected;
    bar.querySelector('#mbDelete').onclick = deleteSelected;
  }

  function updateBar() {
    const bar = document.getElementById('multiBar');
    if (!bar) return;
    const noSel = window._v10Sel.size === 0;
    ['mbMove','mbToggle','mbDelete'].forEach(x => {
      const b = bar.querySelector('#' + x);
      if (b) b.disabled = noSel;
    });
    const selBtn = document.querySelector('#cards .multi-select-btn');
    if (selBtn) selBtn.textContent = window._v10Sel.size > 0 ? '完成·' + window._v10Sel.size : '完成';
    const cards = state.cards.filter(c => window._v10Sel.has(String(c.id)));
    const toggleText = bar.querySelector('#mbToggleText');
    if (toggleText) {
      const allEnabled = cards.length > 0 && cards.every(c => c.enabled !== false);
      toggleText.textContent = (cards.length > 0 && allEnabled) ? '禁用' : '启用';
    }
  }

  function selectAllCurrent() {
    const items = document.querySelectorAll('#cardsList .cardItem');
    const allSel = items.length > 0 && Array.from(items).every(it => it.dataset.cardId && window._v10Sel.has(it.dataset.cardId));
    items.forEach(it => {
      const id = it.dataset.cardId;
      const c = it.querySelector('.multiCheck');
      if (!id) return;
      if (allSel) { window._v10Sel.delete(id); if (c) c.classList.remove('checked'); }
      else { window._v10Sel.add(id); if (c) c.classList.add('checked'); }
    });
    updateBar();
  }

  function moveSelected() {
    if (window._v10Sel.size === 0) return;
    const groups = [{id:'public',name:'公共（未分组）'}, ...state.groups.filter(g=>g.id!=='public')];
    let html = '<div class="desc" style="margin-bottom:12px">将选中的 <b>' + window._v10Sel.size + '</b> 张字卡移动到：</div><div style="max-height:52vh;overflow:auto;background:#f6f6f8;border-radius:12px">';
    groups.forEach(g => {
      const count = state.cards.filter(c => window._v10Sel.has(String(c.id)) && c.group === g.id).length;
      html += '<div class="row" style="cursor:pointer;border-bottom:1px solid #ececf0;padding:14px" onclick="window._v10Move(\'' + g.id + '\')"><div class="rowmain"><div class="title">' + esc(g.name) + '</div>' + (count ? '<div class="desc">已在该组：' + count + ' 张</div>' : '') + '</div><span class="chev">›</span></div>';
    });
    html += '</div><button class="action" style="margin-top:14px" onclick="window._v10Create()">＋ 新建分组并移入</button>';
    modal('移动到分组', html);
  }

  window._v10Move = function(gid) {
    let count = 0;
    state.cards.forEach(c => { if (window._v10Sel.has(String(c.id))) { c.group = gid; count++; } });
    save().then(() => {
      closeModal();
      showToast('已移动 ' + count + ' 张');
      window._v10Sel.clear();
      renderCards();
      setTimeout(() => { applyMultiToCards(); updateBar(); }, 100);
    });
  };

  window._v10Create = function() {
    const name = prompt('新建分组名称：');
    if (!name || !name.trim()) return;
    const trimmed = name.trim();
    if (state.groups.some(g => String(g.name).trim() === trimmed)) { alert('分组已存在'); return; }
    const gid = 'g' + Date.now() + Math.random().toString(36).slice(2,7);
    state.groups.push({id: gid, name: trimmed, enabled: true, probability: 50});
    let count = 0;
    state.cards.forEach(c => { if (window._v10Sel.has(String(c.id))) { c.group = gid; count++; } });
    save().then(() => {
      closeModal();
      showToast('已新建并移动 ' + count + ' 张');
      window._v10Sel.clear();
      renderCards();
      setTimeout(() => { applyMultiToCards(); updateBar(); }, 100);
    });
  };

  function toggleSelected() {
    if (window._v10Sel.size === 0) return;
    const cards = state.cards.filter(c => window._v10Sel.has(String(c.id)));
    if (!cards.length) return;
    const allEnabled = cards.every(c => c.enabled !== false);
    const newState = !allEnabled;
    cards.forEach(c => c.enabled = newState);
    save().then(() => {
      showToast(newState ? '已启用 ' + cards.length + ' 张' : '已停用 ' + cards.length + ' 张');
      window._v10Sel.clear();
      renderCards();
      setTimeout(() => { applyMultiToCards(); updateBar(); }, 100);
    });
  }

  function deleteSelected() {
    if (window._v10Sel.size === 0) return;
    if (!confirm('确定删除选中的 ' + window._v10Sel.size + ' 张字卡吗？此操作不可恢复。')) return;
    state.cards = state.cards.filter(c => !window._v10Sel.has(String(c.id)));
    save().then(() => {
      showToast('已删除');
      window._v10Sel.clear();
      renderCards();
      setTimeout(() => { applyMultiToCards(); updateBar(); }, 100);
    });
  }

  function injectSelectButton() {
    const cardsPage = document.getElementById('cards');
    if (!cardsPage) return;
    const header = cardsPage.querySelector('.header');
    if (!header) return;
    if (header.querySelector('.multi-select-btn')) return;
    const plusBtn = header.querySelector('.plus');
    if (!plusBtn) return;
    const btn = document.createElement('button');
    btn.className = 'plus multi-select-btn';
    btn.textContent = window._v10Multi ? '完成' : '选择';
    btn.onclick = toggleMulti;
    header.insertBefore(btn, plusBtn);
  }

  function toggleMulti() {
    if (window._v10Multi) {
      window._v10Multi = false;
      window._v10Sel.clear();
      const page = document.getElementById('cards');
      if (page) page.classList.remove('multi-mode');
      const bar = document.getElementById('multiBar');
      if (bar) bar.remove();
      if (typeof renderCards === 'function') renderCards();
      setTimeout(injectSelectButton, 50);
    } else {
      window._v10Multi = true;
      window._v10Sel.clear();
      applyMultiToCards();
      setTimeout(injectSelectButton, 50);
    }
  }

  // 全局捕获点击
  document.addEventListener('click', function(e) {
    if (!window._v10Multi) return;
    const item = e.target.closest('#cardsList .cardItem');
    if (!item) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    const id = item.dataset.cardId;
    if (!id) return;
    const check = item.querySelector('.multiCheck');
    if (!check) return;
    if (window._v10Sel.has(id)) {
      window._v10Sel.delete(id);
      check.classList.remove('checked');
    } else {
      window._v10Sel.add(id);
      check.classList.add('checked');
    }
    updateBar();
  }, true);

  // 关键：每隔 300ms 主动 tag 一次新渲染的卡片
  setInterval(function() {
    if (!window._v10Multi) return;
    const page = document.getElementById('cards');
    if (!page) return;
    if (!page.classList.contains('multi-mode')) applyMultiToCards();
    const untagged = Array.from(document.querySelectorAll('#cardsList .cardItem')).some(it => !it.dataset.cardId || !it.classList.contains('multiSelect'));
    if (untagged) applyMultiToCards();
  }, 300);

  setTimeout(() => {
    injectSelectButton();
    const obs = new MutationObserver(() => injectSelectButton());
    obs.observe(document.body, { childList: true, subtree: false });
    console.log('✅ 字卡库多选模式 v10 已加载');
  }, 2500);
})();
// ====== v11：修复卡片 id 绑定（接管 renderCards） ======
(function() {
  if (window.__v11Loaded) return;
  window.__v11Loaded = true;

  const origRenderCards = window.renderCards;
  window.renderCards = function() {
    // 调用原函数生成 DOM
    if (origRenderCards) origRenderCards.apply(this, arguments);

    // 按筛选顺序给每张卡片打上正确 id
    const searchEl = document.getElementById('cardSearch');
    const q = (searchEl && searchEl.value || '').trim().toLowerCase();
    const arr = state.cards.filter(c => {
      if (currentType !== '全部' && c.type !== currentType) return false;
      if (currentGroup !== '全部' && c.group !== currentGroup) return false;
      if (q) { const t = (c.text || '').toLowerCase(); if (!t.includes(q)) return false; }
      return true;
    });
    const items = document.querySelectorAll('#cardsList .cardItem');
    items.forEach((item, idx) => {
      if (idx < arr.length) item.dataset.cardId = String(arr[idx].id);
    });
  };

  console.log('✅ v11 卡片 id 绑定修复已加载');
})();
// ====== v12：朋友圈互动频率改成分钟单位 ======
(function() {
  if (window.__v12Loaded) return;
  window.__v12Loaded = true;

  // 迁移旧数据：如果 momentPostMax 等值小于 60，说明是旧版（小时），×60 转成分钟
  function migrate() {
    const c = state && state.chatSettings;
    if (!c) return;
    if (c.momentPostMax !== undefined && c.momentPostMax > 0 && c.momentPostMax < 60) {
      c.momentPostMax = Math.round(c.momentPostMax * 60);
      c.momentLikeMax = Math.round((c.momentLikeMax || 1) * 60);
      c.momentCommentMax = Math.round((c.momentCommentMax || 1) * 60);
      c.momentReplyMax = Math.round((c.momentReplyMax || 1) * 60);
      save();
    }
  }

  // 重新定义 momentRange：返回分钟数
  window.momentRange = function(minMinutes, maxMinutes) {
    const min = Math.max(1, Number(minMinutes) || 1);
    const max = Math.max(min, Number(maxMinutes) || min);
    return min + Math.random() * (max - min);
  };

  // 重新定义各调度器，×60000（分钟 → 毫秒）
  window.scheduleMomentPost = function(){
    clearTimeout(momentPostTimer);
    const cs = state.chatSettings;
    momentPostTimer = setTimeout(function(){
      autoFriendMoment();
      scheduleMomentPost();
    }, momentRange(cs.momentPostMin, cs.momentPostMax) * 60000);
  };
  window.scheduleMomentLike = function(){
    clearTimeout(momentLikeTimer);
    const cs = state.chatSettings;
    momentLikeTimer = setTimeout(function(){
      autoFriendLike();
      scheduleMomentLike();
    }, momentRange(cs.momentLikeMin, cs.momentLikeMax) * 60000);
  };
  window.scheduleMomentComment = function(){
    clearTimeout(momentCommentTimer);
    const cs = state.chatSettings;
    momentCommentTimer = setTimeout(function(){
      autoFriendComment();
      scheduleMomentComment();
    }, momentRange(cs.momentCommentMin, cs.momentCommentMax) * 60000);
  };
  window.scheduleMomentReply = function(){
    clearTimeout(momentReplyTimer);
    const cs = state.chatSettings;
    momentReplyTimer = setTimeout(function(){
      autoFriendReply();
      scheduleMomentReply();
    }, momentRange(cs.momentReplyMin, cs.momentReplyMax) * 60000);
  };

  // 重新定义描述
  window.updateMomentInteractionDesc = function(){
    const d = document.getElementById('momentInteractionDesc');
    if (!d) return;
    const c = state.chatSettings;
    d.textContent = `发动态 ${c.momentPostMin}–${c.momentPostMax}分钟 · 点赞 ${c.momentLikeMin}–${c.momentLikeMax}分钟 · 评论 ${c.momentCommentMin}–${c.momentCommentMax}分钟 · 回复 ${c.momentReplyMin}–${c.momentReplyMax}分钟`;
  };

  // 重新定义设置弹窗（全部改成分钟）
  window.showMomentInteractionSettings = function(){
    const c = state.chatSettings;
    modal('朋友圈互动', `
      <div class="desc" style="margin-bottom:12px;line-height:1.6">好友会随机主动发朋友圈、点赞、评论。每项独立计时，都按分钟设置。</div>
      <div style="font-weight:600;margin:6px 0">对方发朋友圈</div>
      <div class="field"><label>最短间隔（分钟）</label><input id="mpMin" class="textinput" type="number" min="1" step="1" value="${c.momentPostMin}"></div>
      <div class="field"><label>最长间隔（分钟）</label><input id="mpMax" class="textinput" type="number" min="1" step="1" value="${c.momentPostMax}"></div>
      <div style="font-weight:600;margin:14px 0 6px">对方点赞</div>
      <div class="field"><label>最短间隔（分钟）</label><input id="mlMin" class="textinput" type="number" min="1" step="1" value="${c.momentLikeMin}"></div>
      <div class="field"><label>最长间隔（分钟）</label><input id="mlMax" class="textinput" type="number" min="1" step="1" value="${c.momentLikeMax}"></div>
      <div style="font-weight:600;margin:14px 0 6px">对方评论</div>
      <div class="field"><label>最短间隔（分钟）</label><input id="mcMin" class="textinput" type="number" min="1" step="1" value="${c.momentCommentMin}"></div>
      <div class="field"><label>最长间隔（分钟）</label><input id="mcMax" class="textinput" type="number" min="1" step="1" value="${c.momentCommentMax}"></div>
      <div style="font-weight:600;margin:14px 0 6px">对方回复我的评论</div>
      <div class="field"><label>最短间隔（分钟）</label><input id="mrMin" class="textinput" type="number" min="1" step="1" value="${c.momentReplyMin}"></div>
      <div class="field"><label>最长间隔（分钟）</label><input id="mrMax" class="textinput" type="number" min="1" step="1" value="${c.momentReplyMax}"></div>
      <div style="display:flex;gap:8px;margin-top:16px">
        <button class="action secondary" style="flex:1;margin:0" onclick="closeModal()">取消</button>
        <button class="action" style="flex:1;margin:0" onclick="saveMomentInteractionSettings()">保存</button>
      </div>
    `);
  };

  // 重新定义保存函数
  window.saveMomentInteractionSettings = function(){
    const c = state.chatSettings;
    const v = function(id) {
      const el = document.getElementById(id);
      return Math.max(1, Number(el ? el.value : 1) || 1);
    };
    let a, b;
    a = v('mpMin'); b = v('mpMax'); if (b < a) b = a;
    c.momentPostMin = a; c.momentPostMax = b;
    a = v('mlMin'); b = v('mlMax'); if (b < a) b = a;
    c.momentLikeMin = a; c.momentLikeMax = b;
    a = v('mcMin'); b = v('mcMax'); if (b < a) b = a;
    c.momentCommentMin = a; c.momentCommentMax = b;
    a = v('mrMin'); b = v('mrMax'); if (b < a) b = a;
    c.momentReplyMin = a; c.momentReplyMax = b;

    save();
    updateMomentInteractionDesc();
    closeModal();
    if (typeof startMomentSchedulers === 'function') startMomentSchedulers();
    showToast('朋友圈互动频率已保存（分钟）');
  };

  // 等 state 加载完后迁移
  setTimeout(function(){
    migrate();
    if (typeof updateMomentInteractionDesc === 'function') updateMomentInteractionDesc();
    if (typeof startMomentSchedulers === 'function') startMomentSchedulers();
    console.log('✅ 朋友圈互动频率已改成分钟单位');
  }, 2000);
})();
// ====== v14：朋友圈互动频率改分钟（拦截版） ======
(function(){
  if (window.__v14Loaded) return;
  window.__v14Loaded = true;

  // 迁移旧数据（小时 → 分钟）
  function mig(){
    const c = state && state.chatSettings;
    if (!c) return;
    if (c.momentPostMax && c.momentPostMax < 60) {
      c.momentPostMax = Math.round(c.momentPostMax * 60);
      c.momentLikeMax = Math.round((c.momentLikeMax || 1) * 60);
      c.momentCommentMax = Math.round((c.momentCommentMax || 1) * 60);
      c.momentReplyMax = Math.round((c.momentReplyMax || 1) * 60);
      save();
    }
  }

  // 频率按分钟
  window.momentRange = function(a, b){
    a = Math.max(1, Number(a) || 1);
    b = Math.max(a, Number(b) || a);
    return a + Math.random() * (b - a);
  };
  window.scheduleMomentPost = function(){
    clearTimeout(momentPostTimer);
    const cs = state.chatSettings;
    momentPostTimer = setTimeout(function(){ autoFriendMoment(); scheduleMomentPost(); }, momentRange(cs.momentPostMin, cs.momentPostMax) * 60000);
  };
  window.scheduleMomentLike = function(){
    clearTimeout(momentLikeTimer);
    const cs = state.chatSettings;
    momentLikeTimer = setTimeout(function(){ autoFriendLike(); scheduleMomentLike(); }, momentRange(cs.momentLikeMin, cs.momentLikeMax) * 60000);
  };
  window.scheduleMomentComment = function(){
    clearTimeout(momentCommentTimer);
    const cs = state.chatSettings;
    momentCommentTimer = setTimeout(function(){ autoFriendComment(); scheduleMomentComment(); }, momentRange(cs.momentCommentMin, cs.momentCommentMax) * 60000);
  };
  window.scheduleMomentReply = function(){
    clearTimeout(momentReplyTimer);
    const cs = state.chatSettings;
    momentReplyTimer = setTimeout(function(){ autoFriendReply(); scheduleMomentReply(); }, momentRange(cs.momentReplyMin, cs.momentReplyMax) * 60000);
  };

  // 新弹窗（标题带 v14 标记，方便确认生效）
  function openNewSettings(){
    const c = state.chatSettings;
    modal('朋友圈互动 · 分钟',
      '<div class="desc" style="margin-bottom:12px;line-height:1.6">好友会随机主动发朋友圈、点赞、评论。每项独立计时，都按分钟设置。</div>' +
      '<div style="font-weight:600;margin:6px 0">对方发朋友圈</div>' +
      '<div class="field"><label>最短（分钟）</label><input id="mpMin" class="textinput" type="number" min="1" value="' + c.momentPostMin + '"></div>' +
      '<div class="field"><label>最长（分钟）</label><input id="mpMax" class="textinput" type="number" min="1" value="' + c.momentPostMax + '"></div>' +
      '<div style="font-weight:600;margin:14px 0 6px">对方点赞</div>' +
      '<div class="field"><label>最短（分钟）</label><input id="mlMin" class="textinput" type="number" min="1" value="' + c.momentLikeMin + '"></div>' +
      '<div class="field"><label>最长（分钟）</label><input id="mlMax" class="textinput" type="number" min="1" value="' + c.momentLikeMax + '"></div>' +
      '<div style="font-weight:600;margin:14px 0 6px">对方评论</div>' +
      '<div class="field"><label>最短（分钟）</label><input id="mcMin" class="textinput" type="number" min="1" value="' + c.momentCommentMin + '"></div>' +
      '<div class="field"><label>最长（分钟）</label><input id="mcMax" class="textinput" type="number" min="1" value="' + c.momentCommentMax + '"></div>' +
      '<div style="font-weight:600;margin:14px 0 6px">对方回复我的评论</div>' +
      '<div class="field"><label>最短（分钟）</label><input id="mrMin" class="textinput" type="number" min="1" value="' + c.momentReplyMin + '"></div>' +
      '<div class="field"><label>最长（分钟）</label><input id="mrMax" class="textinput" type="number" min="1" value="' + c.momentReplyMax + '"></div>' +
      '<div style="display:flex;gap:8px;margin-top:16px">' +
      '<button class="action secondary" style="flex:1;margin:0" onclick="closeModal()">取消</button>' +
      '<button class="action" style="flex:1;margin:0" onclick="window.__v14Save()">保存</button>' +
      '</div>'
    );
  }

  window.__v14Save = function(){
    const c = state.chatSettings;
    function v(id){ const el = document.getElementById(id); return Math.max(1, Number(el ? el.value : 1) || 1); }
    let a, b;
    a = v('mpMin'); b = v('mpMax'); if (b < a) b = a; c.momentPostMin = a; c.momentPostMax = b;
    a = v('mlMin'); b = v('mlMax'); if (b < a) b = a; c.momentLikeMin = a; c.momentLikeMax = b;
    a = v('mcMin'); b = v('mcMax'); if (b < a) b = a; c.momentCommentMin = a; c.momentCommentMax = b;
    a = v('mrMin'); b = v('mrMax'); if (b < a) b = a; c.momentReplyMin = a; c.momentReplyMax = b;
    save();
    const d = document.getElementById('momentInteractionDesc');
    if (d) d.textContent = '发动态 ' + c.momentPostMin + '–' + c.momentPostMax + '分钟 · 点赞 ' + c.momentLikeMin + '–' + c.momentLikeMax + '分钟 · 评论 ' + c.momentCommentMin + '–' + c.momentCommentMax + '分钟 · 回复 ' + c.momentReplyMin + '–' + c.momentReplyMax + '分钟';
    closeModal();
    if (typeof startMomentSchedulers === 'function') startMomentSchedulers();
    showToast('朋友圈互动频率已保存（分钟）');
  };

  // 关键：捕获阶段拦截点击
  document.addEventListener('click', function(e){
    let node = e.target;
    while (node && node !== document.body) {
      const oc = node.getAttribute ? node.getAttribute('onclick') : null;
      if (oc && oc.indexOf('showMomentInteractionSettings') !== -1) {
        e.preventDefault();
        e.stopPropagation();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        openNewSettings();
        return;
      }
      node = node.parentNode;
    }
  }, true);

  // 启动
  function init(){
    if (state && state.chatSettings) {
      mig();
      if (typeof startMomentSchedulers === 'function') startMomentSchedulers();
      const c = state.chatSettings;
      const d = document.getElementById('momentInteractionDesc');
      if (d) d.textContent = '发动态 ' + c.momentPostMin + '–' + c.momentPostMax + '分钟 · 点赞 ' + c.momentLikeMin + '–' + c.momentLikeMax + '分钟 · 评论 ' + c.momentCommentMin + '–' + c.momentCommentMax + '分钟 · 回复 ' + c.momentReplyMin + '–' + c.momentReplyMax + '分钟';
      console.log('✅ v14 已加载');
    } else {
      setTimeout(init, 500);
    }
  }
  setTimeout(init, 2000);
})();
// ====== v15：朋友圈互动频率改分钟（改 onclick 属性版） ======
(function(){
  if (window.__v15) return;
  window.__v15 = true;

  function mig(){
    const c = state && state.chatSettings;
    if (!c) return;
    if (c.momentPostMax && c.momentPostMax < 60){
      c.momentPostMax = c.momentPostMax * 60;
      c.momentLikeMax = (c.momentLikeMax || 1) * 60;
      c.momentCommentMax = (c.momentCommentMax || 1) * 60;
      c.momentReplyMax = (c.momentReplyMax || 1) * 60;
      save();
    }
  }

  window.__v15Show = function(){
    const c = state.chatSettings;
    function f(id, label, val){
      return '<div class="field"><label>' + label + '</label><input id="' + id + '" class="textinput" type="number" min="1" value="' + val + '"></div>';
    }
    modal('朋友圈互动 · 分钟',
      '<div class="desc" style="margin-bottom:12px;line-height:1.6">每项都按分钟设置。</div>' +
      '<div style="font-weight:600;margin:6px 0">对方发朋友圈</div>' +
      f('mpMin','最短（分钟）', c.momentPostMin) +
      f('mpMax','最长（分钟）', c.momentPostMax) +
      '<div style="font-weight:600;margin:14px 0 6px">对方点赞</div>' +
      f('mlMin','最短（分钟）', c.momentLikeMin) +
      f('mlMax','最长（分钟）', c.momentLikeMax) +
      '<div style="font-weight:600;margin:14px 0 6px">对方评论</div>' +
      f('mcMin','最短（分钟）', c.momentCommentMin) +
      f('mcMax','最长（分钟）', c.momentCommentMax) +
      '<div style="font-weight:600;margin:14px 0 6px">对方回复我的评论</div>' +
      f('mrMin','最短（分钟）', c.momentReplyMin) +
      f('mrMax','最长（分钟）', c.momentReplyMax) +
      '<div style="display:flex;gap:8px;margin-top:16px">' +
      '<button class="action secondary" style="flex:1;margin:0" onclick="closeModal()">取消</button>' +
      '<button class="action" style="flex:1;margin:0" onclick="window.__v15Save()">保存</button>' +
      '</div>'
    );
  };

  window.__v15Save = function(){
    const c = state.chatSettings;
    function v(id){ const el = document.getElementById(id); return Math.max(1, Number(el ? el.value : 1) || 1); }
    let a, b;
    a = v('mpMin'); b = v('mpMax'); if (b < a) b = a; c.momentPostMin = a; c.momentPostMax = b;
    a = v('mlMin'); b = v('mlMax'); if (b < a) b = a; c.momentLikeMin = a; c.momentLikeMax = b;
    a = v('mcMin'); b = v('mcMax'); if (b < a) b = a; c.momentCommentMin = a; c.momentCommentMax = b;
    a = v('mrMin'); b = v('mrMax'); if (b < a) b = a; c.momentReplyMin = a; c.momentReplyMax = b;
    save();
    const d = document.getElementById('momentInteractionDesc');
    if (d) d.textContent = '发动态 ' + c.momentPostMin + '–' + c.momentPostMax + '分钟 · 点赞 ' + c.momentLikeMin + '–' + c.momentLikeMax + '分钟 · 评论 ' + c.momentCommentMin + '–' + c.momentCommentMax + '分钟 · 回复 ' + c.momentReplyMin + '–' + c.momentReplyMax + '分钟';
    closeModal();
    showToast('已保存（分钟）');
  };

  // 关键：直接改 onclick 属性
  setInterval(function(){
    document.querySelectorAll('[onclick*="showMomentInteractionSettings"]').forEach(function(el){
      el.setAttribute('onclick', 'window.__v15Show()');
    });
  }, 500);

  setTimeout(function(){
    mig();
    if (state && state.chatSettings) {
      const c = state.chatSettings;
      const d = document.getElementById('momentInteractionDesc');
      if (d) d.textContent = '发动态 ' + c.momentPostMin + '–' + c.momentPostMax + '分钟 · 点赞 ' + c.momentLikeMin + '–' + c.momentLikeMax + '分钟 · 评论 ' + c.momentCommentMin + '–' + c.momentCommentMax + '分钟 · 回复 ' + c.momentReplyMin + '–' + c.momentReplyMax + '分钟';
    }
  }, 2000);

  console.log('✅ v15 已加载');
})();
// ====== v16：朋友圈互动独立调度器（分钟单位） ======
(function(){
  if (window.__v16) return;
  window.__v16 = true;

  function mig(){
    const c = state && state.chatSettings;
    if (!c) return;
    if (c.momentPostMax && c.momentPostMax < 60){
      c.momentPostMax = c.momentPostMax * 60;
      c.momentLikeMax = (c.momentLikeMax || 1) * 60;
      c.momentCommentMax = (c.momentCommentMax || 1) * 60;
      c.momentReplyMax = (c.momentReplyMax || 1) * 60;
      save();
    }
  }

  window.__v16Next = { post: 0, like: 0, comment: 0, reply: 0 };

  function pick(min, max){
    min = Math.max(1, Number(min) || 1);
    max = Math.max(min, Number(max) || min);
    return (min + Math.random() * (max - min)) * 60000;
  }
  function sched(key, min, max){
    window.__v16Next[key] = Date.now() + pick(min, max);
  }
  function ensure(){
    const c = state.chatSettings;
    if (!window.__v16Next.post) sched('post', c.momentPostMin, c.momentPostMax);
    if (!window.__v16Next.like) sched('like', c.momentLikeMin, c.momentLikeMax);
    if (!window.__v16Next.comment) sched('comment', c.momentCommentMin, c.momentCommentMax);
    if (!window.__v16Next.reply) sched('reply', c.momentReplyMin, c.momentReplyMax);
  }

  // 每 20 秒扫一次，到点触发
  setInterval(function(){
    if (!state || !state.chatSettings) return;
    ensure();
    const c = state.chatSettings;
    const now = Date.now();
    if (now >= window.__v16Next.post){
      if (typeof autoFriendMoment === 'function') autoFriendMoment();
      sched('post', c.momentPostMin, c.momentPostMax);
    }
    if (now >= window.__v16Next.like){
      if (typeof autoFriendLike === 'function') autoFriendLike();
      sched('like', c.momentLikeMin, c.momentLikeMax);
    }
    if (now >= window.__v16Next.comment){
      if (typeof autoFriendComment === 'function') autoFriendComment();
      sched('comment', c.momentCommentMin, c.momentCommentMax);
    }
    if (now >= window.__v16Next.reply){
      if (typeof autoFriendReply === 'function') autoFriendReply();
      sched('reply', c.momentReplyMin, c.momentReplyMax);
    }
  }, 20000);

  // 设置保存后重新调度
  window.__v16Reschedule = function(){
    sched('post', state.chatSettings.momentPostMin, state.chatSettings.momentPostMax);
    sched('like', state.chatSettings.momentLikeMin, state.chatSettings.momentLikeMax);
    sched('comment', state.chatSettings.momentCommentMin, state.chatSettings.momentCommentMax);
    sched('reply', state.chatSettings.momentReplyMin, state.chatSettings.momentReplyMax);
    showToast('朋友圈调度已重置');
  };

  setTimeout(function(){
    mig();
    ensure();
    console.log('✅ v16 朋友圈独立调度器已启动');
  }, 2000);
})();
// ====== 优化测试按钮样式 ======
(function(){
  if (window.__niceBtn) return;
  window.__niceBtn = true;

  setInterval(function(){
    const top = document.querySelector('#moments .momActionsTop');
    if (!top) return;

    const all = top.querySelectorAll('.momTestBtn, .v17btn, .v19btn, .v20btn');
    all.forEach(function(b){
      if (b.dataset.styled === '1') return;
      b.dataset.styled = '1';
      b.textContent = '';
      b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;display:block"><path d="M21 12a9 9 0 1 1-3-6.7"></path><path d="M21 4v5h-5"></path></svg>';
      b.className = 'momMore momTestBtn';
      b.style.cssText = 'background:rgba(255,255,255,.84);color:#222;width:38px;height:38px;border-radius:50%;display:grid;place-items:center;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)';
    });

    const btns = top.querySelectorAll('.momTestBtn, .v17btn, .v19btn, .v20btn');
    if (btns.length > 1) {
      for (let i = 1; i < btns.length; i++) btns[i].remove();
    }
  }, 400);
})();
// ====== 朋友圈触发按钮 ======
(function(){
  if (window.__momBtn) return;
  window.__momBtn = true;

  setInterval(function(){
    const top = document.querySelector('#moments .momActionsTop');
    if (!top) return;

    // 清理多余的
    const all = top.querySelectorAll('.momTestBtn');
    for (let i = 1; i < all.length; i++) all[i].remove();
    if (top.querySelector('.momTestBtn')) return;

    const b = document.createElement('button');
    b.className = 'momMore momTestBtn';
    b.setAttribute('aria-label', '触发朋友圈互动');
    b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px;display:block"><path d="M21 12a9 9 0 1 1-3-6.7"></path><path d="M21 4v5h-5"></path></svg>';
    b.onclick = function(){
      if (typeof autoFriendMoment === 'function') autoFriendMoment();
      setTimeout(function(){ if (typeof autoFriendLike === 'function') autoFriendLike(); }, 300);
      setTimeout(function(){ if (typeof autoFriendComment === 'function') autoFriendComment(); }, 600);
      if (typeof showToast === 'function') showToast('已触发');
    };
    top.appendChild(b);
  }, 800);
})();
// ====== 头像点击 + 性能优化 ======
(function(){

  // ========== Part 1: 点聊天页顶部头像 → 触发对方回复 ==========
  if (!window.__tapAvatar) {
    window.__tapAvatar = true;
    let lastTap = 0;

    const style = document.createElement('style');
    style.textContent = `
      .chatTopAvatar.tapped { animation: avatarTap 0.35s ease; }
      @keyframes avatarTap {
        0% { transform: scale(1); }
        40% { transform: scale(0.82); }
        100% { transform: scale(1); }
      }
    `;
    document.head.appendChild(style);

    document.addEventListener('click', function(e){
      const av = e.target.closest('#chat .chatTopAvatar');
      if (!av) return;
      const chatPage = document.getElementById('chat');
      if (!chatPage || !chatPage.classList.contains('active')) return;
      if (typeof currentFriend === 'undefined' || !currentFriend) return;

      e.preventDefault();
      e.stopPropagation();

      const now = Date.now();
      if (now - lastTap < 2000) {
        if (typeof showToast === 'function') showToast('稍等一下再点');
        return;
      }
      lastTap = now;

      if (navigator.vibrate) { try { navigator.vibrate(30); } catch(err) {} }

      av.classList.remove('tapped');
      void av.offsetWidth;
      av.classList.add('tapped');

      const activeCards = state.cards.filter(c => {
        if (c.enabled === false) return false;
        if (c.probability === undefined || c.probability <= 0) return false;
        const g = state.groups.find(x => x.id === c.group);
        if (!g || g.enabled === false) return false;
        return true;
      });
      if (!activeCards.length) {
        if (typeof showToast === 'function') showToast('字卡库里没有可用的字卡');
        return;
      }

      clearTimeout(currentFriend._cardTimer);
      clearTimeout(currentFriend._typingTimer);

      if (typeof runCardPopup === 'function') {
        try { runCardPopup(currentFriend); } catch (err) { console.log('触发失败:', err); }
      }
    }, true);

    console.log('✅ 点头像触发回复已加载');
  }

  // ========== Part 2: save 节流（发消息不卡） ==========
  if (!window.__saveThrottle) {
    window.__saveThrottle = true;
    const origSave = window.save;
    let saveTimer = null;
    let pendingResolvers = [];

    // 多次调用合并成一次写盘（600ms 内）
    window.save = function() {
      return new Promise(function(resolve) {
        pendingResolvers.push(resolve);
        clearTimeout(saveTimer);
        saveTimer = setTimeout(function() {
          const resolvers = pendingResolvers.slice();
          pendingResolvers = [];
          try {
            if (typeof origSave === 'function') {
              const p = origSave();
              if (p && p.then) {
                p.then(function(){ resolvers.forEach(function(r){ r(); }); })
                 .catch(function(){ resolvers.forEach(function(r){ r(); }); });
              } else {
                resolvers.forEach(function(r){ r(); });
              }
            } else {
              resolvers.forEach(function(r){ r(); });
            }
          } catch(err) {
            resolvers.forEach(function(r){ r(); });
          }
        }, 600);
      });
    };

    // 切到后台 / 关页面时，立即写盘（防止数据丢失）
    function flushSave() {
      if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
        if (typeof origSave === 'function') { try { origSave(); } catch(err) {} }
        const resolvers = pendingResolvers.slice();
        pendingResolvers = [];
        resolvers.forEach(function(r){ r(); });
      }
    }
    document.addEventListener('visibilitychange', function() {
      if (document.hidden) flushSave();
    });
    window.addEventListener('pagehide', flushSave);
    window.addEventListener('beforeunload', flushSave);

    console.log('✅ save 节流已启用');
  }

})();
// ====== 修复字卡按钮（事件委托版） ======
(function(){
  if (window.__cardBtnsFix) return;
  window.__cardBtnsFix = true;

  // 获取当前筛选后的字卡数组（和 renderCards 里过滤逻辑一致）
  function getCurrentCards() {
    const searchEl = document.getElementById('cardSearch');
    const q = (searchEl && searchEl.value || '').trim().toLowerCase();
    return state.cards.filter(c => {
      if (currentType !== '全部' && c.type !== currentType) return false;
      if (currentGroup !== '全部' && c.group !== currentGroup) return false;
      if (q) { const t = (c.text || '').toLowerCase(); if (!t.includes(q)) return false; }
      return true;
    });
  }

  // 从卡片 DOM 里拿到正确的 id（优先 dataset，其次按索引）
  function getCardId(item) {
    if (item.dataset.cardId) return item.dataset.cardId;
    const items = Array.from(document.querySelectorAll('#cardsList .cardItem'));
    const idx = items.indexOf(item);
    if (idx < 0) return null;
    const arr = getCurrentCards();
    if (idx >= arr.length) return null;
    const id = String(arr[idx].id);
    item.dataset.cardId = id;
    return id;
  }

  // 全局捕获阶段：拦截卡片上的三个按钮
  document.addEventListener('click', function(e){
    // 只在字卡库页面、非多选模式下生效
    const cardsPage = document.getElementById('cards');
    if (!cardsPage || !cardsPage.classList.contains('active')) return;
    if (window._multiOn) return; // 多选模式下不处理，交给多选逻辑

    const item = e.target.closest('#cardsList .cardItem');
    if (!item) return;

    const btn = e.target.closest('button');
    if (!btn) return;

    // 判断按钮类型
    let action = null;
    if (btn.classList.contains('switch')) action = 'toggle';
    else if (btn.getAttribute('aria-label') === '编辑') action = 'edit';
    else if (btn.getAttribute('aria-label') === '删除') action = 'delete';
    else return;

    e.preventDefault();
    e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();

    const id = getCardId(item);
    if (!id) return;

    if (action === 'toggle' && typeof toggleCard === 'function') toggleCard(id);
    else if (action === 'edit' && typeof editCard === 'function') editCard(id);
    else if (action === 'delete' && typeof deleteCard === 'function') deleteCard(id);
  }, true);

  console.log('✅ 字卡按钮事件委托已启用');
})();
// ====== 表情包布局修复 + 聊天滚动到底部 ======
(function(){

  // 1. 表情包面板布局修复（避免重叠）
  const style = document.createElement('style');
  style.textContent = `
    .stickerPanel {
      display: grid !important;
      grid-template-columns: repeat(4, 1fr) !important;
      gap: 8px !important;
      align-items: start !important;
      grid-auto-rows: 0 !important;
    }
    .stickerItem {
      position: relative !important;
      width: 100% !important;
      height: 0 !important;
      padding-bottom: 100% !important;
      aspect-ratio: auto !important;
      border-radius: 10px !important;
      overflow: hidden !important;
      background: #fff !important;
    }
    .stickerItem img {
      position: absolute !important;
      top: 0 !important;
      left: 0 !important;
      width: 100% !important;
      height: 100% !important;
      object-fit: cover !important;
      display: block !important;
    }
    .stickerDel {
      position: absolute !important;
      top: 4px !important;
      right: 4px !important;
      z-index: 3 !important;
    }
  `;
  document.head.appendChild(style);

  // 2. 让聊天气泡自动滚到底部（多重延迟，确保内容高度计算完成）
  if (!window.__scrollFix) {
    window.__scrollFix = true;

    function scrollBubblesToBottom() {
      const b = document.getElementById('bubbles');
      if (b) b.scrollTop = b.scrollHeight;
    }

    const origRenderBubbles = window.renderBubbles;
    window.renderBubbles = function() {
      const r = origRenderBubbles ? origRenderBubbles.apply(this, arguments) : undefined;
      requestAnimationFrame(scrollBubblesToBottom);
      setTimeout(scrollBubblesToBottom, 50);
      setTimeout(scrollBubblesToBottom, 200);
      setTimeout(scrollBubblesToBottom, 500);
      return r;
    };

    const origShowPage = window.showPage;
    window.showPage = function(id) {
      const r = origShowPage ? origShowPage.apply(this, arguments) : undefined;
      if (id === 'chat') {
        requestAnimationFrame(scrollBubblesToBottom);
        setTimeout(scrollBubblesToBottom, 50);
        setTimeout(scrollBubblesToBottom, 150);
        setTimeout(scrollBubblesToBottom, 350);
      }
      return r;
    };
  }

  console.log('✅ 表情包布局 + 聊天滚动修复已加载');
})();
