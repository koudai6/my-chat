// ====== 字卡导入外挂补丁 ======

// 1. 覆盖导入逻辑，支持外部网站的分组格式
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
        
        // 检测外部网站的“分组”备份格式
        if (data && (data.customReplyGroups || data.customReplies)) {
          window.importExternalGroupedBackup(data);
          return;
        }
        
        // 检测标准格式
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

// 2. 处理外部网站的分组格式（重点！）
window.importExternalGroupedBackup = function(data) {
  if (!confirm('检测到外部网站的字卡备份（含分组），将覆盖当前字卡库。确定继续吗？')) return;
  
  let newGroups = [{id: 'public', name: '公共（未分组）', enabled: true, probability: 50}];
  let newCards = [];
  let now = Date.now();

  // 从 customReplyGroups 提取分组和字卡
  if (Array.isArray(data.customReplyGroups)) {
     data.customReplyGroups.forEach((g, index) => {
        let groupId = 'ext_g_' + now + '_' + index;
        
        newGroups.push({
           id: groupId,
           name: g.name || ('外部分组_' + index),
           enabled: true,
           probability: 50
        });

        if (Array.isArray(g.items)) {
           g.items.forEach((text, tIndex) => {
              if (!text || typeof text !== 'string') return;
              newCards.push({
                 id: 'ext_c_' + now + '_' + index + '_' + tIndex,
                 type: 'text',
                 text: text.trim(),
                 group: groupId,
                 enabled: true,
                 probability: 50,
                 cooldown: 0
              });
           });
        }
     });
  }

  // 从 customReplies 提取可能遗漏的扁平字卡（放入公共分组）
  if (Array.isArray(data.customReplies)) {
     let existingTexts = new Set(newCards.map(c => c.text));
     data.customReplies.forEach((text, index) => {
        if (!text || typeof text !== 'string') return;
        let trimmed = text.trim();
        if (!existingTexts.has(trimmed)) {
           newCards.push({
              id: 'ext_c_flat_' + now + '_' + index,
              type: 'text',
              text: trimmed,
              group: 'public',
              enabled: true,
              probability: 50,
              cooldown: 0
           });
           existingTexts.add(trimmed);
        }
     });
  }

  // 应用到系统状态
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

// 3. 修复“导入 JSON”按钮
window.importCardsJson = function() {
  if (typeof restoreBackup === 'function') {
    restoreBackup();
  } else {
    alert('导入功能未就绪，请重新上传最新版 index.html');
  }
};

console.log('✅ 字卡导入补丁已加载');
// ====== 性能与回复体验优化补丁 ======

// 1. 优化开聊天时的性能：先渲染气泡，再异步检查字卡状态
const origOpenChat = window.openChat;
window.openChat = function(id) {
  // 先快速渲染，让界面立即响应
  currentFriend = state.friends.find(f=>f.id===id)||state.friends[0];
  if(!currentFriend){showToast('没有好友');return;}
  if(!Array.isArray(currentFriend.chat)) currentFriend.chat=[];
  currentFriend.unread=0;

  $('chatName').textContent = currentFriend.name;
  $('chatId').textContent = 'ID：' + currentFriend.uid;
  let ca = $('chatAvatar');
  if (isImgAvatar(currentFriend.avatar)) {
    ca.innerHTML = `<img src="${currentFriend.avatar}" alt="">`;
  } else {
    ca.textContent = (currentFriend.avatar || currentFriend.name || '?').toString().charAt(0);
  }

  // 只渲染气泡，先不检查字卡冷却/分组
  renderBubbles();
  applyChatBg();
  applyDecorationToChat();
  showPage('chat');

  // 把保存放到空闲时间执行，不阻塞界面
  if (window.requestIdleCallback) {
    requestIdleCallback(()=>save());
  } else {
    setTimeout(()=>save(), 100);
  }
};

// 2. 让“我发消息后”对方立即显示正在输入，再按时弹出字卡
window.sendMsg = function() {
  let i = $('msgInput'), t = i.value.trim();
  if(!t || !currentFriend) return;

  let msg = { who:'me', text:t, time:now() };
  if(window._pendingQuote){ msg.quote = window._pendingQuote; clearPendingQuote(); }
  currentFriend.chat.push(msg);
  i.value = '';
  save();
  renderBubbles();

  // —— 关键改动：立即显示对方“正在输入…”动画 ——
  const friend = currentFriend;
  clearTimeout(friend._cardTimer);
  clearTimeout(friend._typingTimer);

  // 先标记“正在输入”，立刻渲染出打字动画
  friend._typing = true;
  if(friend === currentFriend) renderBubbles();

  // 按设置的延迟时间后弹出字卡
  let cs = state.chatSettings || {};
  let min = Math.max(1, +cs.min || 30);
  let max = Math.max(min, +cs.max || 120);
  let delay = (min + Math.random() * (max - min)) * 1000;

  friend._typingTimer = setTimeout(() => {
    friend._typing = false;
    if(friend === currentFriend) renderBubbles();
    // 走字卡随机弹出逻辑
    if (typeof runCardPopup === 'function') {
      runCardPopup(friend);
    }
  }, delay);
};

// 覆盖主动发送调度器（避免两个调度器同时跑）
if (typeof startActiveSendScheduler === 'function') {
  const origStartActive = window.startActiveSendScheduler;
  window.startActiveSendScheduler = function() {
    // 不改动原逻辑
    origStartActive();
  };
}

console.log('✅ 性能与回复体验优化补丁已加载');
// ====== 锁定横向滑动补丁 ======
(function() {
  const style = document.createElement('style');
  style.textContent = `
    /* 聊天消息区：禁止横向滑动，只允许上下滚动 */
    #bubbles {
      overflow-x: hidden !important;
      touch-action: pan-y !important;
      overscroll-behavior-x: none !important;
      max-width: 100% !important;
      width: 100% !important;
    }
    /* 每条气泡行：不允许溢出 */
    #bubbles .bubbleRow,
    #bubbles .msgWrap,
    #bubbles .bubble {
      max-width: 100% !important;
      min-width: 0 !important;
    }
    /* 图片：不超过气泡宽度 */
    #bubbles img {
      max-width: 100% !important;
      height: auto;
    }
    /* 整个页面：禁止横向滚动 */
    html, body, .app {
      overflow-x: hidden !important;
      max-width: 100vw !important;
    }
  `;
  document.head.appendChild(style);
  console.log('✅ 锁定横向滑动补丁已加载');
})();
// ====== 后台消息通知监听器 ======
(function() {
  // 记录每个好友"已通知过"的最后一条消息
  const notifiedKeys = {};

  // 初始化：先把当前所有好友的最后一条消息标记为"已通知"，避免历史消息炸屏
  function initSeen() {
    (state.friends || []).forEach(f => {
      if (!Array.isArray(f.chat) || !f.chat.length) return;
      const last = f.chat[f.chat.length - 1];
      if (!last) return;
      notifiedKeys[f.id] = (last.text || '') + '|' + last.time + '|' + (last.image ? 'img' : '');
    });
  }

  // 每 3 秒扫一次
  function scan() {
    if (!Array.isArray(state.friends)) return;
    state.friends.forEach(f => {
      if (!Array.isArray(f.chat) || !f.chat.length) return;
      const last = f.chat[f.chat.length - 1];
      if (!last || last.who !== 'other') return;

      const key = (last.text || '') + '|' + last.time + '|' + (last.image ? 'img' : '');
      if (notifiedKeys[f.id] === key) return;
      notifiedKeys[f.id] = key;

      // 判断是否需要弹通知：
      // 1. 页面在后台（document.hidden）
      // 2. 或者当前不在这个好友的聊天页
      const isViewingThis = (typeof currentFriend !== 'undefined' && currentFriend && currentFriend.id === f.id && !document.hidden);
      if (isViewingThis) return;

      // 发通知
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        const title = f.name || '新消息';
        let body = last.text || '';
        if (last.image && !body) body = '[图片/表情包]';
        if (typeof showNotification === 'function') {
          showNotification(title, body);
        } else if (navigator.serviceWorker && navigator.serviceWorker.ready) {
          navigator.serviceWorker.ready.then(reg => {
            reg.showNotification(title, {
              body: body,
              icon: 'icon-192.PNG',
              tag: 'chat-' + f.id
            });
          }).catch(()=>{});
        }
      }
    });
  }

  // 等应用初始化完成后再开始扫描
  setTimeout(() => {
    initSeen();
    setInterval(scan, 3000);
    console.log('✅ 后台消息通知监听器已启动');
  }, 2000);
})();
// ====== 时间显示修复补丁 ======
(function() {
  function formatTs(str) {
    if (!str) return str;
    const s = String(str).trim();
    if (!/^\d+$/.test(s)) return str; // 不是纯数字，原样返回
    let num = Number(s);
    if (isNaN(num)) return str;

    let ms;
    if (s.length >= 12) ms = num;         // 13位毫秒时间戳
    else if (s.length >= 9) ms = num * 1000; // 10位秒时间戳
    else return str;

    const d = new Date(ms);
    if (isNaN(d.getTime())) return str;
    const y = d.getFullYear();
    if (y < 2000 || y > 2100) return str;

    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    const now = new Date();
    // 今天显示 HH:MM
    if (d.toDateString() === now.toDateString()) return hh + ':' + mi;
    // 昨天
    const yest = new Date(now);
    yest.setDate(now.getDate() - 1);
    if (d.toDateString() === yest.toDateString()) return '昨天';
    // 其他显示 月/日
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return mm + '/' + dd;
  }

  function fixTimeDisplay() {
    document.querySelectorAll('#chatList .value').forEach(el => {
      const t = el.textContent.trim();
      const f = formatTs(t);
      if (f !== t) el.textContent = f;
    });
    document.querySelectorAll('#bubbles .bubbleMeta').forEach(el => {
      const t = el.textContent.trim();
      const f = formatTs(t);
      if (f !== t) el.textContent = f;
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
// ====== 强化版后台保活（控制中心媒体卡片） ======
(function() {
  // 覆盖原有的 startKeepAlive
  window.startKeepAlive = function() {
    if (window.keepAliveAudio && !window.keepAliveAudio.paused) return;

    // 用一段 1 秒左右的静音 WAV（比之前的稍长，避免 iOS 判为瞬时音频）
    const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';

    window.keepAliveAudio = new Audio(SILENT_WAV);
    window.keepAliveAudio.loop = true;
    // 关键：音量不能是 0，iOS 会认为没有播放；也不能大，吵人。0.01 刚刚好
    window.keepAliveAudio.volume = 0.01;
    window.keepAliveAudio.setAttribute('playsinline', 'true');

    window.keepAliveAudio.play().then(() => {
      console.log('✅ 静音保活已启动');
    }).catch(e => console.log('保活启动失败:', e));

    // 设置完整的 Media Session，让锁屏/控制中心显示卡片
    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: '简约聊天',
          artist: '后台运行中',
          album: '聊天保活',
          artwork: [
            { src: 'icon-192.PNG', sizes: '192x192', type: 'image/png' },
            { src: 'icon-192.PNG', sizes: '512x512', type: 'image/png' }
          ]
        });

        navigator.mediaSession.playbackState = 'playing';

        navigator.mediaSession.setActionHandler('play', () => {
          if (window.keepAliveAudio) window.keepAliveAudio.play();
          navigator.mediaSession.playbackState = 'playing';
        });
        navigator.mediaSession.setActionHandler('pause', () => {
          if (window.keepAliveAudio) window.keepAliveAudio.pause();
          navigator.mediaSession.playbackState = 'paused';
        });
        navigator.mediaSession.setActionHandler('seekbackward', () => {});
        navigator.mediaSession.setActionHandler('seekforward', () => {});
      } catch (e) {
        console.log('MediaSession 设置失败:', e);
      }
    }

    // 再发一条欢迎通知，确认通知权限真的生效了
    setTimeout(() => {
      if (Notification.permission === 'granted' && navigator.serviceWorker && navigator.serviceWorker.ready) {
        navigator.serviceWorker.ready.then(reg => {
          reg.showNotification('简约聊天', {
            body: '后台保活已开启，你现在可以在后台收到消息提醒了',
            icon: 'icon-192.PNG',
            tag: 'keepalive-welcome'
          });
        }).catch(()=>{});
      }
    }, 500);
  };
})();
// ====== 升级版“后台消息推送”卡片 ======
(function() {
  function buildCard() {
    const mePage = document.getElementById('me');
    if (!mePage) { setTimeout(buildCard, 500); return; }

    // 移除旧版卡片（如果有）
    const oldBtn = document.getElementById('notifyBtn');
    if (oldBtn) {
      const oldCard = oldBtn.closest('.section.card');
      if (oldCard) oldCard.remove();
    }

    const card = document.createElement('div');
    card.className = 'section card';
    card.id = 'pushCard';

    const granted = (typeof Notification !== 'undefined' && Notification.permission === 'granted');
    const statusText = granted
      ? '后台消息推送✅ 已开启 — 当页面在后台时，收到消息会弹出系统通知'
      : '后台消息推送 — 点击右侧开关，允许系统通知';

    card.innerHTML = `
      <div class="row" style="align-items:flex-start;padding:14px 13px;gap:10px">
        <div class="icon settingsIcon iconSvg" style="background:#e9e9ec!important;color:#333!important">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M6 17h12l-1.4-1.8V10a4.6 4.6 0 0 0-9.2 0v5.2L6 17Z"></path>
            <path d="M10 20h4"></path>
          </svg>
        </div>
        <div class="rowmain" id="pushCardText" style="cursor:pointer;line-height:1.5">
          <div class="title" style="font-size:.92rem">${statusText}</div>
          <div class="desc" style="margin-top:4px">点击文字区域可发送一条测试通知</div>
        </div>
        <button class="switch ${granted ? 'on' : ''}" id="pushSwitch"><i></i></button>
      </div>
    `;

    // 插到设置卡片上面
    const settingsCard = mePage.querySelector('.section.card');
    if (settingsCard && settingsCard.nextSibling) {
      mePage.insertBefore(card, settingsCard.nextSibling);
    } else {
      mePage.appendChild(card);
    }

    // —— 开关逻辑 ——
    const sw = card.querySelector('#pushSwitch');
    const textEl = card.querySelector('#pushCardText');

    function updateCard() {
      const ok = (Notification.permission === 'granted');
      sw.classList.toggle('on', ok);
      textEl.querySelector('.title').textContent = ok
        ? '后台消息推送✅ 已开启 — 当页面在后台时，收到消息会弹出系统通知'
        : '后台消息推送 — 点击右侧开关，允许系统通知';
    }

    function sendTestNotification() {
      if (Notification.permission !== 'granted') {
        alert('请先开启右侧开关，允许系统通知');
        return;
      }
      if (navigator.serviceWorker && navigator.serviceWorker.ready) {
        navigator.serviceWorker.ready.then(reg => {
          reg.showNotification('简约聊天', {
            body: '这是一条测试通知，说明推送已生效 ✅',
            icon: 'icon-192.PNG',
            tag: 'test-notification-' + Date.now()
          });
        }).catch(()=>{});
      } else {
        new Notification('简约聊天', { body: '这是一条测试通知 ✅' });
      }
    }

    sw.onclick = function(e) {
      e.stopPropagation();
      if (Notification.permission === 'granted') {
        // 已经开启 → 提示不支持关闭（iOS 不允许代码撤销通知权限）
        alert('若想关闭，请前往 iPhone 设置 → 通知 → 简约聊天 中手动关闭');
        return;
      }
      Notification.requestPermission().then(perm => {
        if (perm === 'granted') {
          updateCard();
          if (typeof startKeepAlive === 'function') startKeepAlive();
          // 立刻发一条测试通知
          setTimeout(sendTestNotification, 300);
        } else {
          alert('你拒绝了通知权限，可在 iPhone 设置中重新开启');
          updateCard();
        }
      });
    };

    // 点击文字区域 → 发测试通知
    textEl.onclick = function() {
      sendTestNotification();
    };
  }

  // 应用初始化后延迟构建
  setTimeout(buildCard, 1500);
  // 每次从其他页回到“我的”页时刷新状态
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
        if (title) title.textContent = ok
          ? '后台消息推送✅ 已开启 — 当页面在后台时，收到消息会弹出系统通知'
          : '后台消息推送 — 点击右侧开关，允许系统通知';
      }
    }
    return r;
  };
})();
  // ====== 字卡库多选模式 v2 ======
