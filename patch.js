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
