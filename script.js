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
let currentView      = 'personal'; // 'personal' | 'minecraft' | 'pubg'

// ── Fluent Emoji helper (Microsoft CDN) ──────────────────
// https://github.com/microsoft/fluentui-emoji
const FE_BASE = 'https://cdn.jsdelivr.net/npm/fluentui-emoji@latest/icons';

// نستخدم inline <img> بدل نص الإيموجي في الأماكن المهمة
function fe(name, size = 20) {
  // name مثل: 'star', 'sword', 'fire' — تتطابق مع أسماء الملفات
  return `<img src="${FE_BASE}/${name}/flat/default.svg" width="${size}" height="${size}" style="vertical-align:middle; display:inline-block;" alt="" onerror="this.style.display='none'">`;
}

// ═══════════════════════════════════════════════════════
// Sidebar
// ═══════════════════════════════════════════════════════
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('overlay').classList.toggle('show');
}

function setActiveNavLink(key) {
  // key: 'personal' | 'minecraft' | 'pubg'
  document.querySelectorAll('.nav-link[data-view]').forEach(l => {
    l.classList.toggle('active', l.dataset.view === key);
  });
}

// ═══════════════════════════════════════════════════════
// Modal & Toast
// ═══════════════════════════════════════════════════════
function showModal(id) { document.getElementById(id).style.display = 'flex'; }
function hideModal(id) { document.getElementById(id).style.display = 'none'; }

function showToast(msg) {
  const t = document.getElementById('toastMessage');
  if (!t) return;
  t.innerHTML = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

// ═══════════════════════════════════════════════════════
// XP & Gamification System
// ═══════════════════════════════════════════════════════

const XP_RANKS = [
  { min: 0,   max: 49,       label: 'Noob',    icon: '🐣', color: '#94a3b8', next: 50   },
  { min: 50,  max: 149,      label: 'Learner', icon: '📚', color: '#60a5fa', next: 150  },
  { min: 150, max: 349,      label: 'Pro',     icon: '⚔️',  color: '#34d399', next: 350  },
  { min: 350, max: 699,      label: 'Elite',   icon: '🔥', color: '#f59e0b', next: 700  },
  { min: 700, max: Infinity, label: 'Legend',  icon: '👑', color: '#a78bfa', next: null },
];

function getRank(xp) {
  return XP_RANKS.find(r => xp >= r.min && xp <= r.max) || XP_RANKS[0];
}

function updateXP(amount) {
  if (amount === 0) return;
  const oldRank = getRank(userXP);
  userXP = Math.max(0, userXP + amount);
  localStorage.setItem('userXP', userXP);
  const newRank = getRank(userXP);
  renderXPBar();
  if (amount > 0 && newRank.label !== oldRank.label) {
    setTimeout(() => showRankUp(newRank), 400);
  }
}

function renderXPBar() {
  const rank   = getRank(userXP);
  const fillEl = document.getElementById('xpFill');
  const lbEl   = document.getElementById('xpRankLabel');
  const icEl   = document.getElementById('xpRankIcon');
  const valEl  = document.getElementById('xpValue');
  const nxtEl  = document.getElementById('xpNext');
  if (!fillEl) return;

  const pct = rank.next
    ? Math.min(((userXP - rank.min) / (rank.next - rank.min)) * 100, 100)
    : 100;

  fillEl.style.width      = pct + '%';
  fillEl.style.background = `linear-gradient(90deg, ${rank.color}dd, ${rank.color}88)`;
  if (lbEl) { lbEl.textContent = rank.label; lbEl.style.color = rank.color; }
  if (icEl)  icEl.textContent  = rank.icon;
  if (valEl) valEl.textContent = userXP + ' XP';
  if (nxtEl) nxtEl.textContent = rank.next ? rank.next + ' XP' : 'MAX 👑';
}

// badge يطير فوق الزر — isNegative=true → أحمر وبالسالب
function showXPBadge(amount, anchorId, isNegative) {
  const badge = document.getElementById('xpBadge');
  if (!badge) return;
  badge.textContent = (isNegative ? '-' : '+') + amount + ' XP';
  badge.style.background = isNegative ? '#ef4444' : '#f59e0b';
  badge.style.color      = isNegative ? '#fff'    : '#0f172a';

  const anchor = anchorId ? document.getElementById(anchorId) : null;
  if (anchor) {
    const rect = anchor.getBoundingClientRect();
    badge.style.left      = (rect.left + rect.width / 2) + 'px';
    badge.style.bottom    = (window.innerHeight - rect.top + 10) + 'px';
    badge.style.transform = 'translateX(-50%)';
  } else {
    badge.style.left      = '50%';
    badge.style.bottom    = '80px';
    badge.style.transform = 'translateX(-50%)';
  }
  badge.classList.remove('fly');
  void badge.offsetWidth;
  badge.classList.add('fly');

  // pop الأيقونة في الـ sidebar
  const icon = document.getElementById('xpRankIcon');
  if (icon) {
    icon.classList.add('pop');
    setTimeout(() => icon.classList.remove('pop'), 350);
  }
}

function showRankUp(rank) {
  const t = document.getElementById('toastMessage');
  if (!t) return;
  t.innerHTML    = `${rank.icon} ترقية! أصبحت <b style="color:#0f172a">${rank.label}</b>`;
  t.style.background = rank.color;
  t.style.color  = '#0f172a';
  t.classList.add('show');
  // صوت ترقية
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [523, 659, 784].forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.13);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.13 + 0.35);
      osc.start(ctx.currentTime + i * 0.13);
      osc.stop(ctx.currentTime  + i * 0.13 + 0.35);
    });
  } catch {}
  setTimeout(() => {
    t.classList.remove('show');
    t.style.background = '';
    t.style.color      = '';
  }, 3200);
}

