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
let currentView      = 'personal'; // 'personal' | 'minecraft' | 'pubg' | 'starred' | 'quiz'

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
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('overlay');
  if (!sidebar || !overlay) return;
  sidebar.classList.toggle('open');
  const isOpen = sidebar.classList.contains('open');
  overlay.classList.toggle('show', isOpen);
  document.body.classList.toggle('sidebar-open', isOpen);
}

function closeSidebarIfOpen() {
  const sidebar = document.getElementById('sidebar');
  if (sidebar?.classList.contains('open')) toggleSidebar();
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
  t.textContent = String(msg ?? '');
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

// ═══════════════════════════════════════════════════════
// PERSISTENCE HELPERS
// ═══════════════════════════════════════════════════════
function loadInt(k,d)  { const v=parseInt(localStorage.getItem(k)); return isNaN(v)?d:v; }
function saveInt(k,v)  { localStorage.setItem(k,String(v)); }
function loadJSON(k,d) { try{const r=JSON.parse(localStorage.getItem(k));return r??d;}catch{return d;} }
function saveJSON(k,v) { localStorage.setItem(k,JSON.stringify(v)); }
function todayStr()    { return new Date().toISOString().slice(0,10); }

// بيانات الملف الشخصي للسحابة (وحدات ES تتصل بهذا بدل `let` من السكربت العادي)
window.getLootlinguaProfilePayload = function() {
  return {
    userXP,
    dailyStreak,
    lastActivityDate: lastActivity,
    activityMap:      loadJSON('activityMap', {}),
    addedGameWords:   loadJSON('addedGameWords', []),
  };
};

window.mergeLootlinguaProfileFromCloud = function(d) {
  if (!d) return;
  if (d.userXP !== undefined && d.userXP !== null) {
    const cloud = Number(d.userXP) || 0;
    if (cloud !== userXP) {
      userXP = Math.max(cloud, userXP);
      saveInt('userXP', userXP);
    }
  }
  if (d.dailyStreak !== undefined) {
    dailyStreak = d.dailyStreak;
    saveInt('dailyStreak', dailyStreak);
  }
  if (d.lastActivityDate) {
    lastActivity = d.lastActivityDate;
    localStorage.setItem('lastActivityDate', lastActivity);
  }
  if (d.activityMap) {
    const localMap = loadJSON('activityMap', {});
    const merged   = { ...d.activityMap };
    Object.entries(localMap).forEach(([k, v]) => { merged[k] = Math.max(merged[k] || 0, v); });
    saveJSON('activityMap', merged);
  }
  if (d.addedGameWords && Array.isArray(d.addedGameWords)) {
    const local  = loadJSON('addedGameWords', []);
    const merged = [...new Set([...d.addedGameWords, ...local])];
    saveJSON('addedGameWords', merged);
  }
  renderStreak();
  renderDailyGoal();
  renderXPBar();
  if (typeof renderStatsNumbers === 'function' &&
      document.getElementById('statsPanel')?.style.display !== 'none') {
    renderStatsNumbers();
    renderHeatmap();
  }
};

function beginViewSwitch() {
  document.body.classList.add('view-transitioning');
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      setTimeout(() => document.body.classList.remove('view-transitioning'), 50);
    });
  });
}

// ═══════════════════════════════════════════════════════
// SPAM PROTECTION
// ═══════════════════════════════════════════════════════
const _rateLimits = {};

/**
 * rate-limit any action
 * key: unique name, limit: max calls, windowMs: time window in ms
 * returns true if allowed, false if blocked
 */
function rateLimit(key, limit, windowMs) {
  const now   = Date.now();
  const state = _rateLimits[key] || { calls: [], blocked: false };

  // امسح المكالمات القديمة خارج النافذة
  state.calls = state.calls.filter(t => now - t < windowMs);

  if (state.calls.length >= limit) {
    if (!state.blocked) {
      state.blocked = true;
      const secs = Math.ceil(windowMs / 1000);
      showToast(`تم تجاوز الحد. انتظر ${secs} ث`);
      setTimeout(() => { state.blocked = false; }, windowMs);
    }
    _rateLimits[key] = state;
    return false;
  }

  state.calls.push(now);
  state.blocked = false;
  _rateLimits[key] = state;
  return true;
}

