// ============ moments.js：朋友圈 + 点头像触发 ============

// 1. 朋友圈独立调度器（分钟单位）
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
})();

// 2. 朋友圈触发按钮（右上角圆形刷新图标）
(function(){
  setInterval(function() {
    const top = document.querySelector('#moments .momActionsTop'); if (!top) return;
    const all = top.querySelectorAll('.momTestBtn');
    for (let i = 1; i < all.length; i++) all[i].remove();
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
})();

// 3. 朋友圈互动频率（分钟设置）
(function() {
  if (window.__momSettings) return;
  window.__momSettings = true;

  // 描述文字同步成分钟
  setInterval(function() {
    const d = document.getElementById('momentInteractionDesc');
    if (!d || !state || !state.chatSettings) return;
    const c = state.chatSettings;
    const txt = '发动态 ' + c.momentPostMin + '–' + c.momentPostMax + '分钟 · 点赞 ' + c.momentLikeMin + '–' + c.momentLikeMax + '分钟 · 评论 ' + c.momentCommentMin + '–' + c.momentCommentMax + '分钟 · 回复 ' + c.momentReplyMin + '–' + c.momentReplyMax + '分钟';
    if (d.textContent !== txt) d.textContent = txt;
  }, 2000);

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
    if (typeof showToast === 'function') showToast('已保存（分钟）');
  };
  setInterval(function() {
    document.querySelectorAll('[onclick*="showMomentInteractionSettings"]').forEach(function(el) {
      el.setAttribute('onclick', 'window.__momShow()');
    });
  }, 500);
})();

// 4. 点聊天页顶部头像 → 触发对方逐条回复
(function() {
  if (window.__tapAvatarV2) return;
  window.__tapAvatarV2 = true;
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

console.log('✅ moments.js 已加载');
