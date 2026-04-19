// ═══════════════════════════════════════════════════════
// State
// ═══════════════════════════════════════════════════════
window.words     = JSON.parse(localStorage.getItem('lootlinguaDict')) || [];
let currentFilter    = 'all';
let editId           = null;
let isReorderMode    = false;
let selectedIndices  = [];
let currentQuizWords = [];
let quizIndex        = 0;
let currentStreak    = 0;
let pendingDeleteId  = null;
let userXP           = parseInt(localStorage.getItem('userXP')) || 0;
let currentView      = 'personal';
let renderPage       = 0;
let _renderTimer     = null;

// ─────────────────────────────────────────────────────
// SECURITY: XSS-safe helpers
// ─────────────────────────────────────────────────────

/** Escape HTML — منع XSS عند إدراج محتوى المستخدم */
function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Safe highlight: escape أولاً ثم لفّ النتيجة بـ <mark> */
function highlightText(raw, query) {
  const safe = esc(raw);
  if (!query) return safe;
  try {
    const q = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return safe.replace(new RegExp('(' + q + ')', 'gi'), '<mark>$1</mark>');
  } catch { return safe; }
}

// ─────────────────────────────────────────────────────
// NORMALIZATION
// ─────────────────────────────────────────────────────
function normalizeWord(w) {
  return String(w || '').toLowerCase().trim().replace(/\s+/g, ' ');
}

function wordExists(text) {
  const key = normalizeWord(text);
  return window.words.some(w => normalizeWord(w.word) === key);
}

// ─────────────────────────────────────────────────────
// Fluent Emoji helper
// ─────────────────────────────────────────────────────
const FE_BASE = 'https://cdn.jsdelivr.net/npm/fluentui-emoji@latest/icons';
function fe(name, size) {
  size = size || 20;
  return '<img src="' + FE_BASE + '/' + name + '/flat/default.svg" width="' + size + '" height="' + size + '" style="vertical-align:middle;display:inline-block;" alt="" onerror="this.style.display=\'none\'">';
}

// ═══════════════════════════════════════════════════════
// XP & Gamification
// ═══════════════════════════════════════════════════════

const XP_RANKS = [
  { min: 0,    max: 14,       label: 'Noob',     icon: '🐣', color: '#94a3b8' },
  { min: 15,   max: 39,       label: 'Wanderer', icon: '🗺️',  color: '#67e8f9' },
  { min: 40,   max: 79,       label: 'Learner',  icon: '📚', color: '#60a5fa' },
  { min: 80,   max: 149,      label: 'Explorer', icon: '🔭', color: '#818cf8' },
  { min: 150,  max: 249,      label: 'Pro',      icon: '⚔️',  color: '#34d399' },
  { min: 250,  max: 399,      label: 'Veteran',  icon: '🛡️',  color: '#4ade80' },
  { min: 400,  max: 599,      label: 'Elite',    icon: '🔥', color: '#f59e0b' },
  { min: 600,  max: 899,      label: 'Master',   icon: '🌟', color: '#fbbf24' },
  { min: 900,  max: 1299,     label: 'Legend',   icon: '👑', color: '#a78bfa' },
  { min: 1300, max: Infinity, label: 'Linguaer', icon: '🏆', color: '#f472b6' },
];

function getRank(xp) {
  return XP_RANKS.slice().reverse().find(function(r){ return xp >= r.min; }) || XP_RANKS[0];
}
function getNextRank(xp) {
  return XP_RANKS.find(function(r){ return r.min > xp; }) || null;
}

function updateXP(amount) {
  if (amount === 0) return;
  const oldRank = getRank(userXP);
  userXP = Math.max(0, userXP + amount);
  localStorage.setItem('userXP', userXP);
  renderXPBar();
  if (amount > 0 && getRank(userXP).label !== oldRank.label) {
    setTimeout(function(){ showRankUp(getRank(userXP)); }, 400);
  }
}

function renderXPBar() {
  const rank     = getRank(userXP);
  const nextRank = getNextRank(userXP);
  const fillEl   = document.getElementById('xpFill');
  const lbEl     = document.getElementById('xpRankLabel');
  const icEl     = document.getElementById('xpRankIcon');
  const valEl    = document.getElementById('xpValue');
  const nxtEl    = document.getElementById('xpNext');
  if (!fillEl) return;

  const pct = nextRank
    ? Math.min(((userXP - rank.min) / (nextRank.min - rank.min)) * 100, 100)
    : 100;

  fillEl.style.width      = pct + '%';
  fillEl.style.background = 'linear-gradient(90deg,' + rank.color + 'ee,' + rank.color + '66)';
  if (lbEl) { lbEl.textContent = rank.label; lbEl.style.color = rank.color; }
  if (icEl)  icEl.textContent  = rank.icon;
  if (valEl) valEl.textContent = userXP + ' XP';
  if (nxtEl) nxtEl.textContent = nextRank ? nextRank.min + ' XP' : 'MAX 🏆';
}

function showXPBadge(amount, anchorId, isNeg) {
  const badge = document.getElementById('xpBadge');
  if (!badge) return;
  badge.textContent      = (isNeg ? '-' : '+') + amount + ' XP';
  badge.style.background = isNeg ? '#ef4444' : '#f59e0b';
  badge.style.color      = isNeg ? '#fff'    : '#0f172a';

  const anchor = anchorId ? document.getElementById(anchorId) : null;
  if (anchor) {
    const r = anchor.getBoundingClientRect();
    badge.style.left      = (r.left + r.width / 2) + 'px';
    badge.style.bottom    = (window.innerHeight - r.top + 12) + 'px';
    badge.style.transform = 'translateX(-50%)';
  } else {
    badge.style.left      = '50%';
    badge.style.bottom    = '90px';
    badge.style.transform = 'translateX(-50%)';
  }
  badge.classList.remove('fly');
  void badge.offsetWidth;
  badge.classList.add('fly');

  const icon = document.getElementById('xpRankIcon');
  if (icon) { icon.classList.add('pop'); setTimeout(function(){ icon.classList.remove('pop'); }, 350); }
}