// ═══════════════════════════════════════════════════════
// XP & GAMIFICATION
// ═══════════════════════════════════════════════════════
const XP_RANKS = [
  {min:0,   max:14,       label:'Noob',     iconClass:'fa-solid fa-seedling', color:'#94a3b8'},
  {min:15,  max:39,       label:'Wanderer', iconClass:'fa-solid fa-compass', color:'#67e8f9'},
  {min:40,  max:79,       label:'Learner',  iconClass:'fa-solid fa-book-open', color:'#60a5fa'},
  {min:80,  max:149,      label:'Explorer', iconClass:'fa-solid fa-binoculars', color:'#818cf8'},
  {min:150, max:249,      label:'Pro',      iconClass:'fa-solid fa-sword', color:'#34d399'},
  {min:250, max:399,      label:'Veteran',  iconClass:'fa-solid fa-shield-halved', color:'#4ade80'},
  {min:400, max:599,      label:'Elite',    iconClass:'fa-solid fa-fire', color:'#f59e0b'},
  {min:600, max:899,      label:'Master',   iconClass:'fa-solid fa-star', color:'#fbbf24'},
  {min:900, max:1299,     label:'Legend',   iconClass:'fa-solid fa-crown', color:'#a78bfa'},
  {min:1300,max:Infinity, label:'Linguaer', iconClass:'fa-solid fa-trophy', color:'#f472b6'},
];

// userXP already declared in State section above — just reload from localStorage
userXP = loadInt('userXP', 0);

function getRank(xp)     { return [...XP_RANKS].reverse().find(r=>xp>=r.min)||XP_RANKS[0]; }
function getNextRank(xp) { return XP_RANKS.find(r=>r.min>xp)||null; }

function updateXP(amount) {
  if (!amount) return;
  const oldRank = getRank(userXP);
  userXP = Math.max(0, userXP + amount);
  saveInt('userXP', userXP);
  if (window.saveProfileToCloud) window.saveProfileToCloud();
  renderXPBar();
  if (amount > 0 && getRank(userXP).label !== oldRank.label)
    setTimeout(()=>showRankUp(getRank(userXP)), 400);
}

function renderXPBar() {
  const rank=getRank(userXP), next=getNextRank(userXP);
  const pct=next?Math.min(((userXP-rank.min)/(next.min-rank.min))*100,100):100;
  const el = {
    fill: document.getElementById('xpFill'),
    lbl:  document.getElementById('xpRankLabel'),
    ico:  document.getElementById('xpRankIcon'),
    val:  document.getElementById('xpValue'),
    nxt:  document.getElementById('xpNext'),
  };
  if (!el.fill) return;
  el.fill.style.width      = pct+'%';
  el.fill.style.background = `linear-gradient(90deg,${rank.color}ee,${rank.color}55)`;
  if (el.lbl) { el.lbl.textContent=rank.label; el.lbl.style.color=rank.color; }
  if (el.ico)   el.ico.innerHTML = `<i class="${rank.iconClass}" aria-hidden="true"></i>`;
  if (el.val)   el.val.textContent = userXP+' XP';
  if (el.nxt)   el.nxt.innerHTML = next ? `${next.min} XP` : `MAX <i class="fa-solid fa-trophy" aria-hidden="true"></i>`;
}

function showXPBadge(amount, anchorId, isNeg) {
  const b = document.getElementById('xpBadge');
  if (!b) return;
  b.textContent      = (isNeg?'-':'+')+amount+' XP';
  b.style.background = isNeg ? '#ef4444' : '#f59e0b';
  b.style.color      = isNeg ? '#fff'    : '#0f172a';
  const a = anchorId ? document.getElementById(anchorId) : null;
  if (a) {
    const r=a.getBoundingClientRect();
    b.style.left=(r.left+r.width/2)+'px'; b.style.bottom=(window.innerHeight-r.top+12)+'px';
    b.style.transform='translateX(-50%)';
  } else { b.style.left='50%'; b.style.bottom='90px'; b.style.transform='translateX(-50%)'; }
  b.classList.remove('fly'); void b.offsetWidth; b.classList.add('fly');
  const ic=document.getElementById('xpRankIcon');
  if (ic){ic.classList.add('pop');setTimeout(()=>ic.classList.remove('pop'),350);}
}

function showRankUp(rank) {
  const t=document.getElementById('toastMessage'); if(!t)return;
  t.textContent='ترقية! أصبحت '+rank.label;
  t.style.background=rank.color; t.style.color='#0f172a'; t.classList.add('show');
  try {
    const ctx=new(window.AudioContext||window.webkitAudioContext)();
    [523,659,784].forEach((f,i)=>{
      const o=ctx.createOscillator(),g=ctx.createGain();
      o.connect(g);g.connect(ctx.destination);o.type='sine';o.frequency.value=f;
      g.gain.setValueAtTime(0.15,ctx.currentTime+i*0.13);
      g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+i*0.13+0.35);
      o.start(ctx.currentTime+i*0.13); o.stop(ctx.currentTime+i*0.13+0.35);
    });
  } catch(e){}
  setTimeout(()=>{t.classList.remove('show');t.style.background='';t.style.color='';},3500);
}

