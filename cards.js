// ============ cards.js：字卡库 ============

// 1. 字卡导入
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

// 2. 字卡库多选 + 按钮委托 + 表情包布局
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
  document.addEventListener('click', function(e) {
    const page = document.getElementById('cards');
    if (!page || !page.classList.contains('active')) return;
    if (window._multiOn) {
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

console.log('✅ cards.js 已加载');