function showRankUp(rank) {
  const t = document.getElementById('toastMessage');
  if (!t) return;
  t.textContent      = rank.icon + ' ترقية! أصبحت ' + rank.label;
  t.style.background = rank.color;
  t.style.color      = '#0f172a';
  t.classList.add('show');
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [523, 659, 784].forEach(function(freq, i) {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine'; osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.13);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.13 + 0.35);
      osc.start(ctx.currentTime + i * 0.13);
      osc.stop(ctx.currentTime  + i * 0.13 + 0.35);
    });
  } catch(e) {}
  setTimeout(function() {
    t.classList.remove('show');
    t.style.background = '';
    t.style.color      = '';
  }, 3500);
}

// ═══════════════════════════════════════════════════════
// Sidebar & Nav
// ═══════════════════════════════════════════════════════
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('overlay').classList.toggle('show');
}

function setActiveNavLink(key) {
  document.querySelectorAll('.nav-link[data-view]').forEach(function(l) {
    l.classList.toggle('active', l.dataset.view === key);
  });
}

// ═══════════════════════════════════════════════════════
// Modal & Toast — textContent فقط (XSS-safe)
// ═══════════════════════════════════════════════════════
function showModal(id) { document.getElementById(id).style.display = 'flex'; }
function hideModal(id) { document.getElementById(id).style.display = 'none'; }

function showToast(msg) {
  const t = document.getElementById('toastMessage');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(function(){ t.classList.remove('show'); }, 2500);
}

// ═══════════════════════════════════════════════════════
// Save & scheduleRender (debounced)
// ═══════════════════════════════════════════════════════
function saveAndRender() {
  localStorage.setItem('lootlinguaDict', JSON.stringify(window.words));
  scheduleRender();
}

function scheduleRender(ms) {
  ms = ms || 0;
  clearTimeout(_renderTimer);
  _renderTimer = setTimeout(render, ms);
}

function clearInputs() {
  ['wordInput','meaningInput','exampleInput'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.value = '';
  });
  var cat = document.getElementById('categoryInput');
  if (cat) cat.value = 'عام';
  var list = document.getElementById('suggestionsList');
  if (list) list.textContent = '';
  var box = document.getElementById('suggestionsBox');
  if (box) box.style.display = 'none';
}

// ═══════════════════════════════════════════════════════
// Add / Edit Word
// ═══════════════════════════════════════════════════════
window.addWord = async function() {
  const w  = document.getElementById('wordInput').value.trim();
  const m  = document.getElementById('meaningInput').value.trim();
  const ex = document.getElementById('exampleInput').value.trim();
  const c  = document.getElementById('categoryInput').value;

  if (!w || !m) { alert('عبّي الكلمة ومعناها يا بطل!'); return; }

  const btn = document.getElementById('addBtn');
  btn.disabled = true;

  if (editId) {
    window.words = window.words.map(function(item) {
      return item.id === editId ? Object.assign({}, item, { word: w, meaning: m, example: ex, category: c }) : item;
    });
    if (window.updateWordInCloud) await window.updateWordInCloud(editId, { word: w, meaning: m, example: ex, category: c });
    editId = null;
    btn.textContent      = 'إضافة للقاموس 💾';
    btn.style.background = '';
  } else {
    if (wordExists(w)) {
      alert('هذه الكلمة موجودة بالفعل في قاموسك!');
      btn.disabled = false;
      return;
    }
    const xpGain  = 3;
    const newWord = { id: Date.now().toString(), word: w, meaning: m, example: ex, category: c, starred: false, forgetCount: 0, xpValue: xpGain };
    window.words.unshift(newWord);
    if (window.saveWordToCloud) {
      const realId = await window.saveWordToCloud(w, c, m, ex);
      if (realId) newWord.id = realId;
    }
    updateXP(xpGain);
    showXPBadge(xpGain, 'addBtn', false);
  }

  clearInputs();
  btn.disabled = false;
  saveAndRender();
};