// ── Daily Streak ──────────────────────────────────────
let dailyStreak  = loadInt('dailyStreak', 0);
let lastActivity = localStorage.getItem('lastActivityDate') || '';

/**
 * يُستدعى مرة واحدة عند فتح الصفحة — يسجّل اليوم ويحدث الـ streak
 */
function checkAndUpdateStreak() {
  const today     = todayStr();
  const yesterday = new Date(Date.now()-864e5).toISOString().slice(0,10);

  // سجّل اليوم في activityMap (فتح الموقع = نشاط)
  const map = loadJSON('activityMap', {});
  if (!map[today]) map[today] = 0; // 0 يعني فتح بدون إضافة — سيُحدَّث لاحقاً
  saveJSON('activityMap', map);

  if (lastActivity === today) { renderStreak(); return; } // نفس اليوم

  if (lastActivity === yesterday) {
    dailyStreak++;
    setTimeout(()=>showToast('Streak '+dailyStreak+' يوم!'), 1000);
  } else if (lastActivity !== '') {
    // انكسر الـ streak
    dailyStreak = 1;
  } else {
    dailyStreak = 1; // أول استخدام
  }

  saveInt('dailyStreak', dailyStreak);
  lastActivity = today;
  localStorage.setItem('lastActivityDate', today);
  if (window.saveProfileToCloud) window.saveProfileToCloud();
  renderStreak();
}

function renderStreak() {
  const el   = document.getElementById('streakCount');
  const ico  = document.getElementById('streakIcon');
  const wrap = document.getElementById('streakWrap');
  if (!el) return;
  el.textContent = dailyStreak+' يوم';
  if (dailyStreak>=30)      { if(ico)ico.innerHTML='<i class="fa-solid fa-bolt"></i>'; el.style.color='#60a5fa'; }
  else if (dailyStreak>=14) { if(ico)ico.innerHTML='<i class="fa-solid fa-fire"></i>'; el.style.color='#a78bfa'; }
  else if (dailyStreak>=7)  { if(ico)ico.innerHTML='<i class="fa-solid fa-fire"></i>'; el.style.color='#f59e0b'; }
  else                      { if(ico)ico.innerHTML='<i class="fa-solid fa-fire"></i>'; el.style.color='#94a3b8'; }
  if (wrap) wrap.className='streak-wrap'+(dailyStreak>=7?' streak-hot':'');
}

// ── Daily Goal & Confetti ──────────────────────────────
const DAILY_GOAL = 5;

function getDailyCount() {
  const map = loadJSON('activityMap', {});
  return map[todayStr()] || 0;
}

function incrementDailyCount() {
  const today = todayStr();
  const map   = loadJSON('activityMap', {});
  map[today]  = (map[today] || 0) + 1;
  saveJSON('activityMap', map);
  if (window.saveProfileToCloud) window.saveProfileToCloud();
  renderDailyGoal();
  if (map[today] === DAILY_GOAL) setTimeout(launchConfetti, 400);
}

function renderDailyGoal() {
  const count = getDailyCount();
  const pct   = Math.min((count / DAILY_GOAL) * 100, 100);
  const ring  = document.getElementById('goalRing');
  const txt   = document.getElementById('goalText');
  if (!ring) return;
  const circ = 100.53;
  ring.style.strokeDashoffset = circ - (pct / 100) * circ;
  ring.style.stroke = pct >= 100 ? '#10b981' : '#3b82f6';
  if (txt) txt.textContent = count+'/'+DAILY_GOAL;
}