(function() {
  let multiMode = false;
  const selectedIds = new Set();

  const styleEl = document.createElement('style');
  styleEl.textContent = `
    .multi-select-btn{width:auto!important;height:38px!important;border-radius:19px!important;padding:0 16px!important;font-size:.82rem!important;font-weight:600!important;background:#f0f0f4!important;color:#1a1a1e!important;display:grid;place-items:center;box-shadow:none!important;margin-right:8px;font-family:inherit;cursor:pointer}
    #cards.multi-mode .header .plus:not(.multi-select-btn){display:none!important}
    #cards.multi-mode #cardsList{padding-bottom:100px}
    .cardItem.multiSelect{padding-left:48px!important;position:relative;cursor:pointer}
    .cardItem.multiSelect .multiCheck{position:absolute;left:15px;top:50%;transform:translateY(-50%);width:22px;height:22px;border-radius:50%;border:1.5px solid #c7c7cc;display:grid;place-items:center;background:#fff;flex:none;transition:.15s;pointer-events:none}
    .cardItem.multiSelect .multiCheck.checked{background:#1a1a1e;border-color:#1a1a1e;color:#fff}
    .cardItem.multiSelect .multiCheck svg{width:13px;height:13px;display:none}
    .cardItem.multiSelect .multiCheck.checked svg{display:block}
    .cardItem.multiSelect .switch,
    .cardItem.multiSelect .cardTools{display:none!important}
    .multi-bar{position:fixed;left:50%;bottom:0;transform:translateX(-50%);width:min(100%,720px);background:#1a1a1e;color:#fff;display:flex;justify-content:space-around;align-items:center;padding:10px 8px calc(10px + env(safe-area-inset-bottom));z-index:80;box-shadow:0 -4px 20px rgba(0,0,0,.18);border-radius:20px 20px 0 0;box-sizing:border-box}
    .multi-bar button{color:#fff;font-size:.72rem;padding:6px 4px;display:flex;flex-direction:column;align-items:center;gap:3px;flex:1;background:transparent;border:0;cursor:pointer;min-width:0;font-family:inherit}
    .multi-bar button:disabled{opacity:.32}
    .multi-bar button svg{width:22px;height:22px;display:block}
    .multi-bar button.danger{color:#ff8a8a}
  `;
  document.head.appendChild(styleEl);

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
    btn.textContent = multiMode ? '完成' : '选择';
    btn.onclick = toggleMultiMode;
    header.insertBefore(btn, plusBtn);
  }

  function toggleMultiMode() {
    multiMode = !multiMode;
    selectedIds.clear();
    const cardsPage = document.getElementById('cards');
    const btn = cardsPage && cardsPage.querySelector('.multi-select-btn');
    if (btn) btn.textContent = multiMode ? '完成' : '选择';
    if (cardsPage) cardsPage.classList.toggle('multi-mode', multiMode);
    applyMultiState();
    updateBar();
  }

  function extractIdFromItem(item) {
    if (item.dataset && item.dataset.multiId) return item.dataset.multiId;
    const btns = item.querySelectorAll('button[onclick]');
    for (const b of btns) {
      const oc = b.getAttribute('onclick') || '';
      let m = oc.match(/toggleCard\((.+?)\)/);
      if (!m) m = oc.match(/editCard\((.+?)\)/);
      if (!m) m = oc.match(/deleteCard\((.+?)\)/);
      if (m) {
        try { return String(JSON.parse(m[1])); }
        catch(e) { return String(m[1]).replace(/^['"]|['"]$/g, ''); }
      }
    }
    return null;
  }

  function applyMultiState() {
    const cardsPage = document.getElementById('cards');
    if (!cardsPage) return;
    const items = cardsPage.querySelectorAll('#cardsList .cardItem');
    items.forEach(item => {
      if (multiMode) {
        item.classList.add('multiSelect');
        const id = extractIdFromItem(item);
        if (id !== null) item.dataset.multiId = id;

        if (!item.querySelector('.multiCheck')) {
          const check = document.createElement('div');
          check.className = 'multiCheck';
          check.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5L20 7"></path></svg>';
          item.insertBefore(check, item.firstChild);
        }

        // 用 addEventListener 绑定到 item 本身，避免与原有内联 onclick 冲突
        if (!item._multiBound) {
          item._multiBound = true;
          item.addEventListener('click', function(e) {
            if (!multiMode) return;
            e.preventDefault();
            e.stopPropagation();
            const sid = this.dataset.multiId;
            if (!sid) return;
            if (selectedIds.has(sid)) {
              selectedIds.delete(sid);
              this.querySelector('.multiCheck')?.classList.remove('checked');
            } else {
              selectedIds.add(sid);
              this.querySelector('.multiCheck')?.classList.add('checked');
            }
            updateBar();
          }, true); // 用捕获阶段，优先于原 onclick
        }

        if (selectedIds.has(item.dataset.multiId)) {
          item.querySelector('.multiCheck')?.classList.add('checked');
        } else {
          item.querySelector('.multiCheck')?.classList.remove('checked');
        }
      } else {
        item.classList.remove('multiSelect');
        const c = item.querySelector('.multiCheck');
        if (c) c.remove();
      }
    });
  }

  function updateBar() {
    const cardsPage = document.getElementById('cards');
    if (!cardsPage) return;
    let bar = document.getElementById('multiBar');
    if (!multiMode) {
      if (bar) bar.remove();
      return;
    }
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'multiBar';
      bar.className = 'multi-bar';
      bar.innerHTML = `
        <button id="mbSelectAll"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3 8-8"></path><path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9"></path></svg><span>全选</span></button>
        <button id="mbMove"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h13l-3-3"></path><path d="M3 17h13l-3 3"></path><path d="M3 12h18"></path></svg><span>移组</span></button>
        <button id="mbToggle"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><path d="M8 12h8"></path></svg><span id="mbToggleText">禁用</span></button>
        <button id="mbDelete" class="danger"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 7h14M9 7V5h6v2M8 7l1 13h6l1-13M10 10v7M14 10v7"></path></svg><span>删除</span></button>
      `;
      cardsPage.appendChild(bar);
      bar.querySelector('#mbSelectAll').onclick = selectAllCurrent;
      bar.querySelector('#mbMove').onclick = moveSelected;
      bar.querySelector('#mbToggle').onclick = toggleSelected;
      bar.querySelector('#mbDelete').onclick = deleteSelected;
    }
    const cards = state.cards.filter(c => selectedIds.has(String(c.id)));
    const toggleText = bar.querySelector('#mbToggleText');
    if (toggleText) {
      const allEnabled = cards.length > 0 && cards.every(c => c.enabled !== false);
      toggleText.textContent = (cards.length > 0 && allEnabled) ? '禁用' : '启用';
    }
    const noSel = selectedIds.size === 0;
    ['mbMove','mbToggle','mbDelete'].forEach(id => {
      const b = bar.querySelector('#' + id);
      if (b) b.disabled = noSel;
    });
    const selBtn = cardsPage.querySelector('.multi-select-btn');
    if (selBtn && multiMode) {
      selBtn.textContent = selectedIds.size > 0 ? `完成·${selectedIds.size}` : '完成';
    }
  }

  function selectAllCurrent() {
    const cardsPage = document.getElementById('cards');
    if (!cardsPage) return;
    const items = cardsPage.querySelectorAll('#cardsList .cardItem');
    const allSelected = items.length > 0 && Array.from(items).every(item => {
      const id = item.dataset.multiId;
      return id && selectedIds.has(id);
    });
    if (allSelected) {
      items.forEach(item => {
        if (item.dataset.multiId) selectedIds.delete(item.dataset.multiId);
        item.querySelector('.multiCheck')?.classList.remove('checked');
      });
    } else {
      items.forEach(item => {
        if (item.dataset.multiId) {
          selectedIds.add(item.dataset.multiId);
          item.querySelector('.multiCheck')?.classList.add('checked');
        }
      });
    }
    updateBar();
  }

  function moveSelected() {
    if (selectedIds.size === 0) return;
    const groups = [{id: 'public', name: '公共（未分组）'}, ...state.groups.filter(g => g.id !== 'public')];
    let html = `<div class="desc" style="margin-bottom:12px">将选中的 <b>${selectedIds.size}</b> 张字卡移动到：</div>`;
    html += `<div style="max-height:52vh;overflow:auto;background:#f6f6f8;border-radius:12px">`;
    groups.forEach(g => {
      const count = state.cards.filter(c => selectedIds.has(String(c.id)) && c.group === g.id).length;
      html += `<div class="row" style="cursor:pointer;border-bottom:1px solid #ececf0;padding:14px" onclick="window._multiMoveTo('${g.id}')"><div class="rowmain"><div class="title">${esc(g.name)}</div>${count ? `<div class="desc">已在该组：${count} 张</div>` : ''}</div><span class="chev">›</span></div>`;
    });
    html += `</div>`;
    html += `<button class="action" style="margin-top:14px" onclick="window._multiCreateAndMove()">＋ 新建分组并移入</button>`;
    if (typeof modal === 'function') modal('移动到分组', html);
  }

  window._multiMoveTo = function(gid) {
    let count = 0;
    state.cards.forEach(c => {
      if (selectedIds.has(String(c.id))) { c.group = gid; count++; }
    });
    save().then(() => {
      if (typeof closeModal === 'function') closeModal();
      if (typeof showToast === 'function') showToast(`已移动 ${count} 张字卡`);
      selectedIds.clear();
      if (typeof renderCards === 'function') renderCards();
      setTimeout(() => { applyMultiState(); updateBar(); }, 50);
    });
  };

  window._multiCreateAndMove = function() {
    const name = prompt('新建分组名称：');
    if (!name || !name.trim()) return;
    const trimmed = name.trim();
    if (state.groups.some(g => String(g.name).trim() === trimmed)) { alert('分组已存在'); return; }
    const newGid = 'g' + Date.now() + Math.random().toString(36).slice(2, 7);
    state.groups.push({ id: newGid, name: trimmed, enabled: true, probability: 50 });
    const count = selectedIds.size;
    state.cards.forEach(c => { if (selectedIds.has(String(c.id))) c.group = newGid; });
    save().then(() => {
      if (typeof closeModal === 'function') closeModal();
      if (typeof showToast === 'function') showToast(`已新建「${trimmed}」并移动 ${count} 张`);
      selectedIds.clear();
      if (typeof renderCards === 'function') renderCards();
      setTimeout(() => { applyMultiState(); updateBar(); }, 50);
    });
  };

  function toggleSelected() {
    if (selectedIds.size === 0) return;
    const cards = state.cards.filter(c => selectedIds.has(String(c.id)));
    if (!cards.length) return;
    const allEnabled = cards.every(c => c.enabled !== false);
    const newState = !allEnabled;
    cards.forEach(c => c.enabled = newState);
    save().then(() => {
      if (typeof showToast === 'function') showToast(newState ? `已启用 ${cards.length} 张` : `已停用 ${cards.length} 张`);
      if (typeof renderCards === 'function') renderCards();
      setTimeout(() => { applyMultiState(); updateBar(); }, 50);
    });
  }

  function deleteSelected() {
    if (selectedIds.size === 0) return;
    if (!confirm(`确定删除选中的 ${selectedIds.size} 张字卡吗？此操作不可恢复。`)) return;
    const before = state.cards.length;
    state.cards = state.cards.filter(c => !selectedIds.has(String(c.id)));
    const removed = before - state.cards.length;
    selectedIds.clear();
    save().then(() => {
      if (typeof showToast === 'function') showToast(`已删除 ${removed} 张字卡`);
      if (typeof renderCards === 'function') renderCards();
      setTimeout(() => { applyMultiState(); updateBar(); }, 50);
    });
  }

  function attachObserver() {
    const list = document.getElementById('cardsList');
    if (!list || list.dataset.multiObserved) return;
    list.dataset.multiObserved = '1';
    const obs = new MutationObserver(() => {
      if (!multiMode) return;
      // 渲染完成后重新绑定
      setTimeout(() => { applyMultiState(); updateBar(); }, 10);
    });
    obs.observe(list, { childList: true });
  }

  function hookShowPage() {
    if (window._multiShowPageHooked) return;
    window._multiShowPageHooked = true;
    const orig = window.showPage;
    window.showPage = function(id) {
      if (multiMode && id !== 'cards') {
        multiMode = false;
        selectedIds.clear();
        const btn = document.querySelector('#cards .multi-select-btn');
        if (btn) btn.textContent = '选择';
        document.getElementById('cards')?.classList.remove('multi-mode');
        document.getElementById('multiBar')?.remove();
      }
      const r = orig ? orig.apply(this, arguments) : undefined;
      if (id === 'cards') {
        setTimeout(() => {
          injectSelectButton();
          attachObserver();
          if (multiMode) applyMultiState();
        }, 80);
      }
      return r;
    };
  }

  setTimeout(() => {
    injectSelectButton();
    attachObserver();
    hookShowPage();
    console.log('✅ 字卡库多选模式 v2 已加载');
  }, 2500);
})();
// ====== 多选栏位置修正（防止被底部导航挡住） ======
(function() {
  function fixBar() {
    const bar = document.getElementById('multiBar');
    if (bar && bar.parentElement !== document.body) {
      document.body.appendChild(bar);
    }
    if (bar) {
      bar.style.setProperty('z-index', '99999', 'important');
      bar.style.setProperty('padding-bottom', 'calc(18px + env(safe-area-inset-bottom))', 'important');
      bar.style.setProperty('min-height', '64px', 'important');
    }
  }
  // 每 300 毫秒检查一次，一旦多选栏出现就把它挪到 body 上
  setInterval(fixBar, 300);
  console.log('✅ 多选栏位置修正已加载');
})();
// ====== 多选点击修复 v3 ======
(function() {
  let selectedIds = new Set();

  function getCardId(item) {
    const btns = item.querySelectorAll('button[onclick]');
    for (const b of btns) {
      const oc = b.getAttribute('onclick') || '';
      let m = oc.match(/toggleCard\((.+?)\)/);
      if (!m) m = oc.match(/editCard\((.+?)\)/);
      if (!m) m = oc.match(/deleteCard\((.+?)\)/);
      if (m) {
        try { return String(JSON.parse(m[1])); }
        catch(err) { return String(m[1]).replace(/^['"]|['"]$/g, ''); }
      }
    }
    return null;
  }

  function updateBar() {
    const bar = document.getElementById('multiBar');
    if (!bar) return;
    const noSel = selectedIds.size === 0;
    ['mbMove','mbToggle','mbDelete'].forEach(id => {
      const b = bar.querySelector('#' + id);
      if (b) b.disabled = noSel;
    });
    const selBtn = document.querySelector('#cards .multi-select-btn');
    if (selBtn) selBtn.textContent = selectedIds.size > 0 ? '完成·' + selectedIds.size : '完成';
  }

  function bindList() {
    const list = document.getElementById('cardsList');
    if (!list || list._v3Bound) return;
    list._v3Bound = true;
    list.addEventListener('click', function(e) {
      const cardsPage = document.getElementById('cards');
      if (!cardsPage || !cardsPage.classList.contains('multi-mode')) return;
      const item = e.target.closest('.cardItem');
      if (!item || !item.classList.contains('multiSelect')) return;
      e.preventDefault();
      e.stopPropagation();
      let id = item.dataset.multiId;
      if (!id) { id = getCardId(item); if (id) item.dataset.multiId = id; }
      if (!id) return;
      const check = item.querySelector('.multiCheck');
      if (!check) return;
      if (selectedIds.has(id)) {
        selectedIds.delete(id);
        check.classList.remove('checked');
      } else {
        selectedIds.add(id);
        check.classList.add('checked');
      }
      updateBar();
    }, true);
  }

  function patchButtons() {
    const bar = document.getElementById('multiBar');
    if (!bar || bar._v3Patched) return;
    bar._v3Patched = true;

    bar.querySelector('#mbSelectAll').onclick = function() {
      const items = document.querySelectorAll('#cardsList .cardItem');
      const allSel = items.length > 0 && Array.from(items).every(it => it.dataset.multiId && selectedIds.has(it.dataset.multiId));
      if (allSel) {
        items.forEach(it => {
          if (it.dataset.multiId) selectedIds.delete(it.dataset.multiId);
          it.querySelector('.multiCheck')?.classList.remove('checked');
        });
      } else {
        items.forEach(it => {
          if (!it.dataset.multiId) it.dataset.multiId = getCardId(it);
          if (it.dataset.multiId) {
            selectedIds.add(it.dataset.multiId);
            it.querySelector('.multiCheck')?.classList.add('checked');
          }
        });
      }
      updateBar();
    };

    bar.querySelector('#mbMove').onclick = function() {
      if (selectedIds.size === 0) return;
      const groups = [{id:'public',name:'公共（未分组）'}, ...state.groups.filter(g=>g.id!=='public')];
      let html = '<div class="desc" style="margin-bottom:12px">将选中的 <b>' + selectedIds.size + '</b> 张字卡移动到：</div>';
      html += '<div style="max-height:52vh;overflow:auto;background:#f6f6f8;border-radius:12px">';
      groups.forEach(g => {
        html += '<div class="row" style="cursor:pointer;border-bottom:1px solid #ececf0;padding:14px" onclick="window._v3Move(\'' + g.id + '\')"><div class="rowmain"><div class="title">' + esc(g.name) + '</div></div><span class="chev">›</span></div>';
      });
      html += '</div>';
      html += '<button class="action" style="margin-top:14px" onclick="window._v3Create()">＋ 新建分组并移入</button>';
      modal('移动到分组', html);
    };

    bar.querySelector('#mbToggle').onclick = function() {
      if (selectedIds.size === 0) return;
      const cards = state.cards.filter(c => selectedIds.has(String(c.id)));
      if (!cards.length) return;
      const allEnabled = cards.every(c => c.enabled !== false);
      const newState = !allEnabled;
      cards.forEach(c => c.enabled = newState);
      save().then(() => {
        showToast(newState ? '已启用 ' + cards.length + ' 张' : '已停用 ' + cards.length + ' 张');
        renderCards();
        selectedIds.clear();
        setTimeout(updateBar, 80);
      });
    };

    bar.querySelector('#mbDelete').onclick = function() {
      if (selectedIds.size === 0) return;
      if (!confirm('确定删除选中的 ' + selectedIds.size + ' 张字卡吗？此操作不可恢复。')) return;
      state.cards = state.cards.filter(c => !selectedIds.has(String(c.id)));
      save().then(() => {
        showToast('已删除');
        renderCards();
        selectedIds.clear();
        setTimeout(updateBar, 80);
      });
    };
  }

  window._v3Move = function(gid) {
    let count = 0;
    state.cards.forEach(c => { if (selectedIds.has(String(c.id))) { c.group = gid; count++; } });
    save().then(() => {
      closeModal();
      showToast('已移动 ' + count + ' 张');
      selectedIds.clear();
      renderCards();
      setTimeout(updateBar, 80);
    });
  };

  window._v3Create = function() {
    const name = prompt('新建分组名称：');
    if (!name || !name.trim()) return;
    const trimmed = name.trim();
    if (state.groups.some(g => String(g.name).trim() === trimmed)) { alert('分组已存在'); return; }
    const gid = 'g' + Date.now() + Math.random().toString(36).slice(2,7);
    state.groups.push({id: gid, name: trimmed, enabled: true, probability: 50});
    let count = 0;
    state.cards.forEach(c => { if (selectedIds.has(String(c.id))) { c.group = gid; count++; } });
    save().then(() => {
      closeModal();
      showToast('已新建并移动 ' + count + ' 张');
      selectedIds.clear();
      renderCards();
      setTimeout(updateBar, 80);
    });
  };

  setInterval(() => { bindList(); patchButtons(); }, 400);
  console.log('✅ 多选点击修复 v3 已加载');
})();
