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