function launchConfetti() {
  try {
    const ctx=new(window.AudioContext||window.webkitAudioContext)();
    [[392,0],[523,.1],[659,.2],[784,.3],[1047,.45]].forEach(([f,t])=>{
      const o=ctx.createOscillator(),g=ctx.createGain();o.connect(g);g.connect(ctx.destination);
      o.type='triangle'; o.frequency.value=f;
      g.gain.setValueAtTime(0.2,ctx.currentTime+t);
      g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+t+0.4);
      o.start(ctx.currentTime+t); o.stop(ctx.currentTime+t+0.4);
    });
  } catch(e) {}
  const container=document.getElementById('confettiContainer');
  if (!container) return;
  container.innerHTML='';
  const colors=['#f59e0b','#3b82f6','#10b981','#a78bfa','#f472b6','#34d399'];
  for(let i=0;i<70;i++){
    const p=document.createElement('div'); p.className='confetti-piece';
    p.style.cssText=`left:${Math.random()*100}%;background:${colors[i%colors.length]};width:${6+Math.random()*6}px;height:${6+Math.random()*6}px;border-radius:${Math.random()>.5?'50%':'2px'};animation-delay:${Math.random()*.5}s;animation-duration:${1.2+Math.random()*.8}s;`;
    container.appendChild(p);
  }
  container.style.display='block';
  const t=document.getElementById('toastMessage');
  if(t){t.textContent='أكملت هدفك اليوم!';t.classList.add('show');}
  setTimeout(()=>{container.style.display='none';container.innerHTML='';if(t)t.classList.remove('show');},3000);
}

// ── Combo System ──────────────────────────────────────
let comboTimestamps = [];
function checkCombo() {
  const now = Date.now();
  comboTimestamps.push(now);
  if (comboTimestamps.length > 3) comboTimestamps.shift();
  return comboTimestamps.length===3 && (comboTimestamps[2]-comboTimestamps[0])<60000;
}

// ── Word normalization & duplicate check ──────────────
function normalizeWord(w) {
  return String(w||'').toLowerCase().trim().replace(/\s+/g,' ');
}
function wordExists(text) {
  const k=normalizeWord(text);
  return window.words.some(w=>normalizeWord(w.word)===k);
}