// ═══════════════════════════════════════════════════════
// Edit Word
// ═══════════════════════════════════════════════════════
window.editWord = function(id, event) {
  if (event) event.stopPropagation();
  const item = window.words.find(function(w){ return w.id === id; });
  if (!item) return;
  document.getElementById('wordInput').value     = item.word;
  document.getElementById('meaningInput').value  = item.meaning;
  document.getElementById('exampleInput').value  = item.example || '';
  document.getElementById('categoryInput').value = item.category;
  editId = id;
  const btn = document.getElementById('addBtn');
  btn.textContent      = 'تحديث الكلمة 💾';
  btn.style.background = '#059669';
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

// ═══════════════════════════════════════════════════════
// Delete Word — XP deduction + modal warning
// ═══════════════════════════════════════════════════════
window.deleteWord = function(id, event) {
  if (event) event.stopPropagation();
  pendingDeleteId = id;

  const wordObj = window.words.find(function(w){ return w.id === id; });
  const xpLoss  = (wordObj && wordObj.xpValue) || 0;

  // تحذير XP داخل المودال (DOM آمن — بدون innerHTML)
  const modalBody = document.querySelector('#deleteModal .modal-content');
  var warnEl = modalBody ? modalBody.querySelector('.xp-delete-warn') : null;
  if (xpLoss > 0 && modalBody) {
    if (!warnEl) {
      warnEl = document.createElement('div');
      warnEl.className = 'xp-delete-warn';
      const pEl = modalBody.querySelector('p');
      if (pEl) pEl.after(warnEl);
    }
    warnEl.textContent = '⚠️ ستخسر -' + xpLoss + ' XP عند الحذف';
  } else if (warnEl) {
    warnEl.remove();
  }

  document.getElementById('deleteConfirmBtn').onclick = async function() {
    hideModal('deleteModal');
    if (xpLoss > 0) {
      updateXP(-xpLoss);
      showXPBadge(xpLoss, null, true);
    }
    window.words = window.words.filter(function(w){ return w.id !== pendingDeleteId; });
    if (window.deleteWordFromCloud) await window.deleteWordFromCloud(pendingDeleteId);
    pendingDeleteId = null;
    const leftover = document.querySelector('#deleteModal .xp-delete-warn');
    if (leftover) leftover.remove();
    saveAndRender();
  };

  const cancelBtn = document.getElementById('deleteCancelBtn');
  if (cancelBtn) {
    cancelBtn.onclick = function() {
      hideModal('deleteModal');
      const leftover = document.querySelector('#deleteModal .xp-delete-warn');
      if (leftover) leftover.remove();
    };
  }

  showModal('deleteModal');
};

// ═══════════════════════════════════════════════════════
// Star Toggle
// ═══════════════════════════════════════════════════════
window.toggleStar = function(id, event) {
  if (event) event.stopPropagation();
  const word = window.words.find(function(w){ return w.id === id; });
  if (!word) return;
  word.starred = !word.starred;
  if (window.updateWordInCloud) window.updateWordInCloud(id, { starred: word.starred });
  saveAndRender();
};

// ═══════════════════════════════════════════════════════
// Sound
// ═══════════════════════════════════════════════════════
function _speak(text) {
  if (!text || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utt   = new SpeechSynthesisUtterance(text.trim());
  utt.lang    = 'en-US'; utt.rate = 0.9;
  const voice = window.speechSynthesis.getVoices().find(function(v){ return v.lang.startsWith('en'); });
  if (voice) utt.voice = voice;
  window.speechSynthesis.speak(utt);
}

window.playSound = function(identifier, event) {
  if (event) event.stopPropagation();
  const obj = window.words.find(function(w){ return String(w.id) === String(identifier); });
  _speak(obj ? obj.word : (typeof identifier === 'string' ? identifier : ''));
};

window.playGameSound = function(word, event) {
  if (event) event.stopPropagation();
  _speak(word);
};

// ═══════════════════════════════════════════════════════
// AI Suggestions — DOM-based (no innerHTML للبيانات)
// ═══════════════════════════════════════════════════════
window.fetchSuggestions = async function() {
  const word = document.getElementById('wordInput').value.trim();
  if (!word) { alert('اكتب الكلمة أولاً!'); return; }

  const btn  = document.getElementById('searchBtn');
  const box  = document.getElementById('suggestionsBox');
  const list = document.getElementById('suggestionsList');

  btn.innerHTML = "<i class='fas fa-spinner fa-spin'></i>";
  btn.disabled  = true;
  if (box) box.style.display = 'block';

  list.textContent = '';
  const loadP = document.createElement('p');
  loadP.style.cssText = 'text-align:center;font-size:12px;color:var(--text-gray);padding:10px;';
  loadP.textContent = 'جاري البحث...';
  list.appendChild(loadP);

  try {
    const res = await fetch('https://dictionary7-ayes.onrender.com/api/dictionary', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word })
    });
    if (!res.ok) throw new Error('server error');
    const data = await res.json();
    const raw  = data.choices[0].message.content;
    const suggestions = JSON.parse(raw.substring(raw.indexOf('['), raw.lastIndexOf(']') + 1));

    list.textContent = '';

    suggestions.forEach(function(s, i) {
      const div = document.createElement('div');
      div.className = 'sug-item' + (i >= 4 ? ' extra-meaning' : '');
      if (i >= 4) div.style.display = 'none';

      const main = document.createElement('div');
      main.className = 'sug-main';
      const arSpan = document.createElement('span');
      arSpan.className   = 'sug-ar';
      arSpan.textContent = s.ar;
      const posSpan = document.createElement('span');
      posSpan.className   = 'sug-pos';
      posSpan.textContent = s.pos || 'عام';
      main.append(arSpan, posSpan);

      const stars = document.createElement('div');
      stars.className   = 'sug-stars';
      stars.textContent = '★'.repeat(s.stars || 1) + '☆'.repeat(5 - (s.stars || 1));

      div.append(main, stars);

      if (s.ex) {
        const ex = document.createElement('div');
        ex.className   = 'sug-ex';
        ex.textContent = '"' + s.ex + '"';
        div.appendChild(ex);
      }

      div.onclick = function() {
        document.getElementById('meaningInput').value  = s.ar  || '';
        document.getElementById('categoryInput').value = s.pos || 'عام';
        document.getElementById('exampleInput').value  = s.ex  || '';
        if (box) box.style.display = 'none';
      };
      list.appendChild(div);
    });

    if (suggestions.length > 4) {
      const toggle = document.createElement('div');
      toggle.className   = 'sug-toggle';
      toggle.textContent = 'عرض المزيد (' + (suggestions.length - 4) + ') ▼';
      toggle.onclick = function() {
        const extras  = list.querySelectorAll('.extra-meaning');
        const showing = extras[0] && extras[0].style.display !== 'none';
        extras.forEach(function(x){ x.style.display = showing ? 'none' : 'block'; });
        toggle.textContent = showing
          ? 'عرض المزيد (' + (suggestions.length - 4) + ') ▼'
          : 'عرض أقل ▲';
      };
      list.appendChild(toggle);
    }

  } catch(e) {
    list.textContent = '';
    const err = document.createElement('p');
    err.style.cssText   = 'color:var(--danger);text-align:center;font-size:12px;padding:10px;';
    err.textContent = '⚠️ تأكد إن السيرفر شغال';
    list.appendChild(err);
  } finally {
    btn.innerHTML = "<i class='fas fa-search'></i>";
    btn.disabled  = false;
  }
};

// ═══════════════════════════════════════════════════════
// Filter & Reorder
// ═══════════════════════════════════════════════════════
function setFilter(f) {
  currentFilter = f;
  document.getElementById('toolAll').classList.toggle('active-tool',     f === 'all');
  document.getElementById('toolStarred').classList.toggle('active-tool', f === 'starred');
  renderPage = 0;
  scheduleRender();
}