// ═══════════════════════════════════════════════════════
// Save & Render helpers
// ═══════════════════════════════════════════════════════
function saveAndRender() {
  localStorage.setItem('lootlinguaDict', JSON.stringify(window.words));
  render();
}

function clearInputs() {
  ['wordInput','meaningInput','exampleInput'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const cat = document.getElementById('categoryInput');
  if (cat) cat.value = 'عام';
  const list = document.getElementById('suggestionsList');
  if (list) list.innerHTML = '';
  const box = document.getElementById('suggestionsBox');
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

  if (!w || !m) { alert("عبّي الكلمة ومعناها يا بطل!"); return; }

  const btn = document.getElementById('addBtn');
  btn.disabled = true;

  if (editId) {
    window.words = window.words.map(item =>
      item.id === editId ? { ...item, word: w, meaning: m, example: ex, category: c } : item
    );
    if (window.updateWordInCloud) await window.updateWordInCloud(editId, { word: w, meaning: m, example: ex, category: c });
    editId = null;
    btn.innerHTML = 'إضافة للقاموس ' + fe('floppy-disk', 18);
    btn.style.background = '';
  } else {
    const xpGain = 5;
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
  const item = window.words.find(w => w.id === id);
  if (!item) return;
  document.getElementById('wordInput').value     = item.word;
  document.getElementById('meaningInput').value  = item.meaning;
  document.getElementById('exampleInput').value  = item.example || '';
  document.getElementById('categoryInput').value = item.category;
  editId = id;
  const btn = document.getElementById('addBtn');
  btn.innerHTML = 'تحديث الكلمة ' + fe('floppy-disk', 18);
  btn.style.background = '#059669';
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

// ═══════════════════════════════════════════════════════
// Delete Word (modal)
// ═══════════════════════════════════════════════════════
window.deleteWord = function(id, event) {
  if (event) event.stopPropagation();
  pendingDeleteId = id;

  // احسب قيمة الـ XP للكلمة
  const wordObj  = window.words.find(w => w.id === id);
  const xpLoss   = wordObj?.xpValue || 0;
  const xpWarn = xpLoss > 0
    ? `<div class="xp-delete-warn">⚠️ ستخسر <b>-${xpLoss} XP</b> عند الحذف</div>`
    : '';

  // حدّث نص المودال بالتحذير
  const modalP = document.querySelector('#deleteModal .modal-content p');
  if (modalP) modalP.innerHTML = 'هذا الإجراء لا يمكن التراجع عنه' + xpWarn;

  document.getElementById('deleteConfirmBtn').onclick = async function() {
    hideModal('deleteModal');
    // اطرح الـ XP
    if (xpLoss > 0) {
      userXP = Math.max(0, userXP - xpLoss);
      localStorage.setItem('userXP', userXP);
      renderXPBar();
      showXPBadge(xpLoss, null, true); // true = سالب (أحمر)
    }
    window.words = window.words.filter(w => w.id !== pendingDeleteId);
    if (window.deleteWordFromCloud) await window.deleteWordFromCloud(pendingDeleteId);
    pendingDeleteId = null;
    saveAndRender();
  };

  // أعد النص الأصلي عند إلغاء المودال
  document.getElementById('deleteCancelBtn').onclick = function() {
    hideModal('deleteModal');
    const p = document.querySelector('#deleteModal .modal-content p');
    if (p) p.innerHTML = 'هذا الإجراء لا يمكن التراجع عنه';
  };

  showModal('deleteModal');
};

// ═══════════════════════════════════════════════════════
// Star Toggle
// ═══════════════════════════════════════════════════════
window.toggleStar = function(id, event) {
  if (event) event.stopPropagation();
  const word = window.words.find(w => w.id === id);
  if (!word) return;
  word.starred = !word.starred;
  if (window.updateWordInCloud) window.updateWordInCloud(id, { starred: word.starred });
  saveAndRender();
};

// ═══════════════════════════════════════════════════════
// Sound
// ═══════════════════════════════════════════════════════
window.playSound = function(identifier, event) {
  if (event) event.stopPropagation();
  const obj = window.words.find(w => String(w.id) === String(identifier));
  const wordToPlay = obj ? obj.word.trim() : (typeof identifier === 'string' ? identifier.trim() : '');
  if (!wordToPlay || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utt   = new SpeechSynthesisUtterance(wordToPlay);
  utt.lang    = 'en-US';
  utt.rate    = 0.9;
  const voice = window.speechSynthesis.getVoices().find(v => v.lang.startsWith('en'));
  if (voice) utt.voice = voice;
  window.speechSynthesis.speak(utt);
};

// ═══════════════════════════════════════════════════════
// AI Suggestions
// ═══════════════════════════════════════════════════════
window.fetchSuggestions = async function() {
  const word = document.getElementById('wordInput').value.trim();
  if (!word) { alert("اكتب الكلمة أولاً!"); return; }

  const btn  = document.getElementById('searchBtn');
  const box  = document.getElementById('suggestionsBox');
  const list = document.getElementById('suggestionsList');

  btn.innerHTML = "<i class='fas fa-spinner fa-spin'></i>";
  btn.disabled  = true;
  if (box) box.style.display = 'block';
  list.innerHTML = "<p style='text-align:center;font-size:12px;color:var(--text-gray);padding:10px;'>جاري البحث...</p>";

  try {
    const res = await fetch("https://dictionary7-ayes.onrender.com/api/dictionary", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ word })
    });
    if (!res.ok) throw new Error("server error");
    const data = await res.json();
    const raw  = data.choices[0].message.content;
    const suggestions = JSON.parse(raw.substring(raw.indexOf('['), raw.lastIndexOf(']') + 1));

    let html = '';
    suggestions.forEach((s, i) => {
      const safeAr  = (s.ar  || '').replace(/\\/g,'\\\\').replace(/'/g,"\\'");
      const safeEx  = (s.ex  || '').replace(/\\/g,'\\\\').replace(/'/g,"\\'");
      const safePos = (s.pos || 'عام').replace(/'/g,"\\'");
      html += `
        <div class="sug-item ${i >= 4 ? 'extra-meaning' : ''}" ${i >= 4 ? 'style="display:none"' : ''}
             onclick="selectSuggestion('${safeAr}','${safePos}','${safeEx}')">
          <div class="sug-main">
            <span class="sug-ar">${s.ar}</span>
            <span class="sug-pos">${s.pos || 'عام'}</span>
          </div>
          <div class="sug-stars">${'★'.repeat(s.stars||1)}${'☆'.repeat(5-(s.stars||1))}</div>
          ${s.ex ? `<div class="sug-ex">"${s.ex}"</div>` : ''}
        </div>`;
    });
    if (suggestions.length > 4) {
      html += `<div class="sug-toggle" id="toggleMeaningsBtn"
                    onclick="const e=document.querySelectorAll('.extra-meaning'),h=e[0].style.display==='none';e.forEach(x=>x.style.display=h?'block':'none');this.innerHTML=h?'عرض أقل ▲':'عرض المزيد (${suggestions.length-4}) ▼'">
                 عرض المزيد (${suggestions.length - 4}) ▼</div>`;
    }
    list.innerHTML = html;

  } catch {
    list.innerHTML = "<p style='color:var(--danger);text-align:center;font-size:12px;padding:10px;'>⚠️ تأكد إن السيرفر شغال</p>";
  } finally {
    btn.innerHTML = "<i class='fas fa-search'></i>";
    btn.disabled  = false;
  }
};

function selectSuggestion(ar, pos, ex) {
  document.getElementById('meaningInput').value  = ar;
  document.getElementById('categoryInput').value = pos;
  document.getElementById('exampleInput').value  = ex;
  const box = document.getElementById('suggestionsBox');
  if (box) box.style.display = 'none';
}

// ═══════════════════════════════════════════════════════
// Filter
// ═══════════════════════════════════════════════════════
function setFilter(f) {
  currentFilter = f;
  document.getElementById('toolAll').classList.toggle('active-tool',     f === 'all');
  document.getElementById('toolStarred').classList.toggle('active-tool', f === 'starred');
  render();
}

// ═══════════════════════════════════════════════════════
// Reorder (Drag & Drop)
// ═══════════════════════════════════════════════════════
function toggleReorderMode() {
  isReorderMode   = !isReorderMode;
  selectedIndices = [];
  const btn = document.getElementById('reorderBtn');
  btn.classList.toggle('active-tool', isReorderMode);
  btn.innerHTML = isReorderMode ? '💾 حفظ' : '<i class="fas fa-sort-amount-down"></i>';
  if (!isReorderMode) localStorage.setItem('lootlinguaDict', JSON.stringify(window.words));
  render();
}

function allowDrop(ev) { ev.preventDefault(); }

function drag(ev, index) {
  if (!selectedIndices.includes(index)) selectedIndices = [index];
  ev.dataTransfer.setData("draggedIndices", JSON.stringify(selectedIndices));
}

function drop(ev, dropIndex) {
  ev.preventDefault();
  const dragged = JSON.parse(ev.dataTransfer.getData("draggedIndices")).sort((a, b) => b - a);
  const items   = dragged.map(i => window.words.splice(i, 1)[0]).reverse();
  let target    = dropIndex;
  dragged.forEach(i => { if (i < dropIndex) target--; });
  window.words.splice(Math.max(target, 0), 0, ...items);
  window.words.forEach((w, i) => { w.order = i; });
  localStorage.setItem('lootlinguaDict', JSON.stringify(window.words));
  selectedIndices = [];
  render();
}

function handleLiClick(index, el) {
  if (isReorderMode) {
    if (selectedIndices.includes(index)) {
      selectedIndices = selectedIndices.filter(i => i !== index);
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
      const merged = [...imported, ...window.words];
      const seen   = new Map();
      window.words = merged.filter(item => {
        const key = (item.word || item.text || '').toLowerCase();
        return seen.has(key) ? false : seen.set(key, true);
      });
      saveAndRender();
      if (window.saveWordToCloud) {
        for (const item of imported)
          await window.saveWordToCloud(item.word || item.text, item.category, item.meaning, item.example);
        showToast("تم الاستيراد والرفع للسحابة ✅");
      } else {
        showToast("تم الاستيراد ✅");
      }
    } catch { alert("خطأ في الملف، تأكد إنه JSON صحيح."); }
  };
  reader.readAsText(file);
};

// ═══════════════════════════════════════════════════════
// Game Dictionaries
// ═══════════════════════════════════════════════════════

// ── صور موثوقة من Wikimedia Commons وروابط مستقرة ──────
// Minecraft: نستخدم Wikimedia مباشرة
// PUBG: نستخدم SVG icons من cdnjs / svg repos

const gameData = {
  minecraft: {
    title: "Minecraft Dictionary",
    titleIcon: "https://raw.githubusercontent.com/twitter/twemoji/master/assets/svg/26cf.svg", // ⛏
    desc:  "اجمع الموارد وافهم كل مصطلحات اللعبة!",
    bg:    "https://images.alphacoders.com/109/1099238.png",
    words: [
      {
        text: "Obsidian",
        meaning: "حجر بركاني صلب جداً — يتكوّن من تلاقي الماء مع الحمم",
        example: "You need Obsidian to build a Nether portal.",
        img: "https://minecraft.wiki/images/Obsidian_JE3_BE2.png?format=original"
      },
      {
        text: "Creeper",
        meaning: "وحش أخضر صامت يقترب منك وينفجر",
        example: "A Creeper snuck up behind me and exploded!",
        img: "https://minecraft.wiki/images/Creeper_face_1.png?b6233"
      },
      {
        text: "Nether",
        meaning: "العالم السفلي — بيئة جهنمية تحت عالم العادي",
        example: "Build a portal to travel to the Nether.",
        img: "https://minecraft.wiki/images/Netherrack_JE4_BE2.png?8a940"
      },
      {
        text: "Enchant",
        meaning: "تحسين الأسلحة والأدوات بقوى سحرية",
        example: "Enchant your sword with Sharpness V.",
        img: "https://minecraft.wiki/images/Enchanting_Table_JE4_BE2.png?format=original"
      },
      {
        text: "Respawn",
        meaning: "العودة للحياة من جديد بعد الموت",
        example: "Set your respawn point using a bed.",
        img: "https://minecraft.wiki/images/thumb/Respawn_Anchor_%280%29_JE1.png/150px-Respawn_Anchor_%280%29_JE1.png?23b57"
      },
      {
        text: "Crafting",
        meaning: "صنع الأدوات والأسلحة من الموارد المجموعة",
        example: "Open the crafting table to build a sword.",
        img: "https://minecraft.wiki/images/Crafting_Table_JE4_BE3.png?format=original"
      },
      {
        text: "Biome",
        meaning: "منطقة جغرافية في العالم لها طبيعة وكائنات خاصة",
        example: "The desert biome is dry and sandy.",
        img: "https://minecraft.wiki/images/thumb/Biome_preview.png/350px-Biome_preview.png?4d6f7"
      },
      {
        text: "Mob",
        meaning: "كائن حي متحرك في اللعبة — عدائي أو ودّي",
        example: "Zombies are hostile mobs that spawn at night.",
        img: "https://minecraft.wiki/images/NPCFace.png?2fe0f"
      },
      { 
        text: "Spawn Point", 
        meaning: "مكان إعادة الإحياء بعد الموت", 
        example: "I slept in the bed to reset my spawn point near the village.", 
        img: "https://minecraft.wiki/images/White_Bed_JE2_BE2.png" 
      },
      { 
        text: "Mob Spawner", 
        meaning: "قفص توليد الوحوش التلقائي", 
        example: "We found a spider mob spawner and turned it into an XP farm.", 
        img: "https://minecraft.wiki/images/thumb/Monster_Spawner_JE4.png/150px-Monster_Spawner_JE4.png?64df6" 
      },
      { 
        text: "Hardcore Mode", 
        meaning: "طور اللعبة بحياة واحدة فقط", 
        example: "I've survived for 500 days in my Hardcore mode world!", 
        img: "https://minecraft.wiki/images/Hardcore_Heart.svg?dcc51" 
      },
      { 
        text: "Durability", 
        meaning: "مدى تحمل الأداة قبل الكسر", 
        example: "My diamond pickaxe has low durability, I need to mend it.", 
        img: "https://minecraft.wiki/images/thumb/Durability_bars.png/544px-Durability_bars.png?dda91" 
      },
      { 
        text: "XP (Experience)", 
        meaning: "نقاط الخبرة: النقاط اللي بتجمعها عشان تطور أسلحتك.", 
        example: "I need to kill more mobs to get XP for my sword enchantments.", 
        img: "https://minecraft.wiki/images/Experience_Orb_Value_3-6.png?6de8c" 
      },
      { 
        text: "AFK (Away From Keyboard)", 
        meaning: "بعيد عن الجهاز: لما تترك اللعبة شغالة وتروح تعمل إشي ثاني.", 
        example: "I’ll be AFK for 10 minutes at the iron farm.", 
        img: "https://minecraft.wiki/images/Human_face.png?db4dc" 
      },
      { 
        text: "Smelting", 
        meaning: "صهر: عملية تحويل الخامات (زي الحديد) لسبائك باستخدام الفرن.", 
        example: "I’m smelting the iron ore in the furnace to get iron ingots.", 
        img: "https://minecraft.wiki/images/Furnace_GUI.png?8d780" 
      },
      { 
        text: "Inventory", 
        meaning: "قائمة الأغراض: الشاشة اللي بتعرض كل الأغراض اللي معك.", 
        example: "My inventory is full of dirt; I need to throw some away.", 
        img: "https://minecraft.wiki/images/thumb/Inventory.png/176px-Inventory.png?9e5ea" 
      },
      { 
        text: "Pillagers", 
        meaning: "النهّابون: الأعداء اللي بشنوا غارات على القرى.", 
        example: "A group of Pillagers is attacking the village, get your bow!", 
        img: "https://minecraft.wiki/images/Pillager_face.png?7f2f5" 
      },
      { 
        text: "Enderman", 
        meaning: "أندرمان: وحش طويل القامة ينتقل آنياً، ويهاجمك إذا نظرت في عينيه.", 
        example: "Don't look the Enderman in the eyes, or he will teleport and attack you!", 
        img: "https://minecraft.wiki/images/Enderman_face.png?8ebeb" 
      },
      { 
        text: "Stronghold", 
        meaning: "الحصن: بناء تحت الأرض يحتوي على بوابة عالم الإند(The End).", 
        example: "We used Eyes of Ender to locate the stronghold and find the End Portal.", 
        img: "https://minecraft.wiki/images/thumb/StrongholdPortalRoom.png/250px-StrongholdPortalRoom.png?ff423" 
      },
      { 
        text: "Beacon", 
        meaning: "المنارة: بلوكة نادرة تعطي اللاعبين القريبين منها قدرات خارقة (بوفات).", 
        example: "A beacon provides powerful status effects like Haste and Strength to nearby players.", 
        img: "https://minecraft.wiki/images/thumb/Beacon_JE6_BE2.png/150px-Beacon_JE6_BE2.png?684bf" 
      },
      { 
        text: "Iron Golem", 
        meaning: "جولم الحديد: الحارس العملاق اللي بيحمي القرويين من الوحوش.", 
        example: "The Iron Golem attacked the zombies to protect the village.", 
        img: "https://minecraft.wiki/images/Iron_Golem_face.png?e15db" 
      },
      { 
        text: "Warden", 
        meaning: "وحش أعمى قوي جداً يعيش في الـ Ancient City", 
        example: "Keep quiet! The Warden can hear your footsteps from far away.", 
        img: "https://minecraft.wiki/images/thumb/Warden_face.png/120px-Warden_face.png?1b626" 
      },
      { 
        text: "Elder Guardian", 
        meaning: "وحش بحري ضخم يحرس معبد المحيط", 
        example: "The Elder Guardian gave me a mining fatigue effect in the temple.", 
        img: "https://minecraft.wiki/images/Guardian_face_1.png?2168d" 
      },
      { 
        text: "Ender Dragon", 
        meaning: "تنين عالم النهاية وهو زعيم اللعبة", 
        example: "We need many beds and arrows to defeat the Ender Dragon.", 
        img: "https://minecraft.wiki/images/Ender_Dragon_face.png?0c1e7" 
      },
      { 
        text: "Ancient City", 
        meaning: "مدينة قديمة غامضة في أعمق نقطة تحت الأرض", 
        example: "The Ancient City is full of loot, but beware of the Warden.", 
        img: "https://minecraft.wiki/images/thumb/Deep_Dark_Light.png/480px-Deep_Dark_Light.png?12f2a" 
      },
      { 
        text: "Copper", 
        meaning: "معدن النحاس المستخدم في البناء والصواعق", 
        example: "I used copper blocks to build the roof of my house.", 
        img: "https://minecraft.wiki/images/Invicon_Block_of_Copper.png?60e78" 
      },
      { 
        text: "Villager", 
        meaning: "سكان القرى المسالمين الذين يمكنك التجارة معهم", 
        example: "I traded some paper with the Villager to get emeralds.", 
        img: "https://minecraft.wiki/images/Villager_face.png?c2d14" 
      },
      { 
        text: "Skeleton", 
        meaning: "هيكل عظمي: وحش سريع بستخدم القوس والسهم وبحترق تحت الشمس", 
        example: "The Skeleton shot me with an arrow from behind the tree.", 
        img: "https://minecraft.wiki/images/Skeleton_face.png?652cd" 
      },
      { 
        text: "Silverfish", 
        meaning: "سمكة الفضة: حشرات صغيرة ومزعجة بتطلع من البلوكات في الحصون.", 
        example: "Don't break that block! It might hide a silverfish.", 
        img: "https://minecraft.wiki/images/Silverfish_face.png?1f7e0" 
      }
    ]
  },
  pubg: {
    title: "PUBG Terms",
    titleIcon: "https://raw.githubusercontent.com/twitter/twemoji/master/assets/svg/1fa82.svg", // 🪂
    desc:  "دليلك للنجاة والحصول على عشاء الدجاج!",
    bg:    "https://images.alphacoders.com/901/901375.jpg",
    words: [
      {
        text: "Airdrop",
        meaning: "صندوق إمدادات نادر يسقط من طائرة — يحتوي على أسلحة قوية",
        example: "Rush the airdrop before the enemy gets there!",
        img: "https://cdn-icons-png.flaticon.com/512/870/870160.png"
      },
      {
        text: "Flank",
        meaning: "الالتفاف حول العدو من الجانب أو الخلف",
        example: "Let's flank them from the left side.",
        img: "https://cdn-icons-png.flaticon.com/512/1046/1046352.png"
      },
      {
        text: "Loot",
        meaning: "جمع الغنائم والأسلحة والمعدات من الخريطة",
        example: "Good loot spawns in military compounds.",
        img: "https://cdn-icons-png.flaticon.com/512/3075/3075977.png"
      },
      {
        text: "Snipe",
        meaning: "القنص والاستهداف من مسافة بعيدة جداً",
        example: "He sniped me from 400 meters away.",
        img: "https://cdn-icons-png.flaticon.com/512/2917/2917995.png"
      },
      {
        text: "Revive",
        meaning: "إنقاذ زميلك الساقط وإعادته للمعركة",
        example: "Quick, revive me before they push!",
        img: "https://cdn-icons-png.flaticon.com/512/2382/2382533.png"
      },
      {
        text: "Zone",
        meaning: "الدائرة الآمنة — يجب البقاء داخلها أو تضرر من السم",
        example: "The zone is closing in, move now!",
        img: "https://cdn-icons-png.flaticon.com/512/1535/1535791.png"
      },
      {
        text: "Prone",
        meaning: "الاستلقاء على الأرض للاختباء أو تفادي الرصاص",
        example: "Go prone in the grass to stay hidden.",
        img: "https://cdn-icons-png.flaticon.com/512/3095/3095574.png"
      },
      {
        text: "Push",
        meaning: "الهجوم على العدو والتقدم نحوه بقوة",
        example: "They're reloading — push them now!",
        img: "https://cdn-icons-png.flaticon.com/512/1046/1046338.png"
      }
    ]
  }
};

// ── متغير يحفظ الكلمات المفلترة الحالية للبحث ──
let currentGameWords = [];

window.loadGameDictionary = function(gameKey) {
  toggleSidebar();
  const game = gameData[gameKey];
  if (!game) return;

  currentView      = gameKey;
  currentGameWords = [...game.words];

  setActiveNavLink(gameKey);

  // خلفية اللعبة عبر class + data attribute بدل inline style
  document.body.classList.add('game-bg-active');
  document.body.setAttribute('data-game', gameKey);

  // إخفاء عناصر القاموس الشخصي — بما فيها مربع البحث الشخصي
  document.getElementById('personalControls').style.display = 'none';
  document.querySelector('.toolbar').style.display          = 'none';
  document.getElementById('searchInput').style.display      = 'none';
  document.getElementById('searchFilter').style.display     = 'none';
  document.querySelector('.backup-zone').style.display      = 'none';
  document.getElementById('starredCount').style.display     = 'none';

  // إظهار search bar الألعاب وتفريغه
  const gameSearch = document.getElementById('gameSearchBar');
  gameSearch.style.display = 'block';
  gameSearch.querySelector('input').value = '';

  // تحديث العنوان
  document.querySelector('.page-header h1').innerHTML =
    `<img src="${game.titleIcon}" width="24" height="24" style="vertical-align:middle;margin-left:6px;" alt=""> ${game.title}`;
  document.getElementById('totalCount').innerText = game.desc;

  renderGameWords(currentGameWords);
};

function renderGameWords(words) {
  const query = (document.getElementById('gameSearchInput')?.value || '').toLowerCase().trim();

  let filtered = words.filter(w =>
    w.text.toLowerCase().includes(query) || w.meaning.includes(query)
  );

  // ترتيب ذكي: الكلمات اللي تبدأ بالـ query أول
  if (query) {
    filtered.sort((a, b) => {
      const aStarts = a.text.toLowerCase().startsWith(query);
      const bStarts = b.text.toLowerCase().startsWith(query);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      return a.text.localeCompare(b.text);
    });
  }

  document.getElementById('list').innerHTML = filtered.length === 0
    ? `<li style="text-align:center;padding:40px;color:var(--text-gray);list-style:none;">
         <div style="font-size:32px;margin-bottom:8px;">🔍</div>
         ما في نتائج للبحث
       </li>`
    : filtered.map(w => {
        const safeWord = w.text.replace(/'/g,"\\'");
        const safeMeaning = w.meaning.replace(/'/g,"\\'");
        const safeExample = (w.example||'').replace(/'/g,"\\'");
        // highlight النص إذا فيه query
        const dispText    = query ? hlGame(w.text, query)    : w.text;
        const dispMeaning = query ? hlGame(w.meaning, query) : w.meaning;
        return `
          <li class="game-card">
            <div class="game-info">
              <img src="${w.img}" class="game-icon" alt="${w.text}"
                   onerror="this.src='https://cdn-icons-png.flaticon.com/512/686/686589.png'">
              <div>
                <div class="word-text">${dispText}</div>
                <div class="meaning-text">${dispMeaning}</div>
                ${w.example ? `<div class="game-example">"${w.example}"</div>` : ''}
              </div>
            </div>
            <div class="game-card-actions">
              <div class="tooltip-wrap">
                <button class="icon-circle sound-btn game-sound-btn"
                        onclick="playGameSound('${safeWord}',event)">
                  <i class="fas fa-volume-up"></i>
                </button>
                <span class="tooltip-text">استمع</span>
              </div>
              <div class="tooltip-wrap">
                <button class="btn-add-mine"
                        onclick="addFromGame('${safeWord}','${safeMeaning}','${safeExample}')">
                  ➕
                </button>
                <span class="tooltip-text">أضف للقاموس</span>
              </div>
            </div>
          </li>`;
      }).join('');
}

// highlight للألعاب
function hlGame(text, query) {
  if (!query || !text) return text || '';
  try {
    return text.replace(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`, 'gi'),
      '<span class="highlight">$1</span>');
  } catch { return text; }
}

// صوت مباشر للكلمة (بدون id)
window.playGameSound = function(word, event) {
  if (event) event.stopPropagation();
  if (!word || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utt   = new SpeechSynthesisUtterance(word.trim());
  utt.lang    = 'en-US';
  utt.rate    = 0.9;
  const voice = window.speechSynthesis.getVoices().find(v => v.lang.startsWith('en'));
  if (voice) utt.voice = voice;
  window.speechSynthesis.speak(utt);
};

// البحث داخل قاموس اللعبة
window.searchGameWords = function() {
  renderGameWords(currentGameWords);
};

window.loadPersonalDictionary = function() {
  toggleSidebar();
  currentView = 'personal';

  // إزالة خلفية اللعبة
  document.body.classList.remove('game-bg-active');
  document.body.removeAttribute('data-game');

  // إظهار كل عناصر القاموس الشخصي
  document.getElementById('personalControls').style.display = 'block';
  document.querySelector('.toolbar').style.display          = '';
  document.getElementById('searchInput').style.display      = '';
  document.getElementById('searchFilter').style.display     = '';
  document.querySelector('.backup-zone').style.display      = '';
  document.getElementById('starredCount').style.display     = '';

  // إخفاء search bar الألعاب
  document.getElementById('gameSearchBar').style.display = 'none';

  document.querySelector('.page-header h1').innerHTML = '⚔️ قاموسك الشخصي';
  setActiveNavLink('personal');
  render();
};

window.addFromGame = async function(text, meaning, example) {
  const xpGain = 10;
  if (window.saveWordToCloud) {
    const realId = await window.saveWordToCloud(text, 'لعبة', meaning, example || 'من موسوعة الأساطير');
    if (realId) {
      // أضف الكلمة لـ window.words مع xpValue عشان يُرجع عند الحذف
      window.words.unshift({ id: realId, word: text, meaning, example: example || '', category: 'لعبة', starred: false, forgetCount: 0, xpValue: xpGain });
      showToast('تمت الإضافة لقاموسك! 💎');
      updateXP(xpGain);
      showXPBadge(xpGain, null, false);
    } else {
      showToast('سجل دخول أولاً عشان تحفظ اللوت! ⚠️');
    }
  } else {
    const newWord = { id: Date.now().toString(), word: text, meaning, example: example || '', category: 'لعبة', starred: false, forgetCount: 0, xpValue: xpGain };
    window.words.unshift(newWord);
    saveAndRender();
    showToast('تمت الإضافة للقاموس المحلي! 💎');
    updateXP(xpGain);
    showXPBadge(xpGain, null, false);
  }
};

// ═══════════════════════════════════════════════════════
// Render (القاموس الشخصي)
// ═══════════════════════════════════════════════════════
function highlightText(text, query) {
  if (!query || !text) return text || '';
  try {
    return text.replace(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`, "gi"), '<span class="highlight">$1</span>');
  } catch { return text; }
}

function render() {
  // لو مش على القاموس الشخصي ما نرندر
  if (currentView !== 'personal') return;

  const searchEl = document.getElementById('searchInput');
  const filterEl = document.getElementById('searchFilter');
  if (!searchEl) return;

  const query      = searchEl.value.toLowerCase().trim();
  const searchType = filterEl ? filterEl.value : 'all';

  let filtered = window.words.filter(w => {
    if (!w.word) return false;
    const wm = w.word.toLowerCase().includes(query);
    const mm = (w.meaning  || '').toLowerCase().includes(query);
    const em = (w.example  || '').toLowerCase().includes(query);
    const matches = searchType === 'word'    ? wm
                  : searchType === 'meaning' ? mm
                  : searchType === 'example' ? em
                  : wm || mm || em;
    return matches && (currentFilter === 'all' || w.starred);
  });

  // ترتيب ذكي: الكلمات اللي تبدأ بالـ query تجي أول
  if (query) {
    filtered.sort((a, b) => {
      const aStarts = a.word.toLowerCase().startsWith(query);
      const bStarts = b.word.toLowerCase().startsWith(query);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      return a.word.localeCompare(b.word);
    });
  }

  const countEl = document.getElementById('totalCount');
  const starEl  = document.getElementById('starredCount');
  if (countEl) countEl.innerText = `إجمالي الكلمات: ${window.words.length}`;
  if (starEl)  starEl.innerText  = `⭐ الصعبة: ${window.words.filter(w => w.starred).length}`;

  const listEl = document.getElementById('list');
  if (!listEl) return;

  if (filtered.length === 0) {
    listEl.innerHTML = `
      <li style="list-style:none;text-align:center;padding:40px 20px;color:var(--text-gray);">
        <div style="font-size:32px;margin-bottom:10px;">📖</div>
        ${query ? 'ما في نتائج للبحث' : 'قاموسك فاضي، ابدأ بإضافة كلمة!'}
      </li>`;
    return;
  }

  listEl.innerHTML = filtered.map(w => {
    const ri   = window.words.findIndex(x => x.id === w.id);
    const drag = isReorderMode
      ? `draggable="true" ondragstart="drag(event,${ri})" ondragover="allowDrop(event)" ondrop="drop(event,${ri})"`
      : '';
    const cls = ['word-card', isReorderMode ? 'reorder-mode-li' : '', selectedIndices.includes(ri) ? 'selected-for-move' : '']
      .filter(Boolean).join(' ');
    const safeId = w.id.replace(/'/g, "\\'");

    return `
      <li ${drag} class="${cls}" onclick="handleLiClick(${ri}, this)">
        <div class="word-body" style="flex:1;min-width:0;">
          <div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:4px;">
            <button class="star-btn ${w.starred ? 'active' : ''}"
                    onclick="toggleStar('${safeId}',event)">
              <i class="fas fa-star"></i>
            </button>
            <div>
              <div class="word-text">
                ${highlightText(w.word, query)}
                <span class="cat-tag tag-${w.category}">${w.category}</span>
              </div>
              <div class="meaning-text">${highlightText(w.meaning, query)}</div>
            </div>
          </div>
          ${w.example ? `<div class="example-box"><b>Ex:</b> ${highlightText(w.example, query)}</div>` : ''}
        </div>
        ${isReorderMode
          ? '<span style="font-size:20px;color:#475569;padding:0 8px;flex-shrink:0;">☰</span>'
          : `<div class="actions">
               <button class="icon-circle sound-btn" onclick="playSound('${safeId}',event)"><i class="fas fa-volume-up"></i></button>
               <button class="icon-circle edit-btn"  onclick="editWord('${safeId}',event)"><i class="fas fa-edit"></i></button>
               <button class="icon-circle del-btn"   onclick="deleteWord('${safeId}',event)"><i class="fas fa-trash-alt"></i></button>
             </div>`
        }
      </li>`;
  }).join('');
}

// ═══════════════════════════════════════════════════════
// QUIZ — Flashcard 3D
// ═══════════════════════════════════════════════════════
function openQuizSetup() {
  if (!window.words.length) { alert("القاموس فاضي!"); return; }
  const el = document.getElementById('quizSetupOverlay');
  el.style.display = 'flex';
  setTimeout(() => el.classList.add('show'), 10);
}

function closeQuizSetup() {
  const el = document.getElementById('quizSetupOverlay');
  el.classList.remove('show');
  setTimeout(() => el.style.display = 'none', 300);
}

function startActualQuiz(mode) {
  closeQuizSetup();
  let words = [...window.words];

  if (mode === 'recent') {
    words.sort((a, b) => new Date(b.createdAt||0) - new Date(a.createdAt||0));
    words = words.slice(0, 10);
  } else if (mode === 'old') {
    words.sort((a, b) => (a.id||0) - (b.id||0));
    words = words.slice(0, 10);
  } else if (mode === 'forgotten') {
    words = words.filter(w => (w.forgetCount||0) > 0).sort((a,b) => b.forgetCount - a.forgetCount);
    if (!words.length) {
      alert("ما عندك كلمات بتغلط فيها. رح نختبرك عشوائياً.");
      words = [...window.words].sort(() => Math.random()-0.5).slice(0, 10);
    } else words = words.slice(0, 10);
  } else if (mode === 'starred') {
    words = words.filter(w => w.starred);
    if (!words.length) { alert("ما عندك كلمات صعبة. رح نختبرك بالكل."); words = [...window.words]; }
  } else {
    words.sort(() => Math.random()-0.5);
  }

  currentQuizWords = words;
  quizIndex = 0;
  currentStreak = 0;

  const el = document.getElementById('quizOverlay');
  el.style.display = 'flex';
  setTimeout(() => el.classList.add('show'), 10);
  updateCard();
}

function updateCard() {
  if (quizIndex >= currentQuizWords.length) {
    showToast("أبدعت! أنهيت الكلمات 👏");
    closeQuiz();
    return;
  }
  const card = document.getElementById('mainCard');
  if (card.classList.contains('is-flipped')) {
    card.style.transition = 'none';
    card.classList.remove('is-flipped');
    void card.offsetWidth;
    card.style.transition = '';
  }
  const w = currentQuizWords[quizIndex];
  document.getElementById('cardFrontText').innerText   = w.word;
  document.getElementById('cardBackText').innerText    = w.meaning;
  document.getElementById('cardBackExample').innerText = w.example || '';
  const hint = document.getElementById('quizHintText');
  hint.innerText = w.example || 'لا يوجد مثال';
  hint.classList.remove('show');

  const pct = (quizIndex / currentQuizWords.length) * 100;
  document.getElementById('quizCardProgress').style.width = pct + '%';
  document.getElementById('quizCardCounter').innerText    = `${quizIndex+1} / ${currentQuizWords.length}`;
}

function flipCard()      { document.getElementById('mainCard').classList.toggle('is-flipped'); }
function showHint(event) { event.stopPropagation(); document.getElementById('quizHintText').classList.add('show'); }

function closeQuiz() {
  const el = document.getElementById('quizOverlay');
  el.classList.remove('show');
  setTimeout(() => el.style.display = 'none', 300);
}

function showStreakMsg(streak) {
  const msgs = { 3: "🔥 3 صح ورا بعض!", 5: "💪 5 صح! أسطورة!", 7: "🚀 7 ورا بعض!", 10: "👑 10! أنت الأفضل!" };
  if (msgs[streak]) showToast(msgs[streak]);
}

function markRemember() {
  const w = currentQuizWords[quizIndex];
  window.words = window.words.map(x =>
    x.id === w.id ? { ...x, forgetCount: Math.max((x.forgetCount||0)-1, 0) } : x
  );
  saveAndRender();
  currentStreak++;
  showStreakMsg(currentStreak);
  updateXP(2);
  if (quizIndex < currentQuizWords.length - 1) { quizIndex++; updateCard(); }
  else { showToast("أبدعت! 👏"); setTimeout(closeQuiz, 600); }
}

function markForgot() {
  currentStreak = 0;
  const w = currentQuizWords[quizIndex];
  window.words = window.words.map(x =>
    x.id === w.id ? { ...x, forgetCount: (x.forgetCount||0)+1 } : x
  );
  saveAndRender();
  currentQuizWords.splice(Math.min(quizIndex+3, currentQuizWords.length), 0, w);
  quizIndex++;
  updateCard();
}

function playQuizSound(event) {
  if (currentQuizWords[quizIndex]) playSound(currentQuizWords[quizIndex].word, event);
}

// ═══════════════════════════════════════════════════════
// Keyboard shortcuts
// ═══════════════════════════════════════════════════════
document.addEventListener('keydown', function(e) {
  if (e.key !== 'Enter') return;
  const active = document.activeElement;
  if (active.id === 'wordInput') { e.preventDefault(); window.fetchSuggestions(); }
  else if (active.id === 'gameSearchInput') { /* لا شيء - oninput يتعامل معه */ }
  else if (!['INPUT','TEXTAREA','BUTTON','SELECT'].includes(active.tagName)) {
    e.preventDefault();
    document.getElementById('addBtn')?.click();
  }
});

// ═══════════════════════════════════════════════════════
// Init
// ═══════════════════════════════════════════════════════
window.onload = function() {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.getVoices();
    if (speechSynthesis.onvoiceschanged !== undefined)
      speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
  }
  renderXPBar();
  render();
};
