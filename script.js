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

// ═══════════════════════════════════════════════════════
// Sidebar
// ═══════════════════════════════════════════════════════
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('overlay').classList.toggle('show');
}

// ═══════════════════════════════════════════════════════
// Modal & Toast
// ═══════════════════════════════════════════════════════
function showModal(id) { document.getElementById(id).style.display = 'flex'; }
function hideModal(id) { document.getElementById(id).style.display = 'none'; }

function showToast(msg) {
  const t = document.getElementById('toastMessage');
  if (!t) return;
  t.innerText = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

// ═══════════════════════════════════════════════════════
// XP System
// ═══════════════════════════════════════════════════════
function updateXP(amount) {
  userXP += amount;
  localStorage.setItem('userXP', userXP);
  // لو أضفنا شريط XP لاحقاً رح يشتغل تلقائياً
}

// ═══════════════════════════════════════════════════════
// Save & Render helpers
// ═══════════════════════════════════════════════════════
function saveAndRender() {
  localStorage.setItem('lootlinguaDict', JSON.stringify(window.words));
  render();
}

function clearInputs() {
  const fields = ['wordInput','meaningInput','exampleInput'];
  fields.forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
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
    btn.innerText = 'إضافة للقاموس 💾';
    btn.style.background = '';
  } else {
    const newWord = { id: Date.now().toString(), word: w, meaning: m, example: ex, category: c, starred: false, forgetCount: 0 };
    window.words.unshift(newWord);
    if (window.saveWordToCloud) {
      const realId = await window.saveWordToCloud(w, c, m, ex);
      if (realId) newWord.id = realId;
    }
    updateXP(5);
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
  btn.innerText = 'تحديث الكلمة 💾';
  btn.style.background = '#059669';
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

// ═══════════════════════════════════════════════════════
// Delete Word (modal)
// ═══════════════════════════════════════════════════════
window.deleteWord = function(id, event) {
  if (event) event.stopPropagation();
  pendingDeleteId = id;
  document.getElementById('deleteConfirmBtn').onclick = async function() {
    hideModal('deleteModal');
    window.words = window.words.filter(w => w.id !== pendingDeleteId);
    if (window.deleteWordFromCloud) await window.deleteWordFromCloud(pendingDeleteId);
    pendingDeleteId = null;
    saveAndRender();
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
// Sound — speechSynthesis
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
      const safeAr = (s.ar  || '').replace(/\\/g,'\\\\').replace(/'/g,"\\'");
      const safeEx = (s.ex  || '').replace(/\\/g,'\\\\').replace(/'/g,"\\'");
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
const gameData = {
  minecraft: {
    title: "Minecraft Dictionary ⛏️",
    desc:  "اجمع الموارد وافهم كل مصطلحات اللعبة!",
    bg:    "https://images.alphacoders.com/109/1099238.png",
    words: [
      { text: "Obsidian", meaning: "حجر بركاني صلب جداً",    img: "https://minecraft.wiki/images/Obsidian_JE3_BE2.png" },
      { text: "Creeper",  meaning: "وحش متفجر صامت خطير",    img: "https://minecraft.wiki/images/Creeper_JE2_BE2.png" },
      { text: "Nether",   meaning: "العالم السفلي (الجحيم)",  img: "https://minecraft.wiki/images/Netherrack_JE4_BE2.png" },
      { text: "Enchant",  meaning: "تطوير الأسلحة بالسحر",    img: "https://minecraft.wiki/images/Enchanting_Table_JE4_BE2.png" },
      { text: "Respawn",  meaning: "العودة للحياة بعد الموت", img: "https://cdn-icons-png.flaticon.com/512/458/458534.png" }
    ]
  },
  pubg: {
    title: "PUBG Terms 🪂",
    desc:  "دليلك للنجاة والحصول على عشاء الدجاج!",
    bg:    "https://images.alphacoders.com/901/901375.jpg",
    words: [
      { text: "Airdrop", meaning: "صندوق إمدادات جوي نادر",  img: "https://static.wikia.nocookie.net/battlegrounds_gamepedia_en/images/1/1a/Icon_item_Air_Drop.png" },
      { text: "Flank",   meaning: "الالتفاف خلف العدو",       img: "https://cdn-icons-png.flaticon.com/512/3593/3593455.png" },
      { text: "Loot",    meaning: "جمع الغنائم والأسلحة",     img: "https://cdn-icons-png.flaticon.com/512/1041/1041373.png" },
      { text: "Snipe",   meaning: "القنص من مسافة بعيدة",     img: "https://cdn-icons-png.flaticon.com/512/2621/2621230.png" },
      { text: "Revive",  meaning: "إنقاذ زميلك الساقط",       img: "https://cdn-icons-png.flaticon.com/512/2382/2382461.png" }
    ]
  }
};

window.loadGameDictionary = function(gameKey) {
  toggleSidebar();
  const game = gameData[gameKey];
  if (!game) return;

  // خلفية اللعبة
  document.body.style.backgroundImage    = `url('${game.bg}')`;
  document.body.style.backgroundSize     = 'cover';
  document.body.style.backgroundPosition = 'center';
  document.body.style.backgroundAttachment = 'fixed';

  // إخفاء فورم الإضافة
  const controls = document.getElementById('personalControls');
  if (controls) controls.style.display = 'none';

  // إخفاء أدوات التصفية والترتيب والبحث
  document.querySelector('.toolbar').style.display      = 'none';
  document.getElementById('searchInput').style.display  = 'none';
  document.getElementById('searchFilter').style.display = 'none';
  document.querySelector('.backup-zone').style.display  = 'none';

  // تحديث العنوان والوصف
  document.querySelector('.page-header h1').innerText   = game.title;
  document.getElementById('totalCount').innerText       = game.desc;
  document.getElementById('starredCount').style.display = 'none';

  // رندر بطاقات اللعبة
  document.getElementById('list').innerHTML = game.words.map(w => `
    <li class="game-card">
      <div class="game-info">
        <img src="${w.img}" class="game-icon" alt="${w.text}"
             onerror="this.src='https://cdn-icons-png.flaticon.com/512/686/686589.png'">
        <div>
          <div class="word-text">${w.text}</div>
          <div class="meaning-text">${w.meaning}</div>
        </div>
      </div>
      <button class="btn-add-mine" onclick="addFromGame('${w.text.replace(/'/g,"\\'")}', '${w.meaning.replace(/'/g,"\\'")}')">أضف لقاموسي ➕</button>
    </li>
  `).join('');

  // تحديث الـ active link في الـ sidebar
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
};

window.loadPersonalDictionary = function() {
  toggleSidebar();

  // إرجاع الخلفية
  document.body.style.backgroundImage = 'none';

  // إظهار كل العناصر المخفية
  const controls = document.getElementById('personalControls');
  if (controls) controls.style.display = 'block';
  document.querySelector('.toolbar').style.display      = '';
  document.getElementById('searchInput').style.display  = '';
  document.getElementById('searchFilter').style.display = '';
  document.querySelector('.backup-zone').style.display  = '';
  document.getElementById('starredCount').style.display = '';

  document.querySelector('.page-header h1').innerText = '⚔️ قاموسك الشخصي';

  // الـ active link
  document.querySelectorAll('.nav-link').forEach((l, i) => l.classList.toggle('active', i === 0));

  render();
};

window.addFromGame = async function(text, meaning) {
  if (window.saveWordToCloud) {
    const realId = await window.saveWordToCloud(text, 'لعبة', meaning, 'من موسوعة الأساطير');
    if (realId) {
      showToast("تمت الإضافة لقاموسك! 💎");
      updateXP(10);
    } else {
      showToast("سجل دخول أولاً عشان تحفظ اللوت! ⚠️");
    }
  } else {
    const newWord = { id: Date.now().toString(), word: text, meaning, category: 'لعبة', starred: false, forgetCount: 0 };
    window.words.unshift(newWord);
    saveAndRender();
    showToast("تمت الإضافة للقاموس المحلي! 💎");
    updateXP(10);
  }
};

// ═══════════════════════════════════════════════════════
// Render
// ═══════════════════════════════════════════════════════
function highlightText(text, query) {
  if (!query || !text) return text || '';
  try {
    return text.replace(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`, "gi"), '<span class="highlight">$1</span>');
  } catch { return text; }
}

function render() {
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

  // إحصائيات
  const countEl = document.getElementById('totalCount');
  const starEl  = document.getElementById('starredCount');
  if (countEl) countEl.innerText = `إجمالي الكلمات: ${window.words.length}`;
  if (starEl)  starEl.innerText  = `⭐ الصعبة: ${window.words.filter(w => w.starred).length}`;

  const listEl = document.getElementById('list');
  if (!listEl) return;

  if (filtered.length === 0) {
    listEl.innerHTML = `
      <li style="list-style:none; text-align:center; padding:40px 20px; color:var(--text-gray);">
        <div style="font-size:32px; margin-bottom:10px;">📖</div>
        ${query ? 'ما في نتائج للبحث' : 'قاموسك فاضي، ابدأ بإضافة كلمة!'}
      </li>`;
    return;
  }

  listEl.innerHTML = filtered.map(w => {
    const ri   = window.words.findIndex(x => x.id === w.id);
    const drag = isReorderMode
      ? `draggable="true" ondragstart="drag(event,${ri})" ondragover="allowDrop(event)" ondrop="drop(event,${ri})"`
      : '';
    const cls = [
      'word-card',
      isReorderMode ? 'reorder-mode-li' : '',
      selectedIndices.includes(ri) ? 'selected-for-move' : ''
    ].filter(Boolean).join(' ');

    // تنظيف القيم عشان ما تكسر الـ onclick
    const safeId = w.id.replace(/'/g, "\\'");

    return `
      <li ${drag} class="${cls}" onclick="handleLiClick(${ri}, this)">
        <div class="word-body" style="flex:1; min-width:0;">
          <div style="display:flex; align-items:flex-start; gap:8px; margin-bottom:4px;">
            <button class="star-btn ${w.starred ? 'active' : ''}"
                    onclick="toggleStar('${safeId}', event)" title="${w.starred ? 'إزالة من الصعبة' : 'علّم كصعبة'}">
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
          ? '<span style="font-size:20px; color:#475569; padding:0 8px; flex-shrink:0;">☰</span>'
          : `<div class="actions">
               <button class="icon-circle sound-btn" onclick="playSound('${safeId}', event)" title="استمع"><i class="fas fa-volume-up"></i></button>
               <button class="icon-circle edit-btn"  onclick="editWord('${safeId}', event)"  title="تعديل"><i class="fas fa-edit"></i></button>
               <button class="icon-circle del-btn"   onclick="deleteWord('${safeId}', event)" title="حذف"><i class="fas fa-trash-alt"></i></button>
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
    words.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    words = words.slice(0, 10);
  } else if (mode === 'old') {
    words.sort((a, b) => (a.id || 0) - (b.id || 0));
    words = words.slice(0, 10);
  } else if (mode === 'forgotten') {
    words = words.filter(w => (w.forgetCount || 0) > 0).sort((a, b) => b.forgetCount - a.forgetCount);
    if (!words.length) {
      alert("ما عندك كلمات بتغلط فيها. رح نختبرك عشوائياً.");
      words = [...window.words].sort(() => Math.random() - 0.5).slice(0, 10);
    } else words = words.slice(0, 10);
  } else if (mode === 'starred') {
    words = words.filter(w => w.starred);
    if (!words.length) { alert("ما عندك كلمات صعبة. رح نختبرك بالكل."); words = [...window.words]; }
  } else {
    words.sort(() => Math.random() - 0.5);
  }

  currentQuizWords = words;
  quizIndex        = 0;
  currentStreak    = 0;

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
  document.getElementById('quizCardCounter').innerText    = `${quizIndex + 1} / ${currentQuizWords.length}`;
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
    x.id === w.id ? { ...x, forgetCount: Math.max((x.forgetCount || 0) - 1, 0) } : x
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
    x.id === w.id ? { ...x, forgetCount: (x.forgetCount || 0) + 1 } : x
  );
  saveAndRender();
  currentQuizWords.splice(Math.min(quizIndex + 3, currentQuizWords.length), 0, w);
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
  render();
};