function toggleReorderMode() {
  isReorderMode   = !isReorderMode;
  selectedIndices = [];
  const btn = document.getElementById('reorderBtn');
  btn.classList.toggle('active-tool', isReorderMode);
  btn.innerHTML = isReorderMode ? '💾 حفظ' : '<i class="fas fa-sort-amount-down"></i>';
  if (!isReorderMode) localStorage.setItem('lootlinguaDict', JSON.stringify(window.words));
  scheduleRender();
}

function allowDrop(ev) { ev.preventDefault(); }

function drag(ev, index) {
  if (!selectedIndices.includes(index)) selectedIndices = [index];
  ev.dataTransfer.setData('draggedIndices', JSON.stringify(selectedIndices));
}

function drop(ev, dropIndex) {
  ev.preventDefault();
  const dragged = JSON.parse(ev.dataTransfer.getData('draggedIndices')).sort(function(a,b){ return b-a; });
  const items   = dragged.map(function(i){ return window.words.splice(i, 1)[0]; }).reverse();
  let target    = dropIndex;
  dragged.forEach(function(i){ if (i < dropIndex) target--; });
  window.words.splice(Math.max(target, 0), 0, ...items);
  window.words.forEach(function(w, i){ w.order = i; });
  localStorage.setItem('lootlinguaDict', JSON.stringify(window.words));
  selectedIndices = [];
  scheduleRender();
}

function handleLiClick(index, el) {
  if (isReorderMode) {
    if (selectedIndices.includes(index)) {
      selectedIndices = selectedIndices.filter(function(i){ return i !== index; });
      el.classList.remove('selected-for-move');
    } else {
      selectedIndices.push(index);
      el.classList.add('selected-for-move');
    }
  } else {
    el.classList.toggle('show-example');
  }
}

// ═══════════════════════════════════════════════════════
// Export / Import
// ═══════════════════════════════════════════════════════
window.exportData = function() {
  const a  = document.createElement('a');
  a.href   = 'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(window.words));
  a.download = 'lootlingua_dict.json';
  a.click();
};

window.importData = async function(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async function(e) {
    try {
      const imported = JSON.parse(e.target.result);
      if (!Array.isArray(imported)) throw new Error();
      const merged = imported.concat(window.words);
      const seen   = new Map();
      window.words = merged.filter(function(item) {
        const key = normalizeWord(item.word || item.text || '');
        return seen.has(key) ? false : seen.set(key, true);
      });
      saveAndRender();
      if (window.saveWordToCloud) {
        for (const item of imported)
          await window.saveWordToCloud(item.word || item.text, item.category, item.meaning, item.example);
        showToast('تم الاستيراد والرفع للسحابة ✅');
      } else {
        showToast('تم الاستيراد ✅');
      }
    } catch(e) { alert('خطأ في الملف، تأكد إنه JSON صحيح.'); }
  };
  reader.readAsText(file);
};