function escapeHtml(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeClassToken(v) {
  return String(v ?? 'عام').replace(/[^\w\u0600-\u06FF-]/g, '_');
}

// ── Stats Panel ───────────────────────────────────────
function openStatsPanel() {
  const p=document.getElementById('statsPanel'); if(!p)return;
  p.style.display='flex'; setTimeout(()=>p.classList.add('show'),10);
  renderHeatmap(); renderStatsNumbers();
}
function closeStatsPanel() {
  const p=document.getElementById('statsPanel'); if(!p)return;
  p.classList.remove('show'); setTimeout(()=>p.style.display='none',300);
}
function renderHeatmap() {
  const container=document.getElementById('heatmapGrid'); if(!container)return;
  const map  =loadJSON('activityMap',{});
  const today=new Date(); const days=365;
  const start=new Date(today); start.setDate(start.getDate()-days+1);
  const vals =Object.values(map).filter(v=>v>0);
  const maxV =vals.length?Math.max(...vals):1;
  container.innerHTML='';
  const frag=document.createDocumentFragment();
  for(let i=0;i<days;i++){
    const d=new Date(start); d.setDate(d.getDate()+i);
    const key=d.toISOString().slice(0,10);
    const cnt=map[key]||0;
    const cell=document.createElement('div'); cell.className='hm-cell';
    // level 0 = no activity, 1-4 = intensity
    cell.dataset.level = cnt===0 ? 0 : Math.ceil((cnt/maxV)*4);
    cell.title=key+' — '+cnt+' كلمة';
    frag.appendChild(cell);
  }
  container.appendChild(frag);
}
function renderStatsNumbers() {
  const map =loadJSON('activityMap',{});
  const vals=Object.values(map).filter(v=>v>0);
  const s=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};
  s('statTotal',   window.words.length);
  s('statStreak',  dailyStreak+' يوم');
  s('statStarred', window.words.filter(w=>w.starred).length);
  s('statForgot',  window.words.filter(w=>(w.forgetCount||0)>0).length);
  s('statDays',    Object.keys(map).filter(k=>map[k]>0).length+' يوم');
  s('statBest',    (vals.length?Math.max(...vals):0)+' كلمات');
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

  if (!w || !m) { showToast("عبّي الكلمة ومعناها يا بطل!"); return; }

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
    // Spam: max 30 words per minute
    if (!rateLimit('addWord', 30, 60000)) { btn.disabled=false; return; }
    if (wordExists(w)) { showToast('هذه الكلمة موجودة بالفعل في قاموسك!'); btn.disabled=false; return; }
    const xpGain  = 3;
    const newWord = { id:Date.now().toString(), word:w, meaning:m, example:ex, category:c, starred:false, forgetCount:0, xpValue:xpGain };
    window.words.unshift(newWord);
    if (window.saveWordToCloud) {
      const realId = await window.saveWordToCloud(w, c, m, ex);
      if (realId) newWord.id = realId;
    }
    const isCombo = checkCombo();
    const gained  = isCombo ? xpGain * 2 : xpGain;
    if (isCombo) setTimeout(()=>showToast('COMBO! Double XP! +'+gained+' XP'),100);
    updateXP(gained);
    showXPBadge(gained, 'addBtn', false);
    checkAndUpdateStreak();
    incrementDailyCount();
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
  // Switch to personal dictionary view if not already there (inputs are there)
  if (currentView !== 'personal') loadPersonalDictionary();
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
 // ── تحذير خسارة XP ──
  const wordObj = window.words.find(w => w.id === id);
  const xpLoss  = wordObj?.xpValue || 0;
  const modalBody = document.querySelector('#deleteModal .modal-content');
  let warnEl = modalBody?.querySelector('.xp-delete-warn');
  if (xpLoss > 0 && modalBody) {
    if (!warnEl) {
      warnEl = document.createElement('div');
      warnEl.className = 'xp-delete-warn';
      modalBody.querySelector('p').after(warnEl);
    }
    warnEl.textContent = '⚠️ ستخسر -' + xpLoss + ' XP عند الحذف';
  } else if (warnEl) warnEl.remove();

  document.getElementById('deleteConfirmBtn').onclick = async function() {
    hideModal('deleteModal');
    if (xpLoss > 0) { updateXP(-xpLoss); showXPBadge(xpLoss, null, true); }
    window.words = window.words.filter(w => w.id !== pendingDeleteId);
    if (window.deleteWordFromCloud) await window.deleteWordFromCloud(pendingDeleteId);
    pendingDeleteId = null;
    document.querySelector('#deleteModal .xp-delete-warn')?.remove();
    saveAndRender();
    if (currentView === 'starred') renderStarredWords();
  };
  const cBtn = document.getElementById('deleteCancelBtn');
  if (cBtn) cBtn.onclick = () => { hideModal('deleteModal'); document.querySelector('#deleteModal .xp-delete-warn')?.remove(); };
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
  if (currentView === 'starred') renderStarredWords();
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
  if (!word) { showToast("اكتب الكلمة أولاً!"); return; }
  // Spam protection: max 5 requests per 30 seconds
  if (!rateLimit('fetchSuggestions', 5, 30000)) return;

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
      const arEsc   = escapeHtml(s.ar || '');
      const posEsc  = escapeHtml(s.pos || 'عام');
      const stars   = Math.max(1, Math.min(5, Number(s.stars) || 1));
      const exEsc   = escapeHtml(s.ex || '');
      html += `
        <div class="sug-item ${i >= 4 ? 'extra-meaning' : ''}" ${i >= 4 ? 'style="display:none"' : ''}
             onclick="selectSuggestion('${safeAr}','${safePos}','${safeEx}')">
          <div class="sug-main">
            <span class="sug-ar">${arEsc}</span>
            <span class="sug-pos">${posEsc}</span>
          </div>
          <div class="sug-stars">${'★'.repeat(stars)}${'☆'.repeat(5-stars)}</div>
          ${s.ex ? `<div class="sug-ex">"${exEsc}"</div>` : ''}
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
  document.getElementById('toolAll').classList.toggle('active-tool', f === 'all');
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
        showToast("تم الاستيراد والرفع للسحابة");
      } else {
        showToast("تم الاستيراد");
      }
    } catch { showToast("خطأ في الملف، تأكد إنه JSON صحيح."); }
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
const viewScrollY = { personal: 0, minecraft: 0, pubg: 0, starred: 0, quiz: 0 };

function saveCurrentViewScroll() {
  viewScrollY[currentView] = window.scrollY || window.pageYOffset || 0;
}

function restoreViewScroll(viewKey) {
  const targetY = viewScrollY[viewKey] || 0;
  requestAnimationFrame(() => {
    window.scrollTo({ top: targetY, behavior: 'auto' });
  });
}

window.loadGameDictionary = function(gameKey) {
  beginViewSwitch();
  saveCurrentViewScroll();
  closeSidebarIfOpen();
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
  document.getElementById('starredSearchBar').style.display = 'none';
  document.getElementById('quizView').style.display         = 'none';
  document.getElementById('list').style.display             = '';

  // إظهار search bar الألعاب وتفريغه
  const gameSearch = document.getElementById('gameSearchBar');
  gameSearch.style.display = 'block';
  gameSearch.querySelector('input').value = '';

  // تحديث العنوان
  document.querySelector('.page-header h1').innerHTML =
    `<img src="${game.titleIcon}" width="24" height="24" style="vertical-align:middle;margin-left:6px;" alt=""> ${game.title}`;
  document.getElementById('totalCount').innerText = game.desc;

  renderGameWords(currentGameWords);
  restoreViewScroll(gameKey);
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
        const dispText    = query ? hlGame(w.text, query)    : escapeHtml(w.text);
        const dispMeaning = query ? hlGame(w.meaning, query) : escapeHtml(w.meaning);
        const exEsc = escapeHtml(w.example || '');
        return `
          <li class="game-card">
            <div class="game-info">
              <img src="${escapeHtml(w.img)}" class="game-icon" alt="${escapeHtml(w.text)}"
                   onerror="this.src='https://cdn-icons-png.flaticon.com/512/686/686589.png'">
              <div>
                <div class="word-text">${dispText}</div>
                <div class="meaning-text">${dispMeaning}</div>
                ${w.example ? `<div class="game-example">"${exEsc}"</div>` : ''}
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
                <button class="btn-add-mine ${wordExists(w.text)?' btn-already-added':''}"
                        onclick="addFromGame('${safeWord}','${safeMeaning}','${safeExample}',this)"
                        ${wordExists(w.text)?'disabled':''}>
                  ${wordExists(w.text)?'✓':'➕'}
                </button>
                <span class="tooltip-text">${wordExists(w.text)?'موجودة في قاموسك':'أضف للقاموس'}</span>
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

// ── Hide all non-personal view elements ──
function hideAllViewElements() {
  document.getElementById('personalControls').style.display = 'none';
  document.querySelector('.toolbar').style.display          = 'none';
  document.getElementById('searchInput').style.display      = 'none';
  document.getElementById('searchFilter').style.display     = 'none';
  document.querySelector('.backup-zone').style.display      = 'none';
  document.getElementById('starredCount').style.display     = 'none';
  document.getElementById('gameSearchBar').style.display    = 'none';
  document.getElementById('starredSearchBar').style.display = 'none';
  document.getElementById('quizView').style.display         = 'none';
  document.getElementById('list').style.display             = 'none';
}

// ── Starred Words View ──
window.loadStarredView = function() {
  beginViewSwitch();
  saveCurrentViewScroll();
  closeSidebarIfOpen();
  currentView = 'starred';

  setActiveNavLink('starred');

  // Remove game background
  document.body.classList.remove('game-bg-active');
  document.body.removeAttribute('data-game');

  // Hide personal controls, show only starred-relevant elements
  hideAllViewElements();
  document.getElementById('starredSearchBar').style.display = 'block';
  document.getElementById('starredSearchInput').value = '';
  document.getElementById('list').style.display = '';

  // Update header
  document.querySelector('.page-header h1').innerHTML = '<i class="fas fa-star" aria-hidden="true"></i> الكلمات الصعبة';
  const starredWords = window.words.filter(w => w.starred);
  document.getElementById('totalCount').innerText = `${starredWords.length} كلمة صعبة`;

  renderStarredWords();
  restoreViewScroll('starred');
};

function renderStarredWords() {
  const query = (document.getElementById('starredSearchInput')?.value || '').toLowerCase().trim();
  let starred = window.words.filter(w => w.starred);

  if (query) {
    starred = starred.filter(w =>
      w.word.toLowerCase().includes(query) ||
      (w.meaning || '').toLowerCase().includes(query)
    );
    starred.sort((a, b) => {
      const aStarts = a.word.toLowerCase().startsWith(query);
      const bStarts = b.word.toLowerCase().startsWith(query);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      return a.word.localeCompare(b.word);
    });
  }

  const listEl = document.getElementById('list');
  if (!listEl) return;

  if (starred.length === 0) {
    listEl.innerHTML = `
      <li style="list-style:none;text-align:center;padding:40px 20px;color:var(--text-gray);">
        <div style="font-size:32px;margin-bottom:10px;"><i class="fas fa-star" aria-hidden="true"></i></div>
        ${query ? 'ما في نتائج للبحث' : 'ما عندك كلمات صعبة بعد!'}
      </li>`;
    return;
  }

  listEl.innerHTML = starred.map(w => {
    const safeId = w.id.replace(/'/g, "\\'");
    const dispWord   = query ? highlightText(w.word, query) : escapeHtml(w.word);
    const dispMeaning = query ? highlightText(w.meaning, query) : escapeHtml(w.meaning);
    return `
      <li class="word-card" onclick="this.classList.toggle('show-example')">
        <div class="word-body" style="flex:1;min-width:0;">
          <div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:4px;">
            <button class="star-btn active" onclick="toggleStar('${safeId}',event)">
              <i class="fas fa-star"></i>
            </button>
            <div>
              <div class="word-text">
                ${dispWord}
                <span class="cat-tag tag-${safeClassToken(w.category)}">${escapeHtml(w.category)}</span>
              </div>
              <div class="meaning-text">${dispMeaning}</div>
            </div>
          </div>
          ${w.example ? `<div class="example-box"><b>Ex:</b> ${highlightText(w.example, query)}</div>` : ''}
        </div>
        <div class="actions">
          <button class="icon-circle sound-btn" onclick="playSound('${safeId}',event)"><i class="fas fa-volume-up"></i></button>
          <button class="icon-circle edit-btn"  onclick="editWord('${safeId}',event)"><i class="fas fa-edit"></i></button>
          <button class="icon-circle del-btn"   onclick="deleteWord('${safeId}',event)"><i class="fas fa-trash-alt"></i></button>
        </div>
      </li>`;
  }).join('');
}

// ── Quiz Full-Page View ──
window.loadQuizView = function() {
  beginViewSwitch();
  saveCurrentViewScroll();
  closeSidebarIfOpen();
  currentView = 'quiz';

  setActiveNavLink('quiz');

  // Remove game background
  document.body.classList.remove('game-bg-active');
  document.body.removeAttribute('data-game');

  // Hide personal controls, show only quiz view
  hideAllViewElements();
  document.getElementById('quizView').style.display = 'block';
  document.getElementById('quizViewSetup').style.display = 'block';
  document.getElementById('quizViewCard').style.display = 'none';

  // Update header
  document.querySelector('.page-header h1').innerHTML = '<i class="fas fa-gamepad" aria-hidden="true"></i> الاختبار';
  document.getElementById('totalCount').innerText = window.words.length > 0
    ? `${window.words.length} كلمة متاحة`
    : 'القاموس فاضي!';

  restoreViewScroll('quiz');
};

window.loadPersonalDictionary = function() {
  beginViewSwitch();
  saveCurrentViewScroll();
  closeSidebarIfOpen();
  currentView = 'personal';
  // لو كان فلتر الصعبة مفعّل — يرجع للكل
  if (currentFilter !== 'all') {
    currentFilter = 'all';
    const toolAll = document.getElementById('toolAll');
    if (toolAll)  toolAll.classList.add('active-tool');
  }

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
  document.getElementById('list').style.display             = '';

  // إخفاء search bar الألعاب والكلمات الصعبة والكويز
  document.getElementById('gameSearchBar').style.display    = 'none';
  document.getElementById('starredSearchBar').style.display = 'none';
  document.getElementById('quizView').style.display         = 'none';

  document.querySelector('.page-header h1').innerHTML = '<i class="fa-solid fa-sword" aria-hidden="true"></i> قاموسك الشخصي';
  setActiveNavLink('personal');
  render();
  restoreViewScroll('personal');
};

window.addFromGame = async function(text, meaning, example, btnEl) {
  const xpGain = 3;
  // تحقق من التكرار
  if (wordExists(text)) {
    showToast('هذه الكلمة موجودة بالفعل في قاموسك');
    if (btnEl) { btnEl.textContent='✓'; btnEl.disabled=true; btnEl.classList.add('btn-already-added'); }
    return;
  }
  // Spam protection
  if (!rateLimit('addFromGame', 10, 30000)) return;

  if (btnEl) { btnEl.textContent='...'; btnEl.disabled=true; }

  if (window.saveWordToCloud) {
    const realId = await window.saveWordToCloud(text, 'لعبة', meaning, example||'');
    if (realId) {
      window.words.unshift({id:realId,word:text,meaning,example:example||'',category:'لعبة',starred:false,forgetCount:0,xpValue:xpGain});
      showToast('تمت الإضافة لقاموسك');
      updateXP(xpGain); showXPBadge(xpGain,null,false);
      checkAndUpdateStreak(); incrementDailyCount();
      if (btnEl) { btnEl.textContent='✓'; btnEl.classList.add('btn-already-added'); }
    } else {
      showToast('سجل دخول أولاً عشان تحفظ اللوت');
      if (btnEl) { btnEl.textContent='➕'; btnEl.disabled=false; }
    }
  } else {
    const nw={id:Date.now().toString(),word:text,meaning,example:example||'',category:'لعبة',starred:false,forgetCount:0,xpValue:xpGain};
    window.words.unshift(nw);
    saveAndRender();
    showToast('تمت الإضافة للقاموس المحلي');
    updateXP(xpGain); showXPBadge(xpGain,null,false);
    checkAndUpdateStreak(); incrementDailyCount();
    if (btnEl) { btnEl.textContent='✓'; btnEl.classList.add('btn-already-added'); }
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
  if (starEl)  starEl.innerText  = `الصعبة: ${window.words.filter(w => w.starred).length}`;

  const listEl = document.getElementById('list');
  if (!listEl) return;

  if (filtered.length === 0) {
    listEl.innerHTML = `
      <li style="list-style:none;text-align:center;padding:40px 20px;color:var(--text-gray);">
        <div style="font-size:32px;margin-bottom:10px;"><i class="fa-solid fa-book-open" aria-hidden="true"></i></div>
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
                <span class="cat-tag tag-${safeClassToken(w.category)}">${escapeHtml(w.category)}</span>
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
  if (!window.words.length) { showToast("القاموس فاضي!"); return; }
  loadQuizView();
}

function closeQuizSetup() {
  // Return to quiz view setup screen
  document.getElementById('quizViewSetup').style.display = 'block';
  document.getElementById('quizViewCard').style.display = 'none';
}

function startActualQuiz(mode) {
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
      showToast("ما عندك كلمات بتغلط فيها. رح نختبرك عشوائياً.");
      words = [...window.words].sort(() => Math.random()-0.5).slice(0, 10);
    } else words = words.slice(0, 10);
  } else if (mode === 'starred') {
    words = words.filter(w => w.starred);
    if (!words.length) { showToast("ما عندك كلمات صعبة. رح نختبرك بالكل."); words = [...window.words]; }
  } else {
    words.sort(() => Math.random()-0.5);
  }

  currentQuizWords = words;
  quizIndex = 0;
  currentStreak = 0;

  // Show quiz card, hide setup
  document.getElementById('quizViewSetup').style.display = 'none';
  document.getElementById('quizViewCard').style.display = 'block';
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
  // Return to quiz setup screen
  document.getElementById('quizViewSetup').style.display = 'block';
  document.getElementById('quizViewCard').style.display = 'none';
}

function showStreakMsg(streak) {
  const msgs = { 3: "3 صح ورا بعض!", 5: "5 صح! أسطورة!", 7: "7 ورا بعض!", 10: "10! أنت الأفضل!" };
  if (msgs[streak]) showToast(msgs[streak]);
}

function markRemember() {
  const w = currentQuizWords[quizIndex];
  if (!w) return;
  const prevForget = w.forgetCount || 0;
  const nextForget = Math.max(prevForget - 1, 0);
  window.words = window.words.map(x =>
    x.id === w.id ? { ...x, forgetCount: nextForget } : x
  );
  currentQuizWords[quizIndex] = { ...w, forgetCount: nextForget };
  localStorage.setItem('lootlinguaDict', JSON.stringify(window.words));
  // ← حفظ forgetCount في Firestore
  if (window.updateWordInCloud) window.updateWordInCloud(w.id, { forgetCount: nextForget });
  currentStreak++;
  showStreakMsg(currentStreak);
  const fc = prevForget;
  const xpGain = fc >= 3 ? 3 : fc >= 1 ? 2 : 1;
  updateXP(xpGain);
  showXPBadge(xpGain, null, false);
  if (quizIndex < currentQuizWords.length - 1) { quizIndex++; updateCard(); }
  else { showToast('أبدعت! 👏'); setTimeout(closeQuiz, 600); }
}

function markForgot() {
  currentStreak = 0;
  const w = currentQuizWords[quizIndex];
  if (!w) return;
  const prevForget = w.forgetCount || 0;
  const nextForget = prevForget + 1;
  window.words = window.words.map(x =>
    x.id === w.id ? { ...x, forgetCount: nextForget } : x
  );
  const updatedWord = { ...w, forgetCount: nextForget };
  currentQuizWords[quizIndex] = updatedWord;
  localStorage.setItem('lootlinguaDict', JSON.stringify(window.words));
  // ← حفظ forgetCount في Firestore
  if (window.updateWordInCloud) window.updateWordInCloud(w.id, { forgetCount: nextForget });
  const gap = Math.max(2, Math.min(5-nextForget, 4));
  currentQuizWords.splice(Math.min(quizIndex+gap, currentQuizWords.length), 0, {...updatedWord});
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
  // Gamification init
  // checkAndUpdateStreak يشتغل هنا فقط لو مش مسجل دخول
  // لو مسجل دخول، يشتغل بعد loadProfileFromCloud (في index.html)
  renderXPBar();
  renderDailyGoal();
  renderStreak();
  render();
  // استدعيها بعد تأخير 0 عشان تعطي Firebase فرصة
  // لو المستخدم مش مسجل دخول، ستشتغل مباشرة
  setTimeout(() => {
    if (!window._profileLoaded) checkAndUpdateStreak();
  }, 1200);
};