// ═══════════════════════════════════════════════════════
// Game Dictionaries
// ═══════════════════════════════════════════════════════
const gameData = {
  minecraft: {
    title: 'Minecraft Dictionary',
    titleIcon: 'https://raw.githubusercontent.com/twitter/twemoji/master/assets/svg/26cf.svg',
    desc: 'اجمع الموارد وافهم كل مصطلحات اللعبة!',
    words: [
      { text:'Obsidian',     meaning:'حجر بركاني صلب جداً — يتكوّن من تلاقي الماء مع الحمم',   example:'You need Obsidian to build a Nether portal.',      img:'https://minecraft.wiki/images/Obsidian_JE3_BE2.png?format=original' },
      { text:'Creeper',      meaning:'وحش أخضر صامت يقترب منك وينفجر',                          example:'A Creeper snuck up behind me and exploded!',        img:'https://minecraft.wiki/images/Creeper_face_1.png?b6233' },
      { text:'Nether',       meaning:'العالم السفلي — بيئة جهنمية تحت العالم العادي',           example:'Build a portal to travel to the Nether.',           img:'https://minecraft.wiki/images/Netherrack_JE4_BE2.png?8a940' },
      { text:'Enchant',      meaning:'تحسين الأسلحة والأدوات بقوى سحرية',                       example:'Enchant your sword with Sharpness V.',              img:'https://minecraft.wiki/images/Enchanting_Table_JE4_BE2.png?format=original' },
      { text:'Respawn',      meaning:'العودة للحياة من جديد بعد الموت',                         example:'Set your respawn point using a bed.',               img:'https://minecraft.wiki/images/thumb/Respawn_Anchor_%280%29_JE1.png/150px-Respawn_Anchor_%280%29_JE1.png?23b57' },
      { text:'Crafting',     meaning:'صنع الأدوات والأسلحة من الموارد المجموعة',                example:'Open the crafting table to build a sword.',         img:'https://minecraft.wiki/images/Crafting_Table_JE4_BE3.png?format=original' },
      { text:'Biome',        meaning:'منطقة جغرافية لها طبيعة وكائنات خاصة',                    example:'The desert biome is dry and sandy.',                img:'https://minecraft.wiki/images/thumb/Biome_preview.png/350px-Biome_preview.png?4d6f7' },
      { text:'Mob',          meaning:'كائن حي متحرك — عدائي أو ودّي',                           example:'Zombies are hostile mobs that spawn at night.',      img:'https://minecraft.wiki/images/NPCFace.png?2fe0f' },
      { text:'Spawn Point',  meaning:'مكان إعادة الإحياء بعد الموت',                           example:'I slept in the bed to reset my spawn point.',       img:'https://minecraft.wiki/images/White_Bed_JE2_BE2.png' },
      { text:'Mob Spawner',  meaning:'قفص توليد الوحوش التلقائي',                              example:'We found a spider mob spawner near the dungeon.',   img:'https://minecraft.wiki/images/thumb/Monster_Spawner_JE4.png/150px-Monster_Spawner_JE4.png?64df6' },
      { text:'Hardcore Mode',meaning:'طور اللعبة بحياة واحدة فقط',                             example:'I survived 500 days in Hardcore mode!',             img:'https://minecraft.wiki/images/Hardcore_Heart.svg?dcc51' },
      { text:'Durability',   meaning:'مدى تحمّل الأداة قبل الكسر',                             example:'My pickaxe has low durability, I need to mend it.', img:'https://minecraft.wiki/images/thumb/Durability_bars.png/544px-Durability_bars.png?dda91' },
      { text:'XP',           meaning:'نقاط الخبرة — تُجمع لتطوير الأسلحة',                    example:'Kill more mobs to get XP for enchantments.',        img:'https://minecraft.wiki/images/Experience_Orb_Value_3-6.png?6de8c' },
      { text:'AFK',          meaning:'بعيد عن الجهاز — تترك اللعبة تشتغل وحدها',              example:"I'll be AFK for 10 minutes at the iron farm.",      img:'https://minecraft.wiki/images/EntitySprite_steve.png?856f8' },
      { text:'Smelting',     meaning:'صهر الخامات إلى سبائك باستخدام الفرن',                   example:"I'm smelting iron ore to get iron ingots.",         img:'https://minecraft.wiki/images/Furnace_GUI.png?8d780' },
      { text:'Inventory',    meaning:'قائمة الأغراض اللي معك',                                  example:'My inventory is full of dirt.',                     img:'https://minecraft.wiki/images/thumb/Inventory.png/176px-Inventory.png?9e5ea' },
      { text:'Pillagers',    meaning:'النهّابون — أعداء يشنّون غارات على القرى',               example:'A group of Pillagers is attacking the village!',    img:'https://minecraft.wiki/images/EntitySprite_evoker.png?f236e' },
    ]
  },
  pubg: {
    title: 'PUBG Terms',
    titleIcon: 'https://raw.githubusercontent.com/twitter/twemoji/master/assets/svg/1fa82.svg',
    desc: 'دليلك للنجاة والحصول على عشاء الدجاج!',
    words: [
      { text:'Airdrop', meaning:'صندوق إمدادات نادر يسقط من طائرة', example:'Rush the airdrop before the enemy gets there!', img:'https://cdn-icons-png.flaticon.com/512/870/870160.png' },
      { text:'Flank',   meaning:'الالتفاف حول العدو من الجانب أو الخلف', example:"Let's flank them from the left side.", img:'https://cdn-icons-png.flaticon.com/512/1046/1046352.png' },
      { text:'Loot',    meaning:'جمع الغنائم والأسلحة والمعدات', example:'Good loot spawns in military compounds.', img:'https://cdn-icons-png.flaticon.com/512/3075/3075977.png' },
      { text:'Snipe',   meaning:'القنص من مسافة بعيدة جداً', example:'He sniped me from 400 meters away.', img:'https://cdn-icons-png.flaticon.com/512/2917/2917995.png' },
      { text:'Revive',  meaning:'إنقاذ زميلك الساقط وإعادته للمعركة', example:'Quick, revive me before they push!', img:'https://cdn-icons-png.flaticon.com/512/2382/2382533.png' },
      { text:'Zone',    meaning:'الدائرة الآمنة — ابقَ داخلها أو تضرر', example:'The zone is closing in, move now!', img:'https://cdn-icons-png.flaticon.com/512/1535/1535791.png' },
      { text:'Prone',   meaning:'الاستلقاء على الأرض للاختباء', example:'Go prone in the grass to stay hidden.', img:'https://cdn-icons-png.flaticon.com/512/3095/3095574.png' },
      { text:'Push',    meaning:'الهجوم على العدو والتقدم نحوه', example:"They're reloading — push them now!", img:'https://cdn-icons-png.flaticon.com/512/1046/1046338.png' },
    ]
  }
};

let currentGameWords = [];

window.loadGameDictionary = function(gameKey) {
  toggleSidebar();
  const game = gameData[gameKey];
  if (!game) return;

  currentView      = gameKey;
  currentGameWords = game.words.slice();
  setActiveNavLink(gameKey);

  document.body.classList.add('game-bg-active');
  document.body.setAttribute('data-game', gameKey);

  document.getElementById('personalControls').style.display = 'none';
  document.querySelector('.toolbar').style.display          = 'none';
  document.getElementById('searchInput').style.display      = 'none';
  document.getElementById('searchFilter').style.display     = 'none';
  document.querySelector('.backup-zone').style.display      = 'none';
  document.getElementById('starredCount').style.display     = 'none';
  document.getElementById('gameSearchBar').style.display    = 'block';
  document.getElementById('gameSearchInput').value          = '';

  // عنوان آمن بـ DOM
  const h1 = document.querySelector('.page-header h1');
  h1.textContent = '';
  const ico = document.createElement('img');
  ico.src = game.titleIcon; ico.width = 24; ico.height = 24;
  ico.style.cssText = 'vertical-align:middle;margin-left:6px;';
  h1.append(ico, document.createTextNode(' ' + game.title));

  document.getElementById('totalCount').textContent = game.desc;
  renderGameWords(currentGameWords);
};

function renderGameWords(words) {
  const query = normalizeWord(document.getElementById('gameSearchInput')?.value || '');

  let filtered = words.filter(function(w) {
    return normalizeWord(w.text).includes(query) || w.meaning.toLowerCase().includes(query);
  });

  if (query) {
    filtered.sort(function(a, b) {
      const an = normalizeWord(a.text), bn = normalizeWord(b.text);
      const aS = an.startsWith(query), bS = bn.startsWith(query);
      if (aS && !bS) return -1;
      if (!aS && bS) return  1;
      return an.localeCompare(bn);
    });
  }

  const listEl = document.getElementById('list');
  listEl.textContent = '';

  if (filtered.length === 0) {
    const li = document.createElement('li');
    li.style.cssText   = 'text-align:center;padding:40px;color:var(--text-gray);list-style:none;';
    li.textContent = 'ما في نتائج للبحث';
    listEl.appendChild(li);
    return;
  }

  const frag = document.createDocumentFragment();

  filtered.forEach(function(w) {
    const already = wordExists(w.text);
    const li = document.createElement('li');
    li.className = 'game-card';

    // info
    const info = document.createElement('div');
    info.className = 'game-info';

    const img = document.createElement('img');
    img.className = 'game-icon'; img.alt = w.text; img.src = w.img;
    img.onerror = function(){ img.src = 'https://cdn-icons-png.flaticon.com/512/686/686589.png'; };

    const wrap = document.createElement('div');

    const wdiv = document.createElement('div');
    wdiv.className = 'word-text';
    wdiv.innerHTML = highlightText(w.text, query); // safe — escaped inside highlightText

    const mdiv = document.createElement('div');
    mdiv.className = 'meaning-text';
    mdiv.innerHTML = highlightText(w.meaning, query);

    wrap.append(wdiv, mdiv);
    if (w.example) {
      const ediv = document.createElement('div');
      ediv.className   = 'game-example';
      ediv.textContent = '"' + w.example + '"';
      wrap.appendChild(ediv);
    }
    info.append(img, wrap);

    // actions
    const acts = document.createElement('div');
    acts.className = 'game-card-actions';

    const swrap = document.createElement('div'); swrap.className = 'tooltip-wrap';
    const sbtn  = document.createElement('button');
    sbtn.className = 'icon-circle sound-btn game-sound-btn';
    sbtn.innerHTML = '<i class="fas fa-volume-up"></i>';
    sbtn.onclick = (function(wt){ return function(e){ e.stopPropagation(); window.playGameSound(wt, e); }; })(w.text);
    const stip = document.createElement('span'); stip.className = 'tooltip-text'; stip.textContent = 'استمع';
    swrap.append(sbtn, stip);

    const awrap = document.createElement('div'); awrap.className = 'tooltip-wrap';
    const abtn  = document.createElement('button');
    abtn.className   = 'btn-add-mine' + (already ? ' btn-already-added' : '');
    abtn.textContent = already ? '✓' : '➕';
    abtn.disabled    = already;
    abtn.onclick = (function(wt, wm, we){ return function(e){ e.stopPropagation(); window.addFromGame(wt, wm, we, abtn); }; })(w.text, w.meaning, w.example || '');
    const atip = document.createElement('span'); atip.className = 'tooltip-text'; atip.textContent = already ? 'موجودة في قاموسك' : 'أضف للقاموس';
    awrap.append(abtn, atip);

    acts.append(swrap, awrap);
    li.append(info, acts);
    frag.appendChild(li);
  });

  listEl.appendChild(frag);
}

window.searchGameWords = function() { renderGameWords(currentGameWords); };

window.loadPersonalDictionary = function() {
  toggleSidebar();
  currentView = 'personal';

  document.body.classList.remove('game-bg-active');
  document.body.removeAttribute('data-game');

  document.getElementById('personalControls').style.display = 'block';
  document.querySelector('.toolbar').style.display          = '';
  document.getElementById('searchInput').style.display      = '';
  document.getElementById('searchFilter').style.display     = '';
  document.querySelector('.backup-zone').style.display      = '';
  document.getElementById('starredCount').style.display     = '';
  document.getElementById('gameSearchBar').style.display    = 'none';

  document.querySelector('.page-header h1').textContent = '⚔️ قاموسك الشخصي';
  setActiveNavLink('personal');
  renderPage = 0;
  scheduleRender();
};

window.addFromGame = async function(text, meaning, example, btnEl) {
  const xpGain = 3;
  if (wordExists(text)) {
    showToast('هذه الكلمة موجودة بالفعل في قاموسك! 📖');
    if (btnEl) { btnEl.textContent = '✓'; btnEl.disabled = true; btnEl.classList.add('btn-already-added'); }
    return;
  }
  if (btnEl) { btnEl.textContent = '...'; btnEl.disabled = true; }

  if (window.saveWordToCloud) {
    const realId = await window.saveWordToCloud(text, 'لعبة', meaning, example || '');
    if (realId) {
      window.words.unshift({ id: realId, word: text, meaning: meaning, example: example || '', category: 'لعبة', starred: false, forgetCount: 0, xpValue: xpGain });
      showToast('تمت الإضافة لقاموسك! 💎');
      updateXP(xpGain); showXPBadge(xpGain, null, false);
      if (btnEl) { btnEl.textContent = '✓'; btnEl.classList.add('btn-already-added'); }
    } else {
      showToast('سجل دخول أولاً عشان تحفظ اللوت! ⚠️');
      if (btnEl) { btnEl.textContent = '➕'; btnEl.disabled = false; }
    }
  } else {
    const nw = { id: Date.now().toString(), word: text, meaning: meaning, example: example || '', category: 'لعبة', starred: false, forgetCount: 0, xpValue: xpGain };
    window.words.unshift(nw);
    localStorage.setItem('lootlinguaDict', JSON.stringify(window.words));
    showToast('تمت الإضافة للقاموس المحلي! 💎');
    updateXP(xpGain); showXPBadge(xpGain, null, false);
    if (btnEl) { btnEl.textContent = '✓'; btnEl.classList.add('btn-already-added'); }
  }
};

// ═══════════════════════════════════════════════════════
// Render — Virtual Window (80 items max per render)
// ═══════════════════════════════════════════════════════
const RENDER_PAGE = 80;

function render() {
  if (currentView !== 'personal') return;

  const searchEl = document.getElementById('searchInput');
  const filterEl = document.getElementById('searchFilter');
  if (!searchEl) return;

  const query      = searchEl.value.toLowerCase().trim();
  const searchType = filterEl ? filterEl.value : 'all';

  let filtered = window.words.filter(function(w) {
    if (!w.word) return false;
    const wn = normalizeWord(w.word);
    const wm = wn.includes(query);
    const mm = (w.meaning  || '').toLowerCase().includes(query);
    const em = (w.example  || '').toLowerCase().includes(query);
    const matches = searchType === 'word'    ? wm
                  : searchType === 'meaning' ? mm
                  : searchType === 'example' ? em
                  : wm || mm || em;
    return matches && (currentFilter === 'all' || w.starred);
  });

  if (query) {
    filtered.sort(function(a, b) {
      const an = normalizeWord(a.word), bn = normalizeWord(b.word);
      const aS = an.startsWith(query), bS = bn.startsWith(query);
      if (aS && !bS) return -1;
      if (!aS && bS) return  1;
      return an.localeCompare(bn);
    });
    renderPage = 0;
  }

  const countEl = document.getElementById('totalCount');
  const starEl  = document.getElementById('starredCount');
  if (countEl) countEl.textContent = 'إجمالي الكلمات: ' + window.words.length;
  if (starEl)  starEl.textContent  = '⭐ الصعبة: ' + window.words.filter(function(w){ return w.starred; }).length;

  const listEl = document.getElementById('list');
  if (!listEl) return;

  if (filtered.length === 0) {
    listEl.textContent = '';
    const li = document.createElement('li');
    li.style.cssText   = 'list-style:none;text-align:center;padding:40px 20px;color:var(--text-gray);';
    li.textContent = query ? 'ما في نتائج للبحث' : 'قاموسك فاضي، ابدأ بإضافة كلمة!';
    listEl.appendChild(li);
    return;
  }

  const start   = renderPage * RENDER_PAGE;
  const page    = filtered.slice(start, start + RENDER_PAGE);
  const hasMore = (start + RENDER_PAGE) < filtered.length;

  const frag = document.createDocumentFragment();

  page.forEach(function(w) {
    const ri  = window.words.findIndex(function(x){ return x.id === w.id; });
    const li  = document.createElement('li');

    var cls = ['word-card'];
    if (isReorderMode) cls.push('reorder-mode-li');
    if (selectedIndices.includes(ri)) cls.push('selected-for-move');
    li.className = cls.join(' ');
    li.onclick = (function(ri_, li_){ return function(){ handleLiClick(ri_, li_); }; })(ri, li);

    if (isReorderMode) {
      li.draggable   = true;
      li.ondragstart = (function(ri_){ return function(e){ drag(e, ri_); }; })(ri);
      li.ondragover  = allowDrop;
      li.ondrop      = (function(ri_){ return function(e){ drop(e, ri_); }; })(ri);
    }

    // body
    const body = document.createElement('div');
    body.className = 'word-body';
    body.style.cssText = 'flex:1;min-width:0;';

    const top = document.createElement('div');
    top.style.cssText = 'display:flex;align-items:flex-start;gap:8px;margin-bottom:4px;';

    const starBtn = document.createElement('button');
    starBtn.className = 'star-btn' + (w.starred ? ' active' : '');
    starBtn.innerHTML = '<i class="fas fa-star"></i>';
    starBtn.onclick = (function(id_){ return function(e){ e.stopPropagation(); window.toggleStar(id_, e); }; })(w.id);

    const tw = document.createElement('div');
    const wd = document.createElement('div');
    wd.className = 'word-text';
    wd.innerHTML = highlightText(w.word, query);
    const ct = document.createElement('span');
    ct.className   = 'cat-tag tag-' + w.category;
    ct.textContent = w.category;
    wd.appendChild(ct);

    const md = document.createElement('div');
    md.className = 'meaning-text';
    md.innerHTML = highlightText(w.meaning, query);

    tw.append(wd, md);
    top.append(starBtn, tw);
    body.appendChild(top);

    if (w.example) {
      const ex = document.createElement('div');
      ex.className = 'example-box';
      const b = document.createElement('b'); b.textContent = 'Ex: ';
      ex.appendChild(b);
      ex.innerHTML += highlightText(w.example, query);
      body.appendChild(ex);
    }

    li.appendChild(body);

    if (isReorderMode) {
      const h = document.createElement('span');
      h.style.cssText = 'font-size:20px;color:#475569;padding:0 8px;flex-shrink:0;';
      h.textContent = '☰';
      li.appendChild(h);
    } else {
      const acts = document.createElement('div');
      acts.className = 'actions';

      const sb = document.createElement('button');
      sb.className = 'icon-circle sound-btn'; sb.innerHTML = '<i class="fas fa-volume-up"></i>';
      sb.onclick = (function(id_){ return function(e){ e.stopPropagation(); window.playSound(id_, e); }; })(w.id);

      const eb = document.createElement('button');
      eb.className = 'icon-circle edit-btn'; eb.innerHTML = '<i class="fas fa-edit"></i>';
      eb.onclick = (function(id_){ return function(e){ e.stopPropagation(); window.editWord(id_, e); }; })(w.id);

      const db = document.createElement('button');
      db.className = 'icon-circle del-btn'; db.innerHTML = '<i class="fas fa-trash-alt"></i>';
      db.onclick = (function(id_){ return function(e){ e.stopPropagation(); window.deleteWord(id_, e); }; })(w.id);

      acts.append(sb, eb, db);
      li.appendChild(acts);
    }

    frag.appendChild(li);
  });

  if (hasMore) {
    const loadLi = document.createElement('li');
    loadLi.style.cssText = 'list-style:none;text-align:center;padding:16px 0;';
    const loadBtn = document.createElement('button');
    loadBtn.className   = 'btn-tool';
    loadBtn.style.width = 'auto';
    loadBtn.textContent = 'تحميل المزيد (' + (filtered.length - start - RENDER_PAGE) + ' كلمة)';
    loadBtn.onclick = function() { renderPage++; scheduleRender(); };
    loadLi.appendChild(loadBtn);
    frag.appendChild(loadLi);
  }

  listEl.textContent = '';
  listEl.appendChild(frag);
}

// ═══════════════════════════════════════════════════════
// QUIZ
// ═══════════════════════════════════════════════════════
function openQuizSetup() {
  if (!window.words.length) { alert('القاموس فاضي!'); return; }
  const el = document.getElementById('quizSetupOverlay');
  el.style.display = 'flex';
  setTimeout(function(){ el.classList.add('show'); }, 10);
}

function closeQuizSetup() {
  const el = document.getElementById('quizSetupOverlay');
  el.classList.remove('show');
  setTimeout(function(){ el.style.display = 'none'; }, 300);
}

function startActualQuiz(mode) {
  closeQuizSetup();
  let words = window.words.slice();

  if (mode === 'recent') {
    words.sort(function(a,b){ return new Date(b.createdAt||0) - new Date(a.createdAt||0); });
    words = words.slice(0, 10);
  } else if (mode === 'old') {
    words.sort(function(a,b){ return (a.id||0) - (b.id||0); });
    words = words.slice(0, 10);
  } else if (mode === 'forgotten') {
    words = words.filter(function(w){ return (w.forgetCount||0) > 0; })
                 .sort(function(a,b){ return b.forgetCount - a.forgetCount; });
    if (!words.length) {
      alert('ما عندك كلمات بتغلط فيها. رح نختبرك عشوائياً.');
      words = window.words.slice().sort(function(){ return Math.random()-0.5; }).slice(0, 10);
    } else words = words.slice(0, 10);
  } else if (mode === 'starred') {
    words = words.filter(function(w){ return w.starred; });
    if (!words.length) { alert('ما عندك كلمات صعبة. رح نختبرك بالكل.'); words = window.words.slice(); }
  } else {
    words.sort(function(){ return Math.random()-0.5; });
  }

  currentQuizWords = words;
  quizIndex = 0; currentStreak = 0;
  const el = document.getElementById('quizOverlay');
  el.style.display = 'flex';
  setTimeout(function(){ el.classList.add('show'); }, 10);
  updateCard();
}

function updateCard() {
  if (quizIndex >= currentQuizWords.length) {
    showToast('أبدعت! أنهيت الكلمات 👏');
    closeQuiz(); return;
  }
  const card = document.getElementById('mainCard');
  if (card.classList.contains('is-flipped')) {
    card.style.transition = 'none';
    card.classList.remove('is-flipped');
    void card.offsetWidth;
    card.style.transition = '';
  }
  const w = currentQuizWords[quizIndex];
  document.getElementById('cardFrontText').textContent   = w.word;
  document.getElementById('cardBackText').textContent    = w.meaning;
  document.getElementById('cardBackExample').textContent = w.example || '';
  const hint = document.getElementById('quizHintText');
  hint.textContent = w.example || 'لا يوجد مثال';
  hint.classList.remove('show');

  document.getElementById('quizCardProgress').style.width = ((quizIndex / currentQuizWords.length) * 100) + '%';
  document.getElementById('quizCardCounter').textContent  = (quizIndex + 1) + ' / ' + currentQuizWords.length;
}

function flipCard()      { document.getElementById('mainCard').classList.toggle('is-flipped'); }
function showHint(event) { event.stopPropagation(); document.getElementById('quizHintText').classList.add('show'); }

function closeQuiz() {
  const el = document.getElementById('quizOverlay');
  el.classList.remove('show');
  setTimeout(function(){ el.style.display = 'none'; }, 300);
}

function showStreakMsg(streak) {
  var msgs = { 3:'🔥 3 صح ورا بعض!', 5:'💪 5 صح! أسطورة!', 7:'🚀 7 ورا بعض!', 10:'👑 10! أنت الأفضل!' };
  if (msgs[streak]) showToast(msgs[streak]);
}

function markRemember() {
  const w = currentQuizWords[quizIndex];
  window.words = window.words.map(function(x) {
    return x.id === w.id ? Object.assign({}, x, { forgetCount: Math.max((x.forgetCount||0) - 1, 0) }) : x;
  });
  localStorage.setItem('lootlinguaDict', JSON.stringify(window.words));
  currentStreak++;
  showStreakMsg(currentStreak);
  updateXP(1);
  showXPBadge(1, null, false);
  if (quizIndex < currentQuizWords.length - 1) { quizIndex++; updateCard(); }
  else { showToast('أبدعت! 👏'); setTimeout(closeQuiz, 600); }
}

function markForgot() {
  currentStreak = 0;
  const w = currentQuizWords[quizIndex];
  window.words = window.words.map(function(x) {
    return x.id === w.id ? Object.assign({}, x, { forgetCount: (x.forgetCount||0) + 1 }) : x;
  });
  localStorage.setItem('lootlinguaDict', JSON.stringify(window.words));
  const fc  = (w.forgetCount || 0) + 1;
  const gap = Math.max(2, Math.min(5 - fc, 4));
  currentQuizWords.splice(Math.min(quizIndex + gap, currentQuizWords.length), 0, Object.assign({}, w));
  quizIndex++;
  updateCard();
}

function playQuizSound(event) {
  if (currentQuizWords[quizIndex]) window.playSound(currentQuizWords[quizIndex].word, event);
}

// ═══════════════════════════════════════════════════════
// Keyboard shortcuts
// ═══════════════════════════════════════════════════════
document.addEventListener('keydown', function(e) {
  if (e.key !== 'Enter') return;
  const active = document.activeElement;
  if (active.id === 'wordInput') { e.preventDefault(); window.fetchSuggestions(); }
  else if (active.id === 'gameSearchInput') { /* oninput */ }
  else if (!['INPUT','TEXTAREA','BUTTON','SELECT'].includes(active.tagName)) {
    e.preventDefault();
    var btn = document.getElementById('addBtn');
    if (btn) btn.click();
  }
});

// reset page on search change
document.addEventListener('DOMContentLoaded', function() {
  var si = document.getElementById('searchInput');
  if (si) si.addEventListener('input', function(){ renderPage = 0; });
});

// ═══════════════════════════════════════════════════════
// Init
// ═══════════════════════════════════════════════════════
window.onload = function() {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.getVoices();
    if (speechSynthesis.onvoiceschanged !== undefined)
      speechSynthesis.onvoiceschanged = function(){ window.speechSynthesis.getVoices(); };
  }
  renderXPBar();
  render();
};
