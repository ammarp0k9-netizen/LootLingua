// ═══════════════════════════════════════════════════════
// إشعارات عصرية
// ═══════════════════════════════════════════════════════
window.__notifications = [];

function pushNotification(msg, type = 'info', meta = {}) {
  const now = Date.now();
  const existing = window.__notifications.find(n => n.msg === msg && n.type === type);
  if (existing) {
    existing.count = (existing.count || 1) + 1;
    existing.time = now;
    existing.read = false;
    window.__notifications = [
      existing,
      ...window.__notifications.filter(n => n.id !== existing.id),
    ];
  } else {
    window.__notifications.unshift({
      msg,
      type,
      meta,
      time: now,
      count: 1,
      read: false,
      id: now + '_' + Math.random().toString(36).slice(2),
    });
  }
  updateNotificationsBadge();
  renderNotificationsPanel();
}

function getUnreadNotifCount() {
  return window.__notifications
    .filter(n => !n.read)
    .reduce((sum, n) => sum + (n.count || 1), 0);
}

function updateNotificationsBadge() {
  const badge = document.getElementById('notifBadge');
  if (!badge) return;
  const count = getUnreadNotifCount();
  badge.textContent = count;
  badge.style.opacity = count > 0 ? '1' : '0';
  badge.style.display = count > 0 ? 'inline-block' : 'none';
}

function renderNotificationsPanel() {
  const panel = document.getElementById('notificationsPanel');
  const list = document.getElementById('notificationsList');
  const clearBtn = document.getElementById('notifClearAllBtn');
  if (!panel || !list) return;
  if (clearBtn) clearBtn.style.display = window.__notifications.length > 0 ? 'inline-flex' : 'none';
  list.innerHTML = window.__notifications.length === 0
    ? '<li class="notif-empty">لا يوجد إشعارات بعد.</li>'
    : window.__notifications.map(n => {
      const icon = n.type === 'success' ? 'fa-circle-check' : n.type === 'danger' ? 'fa-circle-xmark' : n.type === 'warning' ? 'fa-triangle-exclamation' : 'fa-circle-info';
      const countBadge = (n.count || 1) > 1
        ? `<span class="notif-stack-count" aria-label="${n.count} إشعارات مماثلة">${n.count}</span>`
        : '';
      return `<li class="notif-item notif-${n.type}"><span class="notif-item-icon"><i class="fa-solid ${icon}" aria-hidden="true"></i></span><span class="notif-msg">${escapeHtml(n.msg)}${countBadge}</span><span class="notif-time">${formatNotifTime(n.time)}</span></li>`;
    }).join('');
}

window.clearAllNotifications = function(ev) {
  if (ev) ev.stopPropagation();
  window.__notifications = [];
  updateNotificationsBadge();
  renderNotificationsPanel();
};

function formatNotifTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
}

function positionNotifPopover() {
  const panel = document.getElementById('notificationsPanel');
  const btn = document.getElementById('notifBtn');
  if (!panel || !btn || !panel.classList.contains('open')) return;
  if (window.matchMedia('(max-width: 768px)').matches) {
    panel.style.position = 'fixed';
    panel.style.top = 'calc(var(--legend-top-h, 52px) + env(safe-area-inset-top, 0px) + 14px)';
    panel.style.right = '12px';
    panel.style.left = '12px';
    panel.style.width = 'auto';
    panel.style.transform = 'translateY(0) scale(1)';
    return;
  }
  panel.style.position = '';
  panel.style.top = '';
  panel.style.right = '';
  panel.style.left = '';
  panel.style.width = '';
  panel.style.transform = '';
}

function toggleNotificationsPanel(ev) {
  if (ev) ev.stopPropagation();
  const panel = document.getElementById('notificationsPanel');
  const btn = document.getElementById('notifBtn');
  const hub = document.getElementById('notifHub');
  if (!panel) return;
  const opening = !panel.classList.contains('open');
  if (opening) closeDailyQuestsSheet(true);
  panel.classList.toggle('open', opening);
  panel.style.display = opening ? 'block' : 'none';
  btn?.setAttribute('aria-expanded', opening ? 'true' : 'false');
  hub?.classList.toggle('notif-open', opening);
  if (opening) {
    window.__notifications.forEach(n => n.read = true);
    updateNotificationsBadge();
    renderNotificationsPanel();
    requestAnimationFrame(positionNotifPopover);
  }
}

window.addEventListener('resize', () => {
  if (document.getElementById('notificationsPanel')?.classList.contains('open')) positionNotifPopover();
});

function closeNotificationsPanel() {
  const panel = document.getElementById('notificationsPanel');
  const btn = document.getElementById('notifBtn');
  const hub = document.getElementById('notifHub');
  if (!panel) return;
  panel.classList.remove('open');
  panel.style.display = 'none';
  panel.style.position = '';
  panel.style.top = '';
  panel.style.right = '';
  panel.style.left = '';
  panel.style.width = '';
  panel.style.transform = '';
  btn?.setAttribute('aria-expanded', 'false');
  hub?.classList.remove('notif-open');
}

document.addEventListener('click', (e) => {
  const hub = document.getElementById('notifHub');
  if (!hub?.classList.contains('notif-open')) return;
  if (hub.contains(e.target)) return;
  closeNotificationsPanel();
});

// ═══════════════════════════════════════════════════════
// Profile modal (Hero avatar)
// ═══════════════════════════════════════════════════════
window.toggleProfileModal = function() {
  const modal = document.getElementById('profileModal');
  if (!modal) return;
  const open = !modal.classList.contains('open');
  modal.classList.toggle('open', open);
  modal.setAttribute('aria-hidden', open ? 'false' : 'true');
  document.body.classList.toggle('profile-modal-open', open);
  if (open) {
    syncHeroAvatar();
    renderProfileModalStats();
    renderXPBar();
    refreshFeatureUnlockUI();
    closeSidebarIfOpen();
  }
};

window.closeProfileModal = function() {
  const modal = document.getElementById('profileModal');
  if (!modal) return;
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('profile-modal-open');
};

function syncHeroAvatar() {
  const rank = getRank(userXP);
  const letterEl = document.getElementById('heroAvatarLetter');
  const iconEl = document.getElementById('heroAvatarIcon');
  const levelEl = document.getElementById('heroLevelBadge');
  const xpMini = document.getElementById('heroXpMini');
  const profileAv = document.getElementById('profileModalAvatar');
  const name = (typeof getProfileDisplayName === 'function') ? getProfileDisplayName() : '';
  const initial = name ? name.trim().charAt(0).toUpperCase() : '';
  if (letterEl) {
    if (initial) {
      letterEl.textContent = initial;
      letterEl.style.display = 'grid';
      if (iconEl) iconEl.style.display = 'none';
    } else {
      letterEl.style.display = 'none';
      if (iconEl) iconEl.style.display = '';
    }
  }
  if (levelEl) { levelEl.textContent = rank.label; levelEl.style.color = rank.color; }
  if (xpMini) xpMini.textContent = userXP + ' XP';
  if (profileAv) {
    profileAv.innerHTML = initial
      ? `<span class="hero-avatar-letter">${initial}</span>`
      : '<i class="fa-solid fa-user"></i>';
  }
}

function getProfileDisplayName() {
  return localStorage.getItem('lootlinguaDisplayName') || '';
}

window.setLootlinguaDisplayName = function(name) {
  if (name) localStorage.setItem('lootlinguaDisplayName', name);
  syncHeroAvatar();
};

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (document.getElementById('profileModal')?.classList.contains('open')) closeProfileModal();
  else if (document.getElementById('dailyQuestsSheet')?.classList.contains('open')) closeDailyQuestsSheet();
  else closeNotificationsPanel();
});

function renderProfileModalStats() {
  const wordsEl = document.getElementById('profileStatWords');
  const streakEl = document.getElementById('profileStatStreak');
  if (wordsEl) wordsEl.textContent = (window.words || []).length;
  if (streakEl) streakEl.textContent = loadInt('lootlinguaMaxStreak', dailyStreak) + ' يوم';
}

// ═══════════════════════════════════════════════════════
// Daily quests
// ═══════════════════════════════════════════════════════
const DAILY_QUEST_DEFS = [
  { id: 'add3', label: 'أضف 3 كلمات جديدة', reward: 10, icon: 'fa-plus' },
  { id: 'perfectQuiz', label: 'حل كويز بدون أخطاء', reward: 20, icon: 'fa-brain' },
  { id: 'openLoot', label: 'افتح صندوق اللوت اليومي', reward: 0, icon: 'fa-box-open' },
];

function getDailyQuestState() {
  const key = 'lootlinguaDailyQuests_' + todayStr();
  return loadJSON(key, { claimed: {}, flags: {} });
}

function saveDailyQuestState(state) {
  saveJSON('lootlinguaDailyQuests_' + todayStr(), state);
}

function isDailyQuestDone(id) {
  const s = getDailyQuestState();
  if (id === 'add3') return getDailyCount() >= 3;
  if (id === 'perfectQuiz') return Boolean(s.flags.perfectQuiz);
  if (id === 'openLoot') return Boolean(s.flags.openLoot);
  return false;
}

function markDailyQuestFlag(flag) {
  const s = getDailyQuestState();
  s.flags[flag] = true;
  saveDailyQuestState(s);
  updateDailyQuestsBadge();
  if (document.getElementById('dailyQuestsSheet')?.classList.contains('open')) renderDailyQuests();
}

function claimDailyQuest(id) {
  const def = DAILY_QUEST_DEFS.find(q => q.id === id);
  if (!def || !isDailyQuestDone(id)) return;
  const s = getDailyQuestState();
  if (s.claimed[id]) return;
  s.claimed[id] = true;
  saveDailyQuestState(s);
  if (def.reward > 0) {
    updateXP(def.reward);
    showXPBadge(def.reward, null, false);
    showToast('مهمة مكتملة! +' + def.reward + ' XP', 'success');
  } else {
    showToast('مهمة مكتملة!', 'success');
  }
  updateDailyQuestsBadge();
  if (document.getElementById('dailyQuestsSheet')?.classList.contains('open')) renderDailyQuests();
}

window.toggleDailyQuestsSheet = function() {
  const sheet = document.getElementById('dailyQuestsSheet');
  const backdrop = document.getElementById('dailyQuestsBackdrop');
  const btn = document.getElementById('dailyQuestsBtn');
  if (!sheet) return;
  const opening = !sheet.classList.contains('open');
  if (opening) closeNotificationsPanel();
  sheet.classList.toggle('open', opening);
  backdrop?.classList.toggle('open', opening);
  sheet.setAttribute('aria-hidden', opening ? 'false' : 'true');
  btn?.setAttribute('aria-expanded', opening ? 'true' : 'false');
  document.body.classList.toggle('daily-quests-open', opening);
  if (opening) renderDailyQuests();
};

window.closeDailyQuestsSheet = function(silent) {
  const sheet = document.getElementById('dailyQuestsSheet');
  const backdrop = document.getElementById('dailyQuestsBackdrop');
  const btn = document.getElementById('dailyQuestsBtn');
  if (!sheet) return;
  sheet.classList.remove('open');
  backdrop?.classList.remove('open');
  sheet.setAttribute('aria-hidden', 'true');
  btn?.setAttribute('aria-expanded', 'false');
  document.body.classList.remove('daily-quests-open');
};

function updateDailyQuestsBadge() {
  const badge = document.getElementById('dailyQuestsBadge');
  if (!badge) return;
  const done = DAILY_QUEST_DEFS.filter(q => isDailyQuestDone(q.id)).length;
  badge.textContent = done + '/' + DAILY_QUEST_DEFS.length;
  const btn = document.getElementById('dailyQuestsBtn');
  if (btn) btn.classList.toggle('has-pending', done < DAILY_QUEST_DEFS.length);
}

function renderDailyQuests() {
  const list = document.getElementById('dailyQuestsList');
  if (!list) return;
  updateDailyQuestsBadge();
  const state = getDailyQuestState();
  list.innerHTML = DAILY_QUEST_DEFS.map(q => {
    const done = isDailyQuestDone(q.id);
    const claimed = Boolean(state.claimed[q.id]);
    const rewardTxt = q.reward > 0 ? '+' + q.reward + ' XP' : '✓';
    return `<li class="daily-quest-item${done ? ' done' : ''}" data-quest="${q.id}">
      <span class="daily-quest-check">${done ? '<i class="fa-solid fa-check"></i>' : ''}</span>
      <span class="daily-quest-text"><i class="fa-solid ${q.icon}"></i> ${q.label}</span>
      <span class="daily-quest-reward">${claimed ? 'تم' : rewardTxt}</span>
    </li>`;
  }).join('');
  list.querySelectorAll('.daily-quest-item.done').forEach(el => {
    const id = el.dataset.quest;
    const st = getDailyQuestState();
    if (!st.claimed[id]) {
      el.style.cursor = 'pointer';
      el.onclick = () => claimDailyQuest(id);
    }
  });
}

// ── زر الرجوع (عوالم ← كلمات صعبة / قواميس) ──
let viewBackTarget = 'worlds';

function setViewBackBar(visible, label) {
  const nav = document.getElementById('viewNavBar');
  const lbl = document.getElementById('viewBackLabel');
  if (!nav) return;
  nav.style.display = '';
  document.body.classList.toggle('view-has-back', Boolean(visible));
  nav.setAttribute('aria-hidden', visible ? 'false' : 'true');
  if (lbl && label) lbl.textContent = label;
}

window.goBackFromSubView = function() {
  if (viewBackTarget === 'worlds') loadWorldsView();
  else loadPersonalDictionary();
};

window.toggleSidebar = function() {
  if (typeof window.toggleProfileModal === 'function') window.toggleProfileModal();
};

// استبدال showToast ليضيف إشعار أيضاً
const __origShowToast = window.showToast;
window.showToast = function(msg, type = 'info', duration = 2500) {
  pushNotification(msg, type);
  return __origShowToast ? __origShowToast(msg, type, duration) : undefined;
};
// ═══════════════════════════════════════════════════════
// تفاعل بوب لعناصر الكنز على الهاتف
// ═══════════════════════════════════════════════════════
function enableTreasurePopTouch() {
  if (!window.matchMedia('(pointer: coarse)').matches) return;
  const HOLD_MS = 520;
  setTimeout(() => {
    document.querySelectorAll('.treasure-slot, #dailyLootChest').forEach(el => {
      if (el.__popTouchEnabled) return;
      el.__popTouchEnabled = true;
      let holdTimer = null;
      let activeTag = null;
      function clearPop() {
        el.classList.remove('pop-active');
        if (activeTag) { activeTag.classList.remove('show'); activeTag = null; }
      }
      el.addEventListener('touchstart', function() {
        clearTimeout(holdTimer);
        holdTimer = setTimeout(() => {
          el.classList.add('pop-active');
          activeTag = el.querySelector('.nametag, .treasure-nametag, .treasure-details');
          if (activeTag) activeTag.classList.add('show');
        }, HOLD_MS);
      }, { passive: true });
      el.addEventListener('touchend', () => { clearTimeout(holdTimer); setTimeout(clearPop, 140); }, { passive: true });
      el.addEventListener('touchcancel', () => { clearTimeout(holdTimer); clearPop(); }, { passive: true });
      el.addEventListener('touchmove', () => clearTimeout(holdTimer), { passive: true });
    });
  }, 800);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', enableTreasurePopTouch);
} else {
  enableTreasurePopTouch();
}
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
let dailyStreak      = loadInt('dailyStreak', 0);
let lastActivity     = localStorage.getItem('lastActivityDate') || '';
let currentView      = 'personal'; // 'personal' | 'worlds' | 'minecraft' | 'pubg' | 'starred' | 'quiz' | 'treasure'
let renderLimit      = 20;  // عدد الكلمات التي تظهر في البداية
let currentQuizMistakes = 0;

// ── MOBILE LONG-PRESS TOOLTIP (تفويض — يعمل مع الكروت المُعاد رسمها) ──
(function initTouchTooltips() {
  const coarse = window.matchMedia('(pointer: coarse)');
  if (!coarse.matches) return;

  const LONG_MS = 520;
  const SKIP_SEL = '.sidebar-legacy-hidden, .legend-top-bar, .legend-dock, .notif-hub, .sound-btn, .edit-btn, .del-btn, .btn-audio, .btn-edit, .btn-delete';
  let pressTimer = null;
  let activeTipEl = null;
  let activeTooltipText = null;

  function clearTip() {
    if (activeTipEl) {
      activeTipEl.classList.remove('tip-show');
      activeTipEl = null;
    }
    if (activeTooltipText) {
      activeTooltipText.classList.remove('show');
      activeTooltipText = null;
    }
  }

  document.addEventListener('touchstart', (e) => {
    if (e.target.closest(SKIP_SEL)) return;
    const wrap = e.target.closest('.tooltip-wrap');
    const tipEl = e.target.closest('[data-tip]');
    if (!wrap && !tipEl) return;
    if ((tipEl || wrap)?.closest('.sidebar-legacy-hidden, .legend-top-bar, .legend-dock, .notif-hub')) return;

    clearTimeout(pressTimer);
    const target = tipEl || wrap;
    pressTimer = setTimeout(() => {
      clearTip();
      if (wrap) {
        activeTooltipText = wrap.querySelector('.tooltip-text');
        if (activeTooltipText) activeTooltipText.classList.add('show');
      } else if (tipEl) {
        activeTipEl = tipEl;
        tipEl.classList.add('tip-show');
      }
      if (navigator.vibrate) try { navigator.vibrate(8); } catch (_) {}
    }, LONG_MS);
  }, { passive: true });

  document.addEventListener('touchend', () => {
    clearTimeout(pressTimer);
    setTimeout(clearTip, 140);
  }, { passive: true });
  document.addEventListener('touchcancel', () => {
    clearTimeout(pressTimer);
    clearTip();
  }, { passive: true });
  document.addEventListener('touchmove', () => clearTimeout(pressTimer), { passive: true });
})();

// ── تسميات الـ dock: ضغط مطوّل فقط على اللمس ──
(function initDockLongPressLabels() {
  if (!window.matchMedia('(pointer: coarse)').matches) return;
  const HOLD_MS = 520;
  let dockTimer = null;
  let dockTipBtn = null;

  function clearDockTip() {
    if (dockTipBtn) {
      dockTipBtn.classList.remove('dock-tip-show');
      dockTipBtn = null;
    }
  }

  document.addEventListener('touchstart', (e) => {
    const btn = e.target.closest('.treasure-dock-btn');
    if (!btn) return;
    clearTimeout(dockTimer);
    dockTimer = setTimeout(() => {
      clearDockTip();
      dockTipBtn = btn;
      btn.classList.add('dock-tip-show');
      if (navigator.vibrate) try { navigator.vibrate(8); } catch (_) {}
    }, HOLD_MS);
  }, { passive: true });
  document.addEventListener('touchend', () => {
    clearTimeout(dockTimer);
    setTimeout(clearDockTip, 160);
  }, { passive: true });
  document.addEventListener('touchcancel', () => {
    clearTimeout(dockTimer);
    clearDockTip();
  }, { passive: true });
  document.addEventListener('touchmove', () => clearTimeout(dockTimer), { passive: true });
})();

// Global variables for scroll lock during onboarding
let mainContentScrollArea = null;
let originalMainContentScrollAreaOverflow = '';

function setActiveNavLink(key) {
  // key: 'personal' | 'minecraft' | 'pubg'
  document.querySelectorAll('.nav-link[data-view]').forEach(l => {
    l.classList.toggle('active', l.dataset.view === key);
  });
}

// ═══════════════════════════════════════════════════════
// Feature unlocks — UI sync (rules: optional window.getUnlockedFeatures / window.unlockedFeatures)
// ═══════════════════════════════════════════════════════

function getUnlockProgressSnapshot() {
  const words = Array.isArray(window.words) ? window.words : [];
  return {
    wordCount: words.length,
    starredCount: words.filter(w => w.starred).length,
    userXP: loadInt('userXP', 0),
    userLevel: getLevelFromXP(loadInt('userXP', 0)),
    dailyStreak: loadInt('dailyStreak', 0),
    dailyAdded: typeof getDailyCount === 'function' ? getDailyCount() : 0,
  };
}

/** Default gates if host page does not define `getUnlockedFeatures` or `unlockedFeatures`. */
function computeDefaultUnlockedFeatures() {
  const p = getUnlockProgressSnapshot();
  const u = new Set(['personal', 'stats']);
  if (p.wordCount >= 1) u.add('starred');
  if (p.wordCount >= 2 || p.userXP >= 10) u.add('minecraft');
  if (p.wordCount >= 2 || p.userXP >= 10) u.add('pubg');
  if (p.wordCount >= 5) u.add('quiz');
  return u;
}

function resolveUnlockedFeatures() {
  if (typeof window.getUnlockedFeatures === 'function') {
    const r = window.getUnlockedFeatures();
    if (r instanceof Set) return r;
    if (Array.isArray(r)) return new Set(r);
  }
  if (window.unlockedFeatures instanceof Set) return window.unlockedFeatures;
  if (Array.isArray(window.unlockedFeatures)) return new Set(window.unlockedFeatures);
  return computeDefaultUnlockedFeatures();
}

function isFeatureUnlocked(featureId) {
  return resolveUnlockedFeatures().has(featureId);
}

const UNLOCK_EXPLAIN = {
  personal: {
    title: 'قاموسك الشخصي',
    why: 'هذه البداية الأساسية — متاحة دائماً.',
    how: 'لا يوجد شرط.',
    progress: () => '',
  },
  stats: {
    title: 'إحصائياتي',
    why: 'لوحة الإحصائيات متاحة لمتابعة تقدّمك.',
    how: 'لا يوجد شرط.',
    progress: () => '',
  },
  starred: {
    title: 'الكلمات الصعبة',
    why: 'نفعّل قائمة الكلمات الصعبة بعد ما يصير عندك كلمات تقدر تعلّم عليها نجمة.',
    how: 'أضف كلمة واحدة على الأقل إلى قاموسك.',
    progress: (p) => {
      const need = 1;
      const n = p.wordCount;
      return n >= need ? `تقدّمك: ${n} كلمة (تم استيفاء الشرط).` : `تقدّمك: ${n} من ${need} كلمة في القاموس.`;
    },
  },
  minecraft: {
    title: 'قاموس Minecraft',
    why: 'قاموس اللعبة يفتح بسرعة بعد شوية كلمات جديدة.',
    how: 'أضف 2 كلمة فقط إلى قاموسك، أو أوصل إلى 10 XP.',
    progress: (p) => {
      const ok = p.wordCount >= 2 || p.userXP >= 10;
      return ok
        ? `تقدّمك: ${p.wordCount} كلمة، ${p.userXP} XP (تم استيفاء أحد الشرطين).`
        : `تقدّمك: ${p.wordCount} من 2 كلمات، و${p.userXP} من 10 XP.`;
    },
  },
  pubg: {
    title: 'مصطلحات PUBG',
    why: 'قاموس PUBG يفتح بسرعة بعد شوية كلمات جديدة.',
    how: 'أضف 2 كلمة فقط إلى قاموسك، أو أوصل إلى 10 XP.',
    progress: (p) => {
      const ok = p.wordCount >= 2 || p.userXP >= 10;
      return ok
        ? `تقدّمك: ${p.wordCount} كلمة، ${p.userXP} XP (تم استيفاء أحد الشرطين).`
        : `تقدّمك: ${p.wordCount} من 2 كلمات، و${p.userXP} من 10 XP.`;
    },
  },
  quiz: {
    title: 'الاختبار',
    why: 'الاختبار يحتاج مجموعة كلمات كافية عشان يكون مفيد.',
    how: 'أضف 5 كلمات على الأقل إلى قاموسك.',
    progress: (p) => {
      const need = 5;
      return p.wordCount >= need
        ? `تقدّمك: ${p.wordCount} كلمة (تم استيفاء الشرط).`
        : `تقدّمك: ${p.wordCount} من ${need} كلمات في القاموس.`;
    },
  },
};

function openUnlockExplainModal(featureId) {
  const meta = UNLOCK_EXPLAIN[featureId] || {
    title: 'ميزة مقفلة',
    why: 'هذه الميزة غير متاحة حالياً.',
    how: 'تابع التعلّم وإضافة الكلمات لفتح المزيد.',
    progress: (p) => `XP: ${p.userXP} — كلمات القاموس: ${p.wordCount}`,
  };
  const snap = getUnlockProgressSnapshot();
  const tTitle = document.getElementById('unlockExplainTitle');
  const tWhy = document.getElementById('unlockExplainWhy');
  const tHow = document.getElementById('unlockExplainHow');
  const tPr = document.getElementById('unlockExplainProgress');
  if (tTitle) tTitle.textContent = meta.title;
  if (tWhy) tWhy.textContent = meta.why;
  if (tHow) tHow.textContent = meta.how;
  if (tPr) tPr.textContent = typeof meta.progress === 'function' ? meta.progress(snap) : (meta.progress || '');
  showModal('unlockExplainModal');
}

function handleLockedFeatureClick(featureId, fn, options = {}) {
  if (!isFeatureUnlocked(featureId)) {
    openUnlockExplainModal(featureId);
    return false;
  }
  if (options.closeSidebar && featureId !== 'personal') {
    if (typeof closeSidebarIfOpen === 'function') closeSidebarIfOpen();
  }
  if (typeof fn === 'function') fn();
  return true;
}

window.onSidebarFeatureClick = function(ev, featureId, fn) {
  if (ev) {
    ev.preventDefault();
    ev.stopPropagation();
  }
  handleLockedFeatureClick(featureId, fn, { closeSidebar: true });
  return false;
};

window.onWorldCardClick = function(ev, featureId, fn) {
  if (ev) {
    ev.preventDefault();
    ev.stopPropagation();
  }
  handleLockedFeatureClick(featureId, fn);
  return false;
};

window.onDockFeatureClick = function(ev, featureId, fn) {
  if (ev) {
    ev.preventDefault();
    ev.stopPropagation();
  }
  handleLockedFeatureClick(featureId, fn);
  return false;
};

function triggerUnlockPulseOnLink(link) {
  if (!link) return;
  link.classList.remove('unlock-pulse');
  void link.offsetWidth;
  const finish = () => {
    link.classList.remove('unlock-pulse');
  };
  const onEnd = (e) => {
    if (e.animationName !== 'unlockPulse') return;
    link.removeEventListener('animationend', onEnd);
    finish();
  };
  link.addEventListener('animationend', onEnd);
  link.classList.add('unlock-pulse');
  setTimeout(() => {
    link.removeEventListener('animationend', onEnd);
    finish();
  }, 520);
}

function playUnlockSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const gain = ctx.createGain();
    gain.gain.value = 0.08;
    gain.connect(ctx.destination);
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = 520;
    osc.connect(gain);
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.onended = () => { ctx.close().catch(() => {}); };
  } catch (e) {
    // Autoplay or audio failure is okay; fail silently.
  }
}

function syncNavLockUi() {
  const unlocked = resolveUnlockedFeatures();
  const currentLocks = {};
  document.querySelectorAll('.nav-link[data-feature]').forEach((link) => {
    const id = link.getAttribute('data-feature');
    if (id) currentLocks[id] = !unlocked.has(id);
  });

  const prev = window.__navLockPrev;
  const pulseIds = [];
  if (window.__navLockAnimSeeded && prev) {
    for (const id of Object.keys(currentLocks)) {
      if (prev[id] === true && currentLocks[id] === false) pulseIds.push(id);
    }
  }
  if (!window.__navLockAnimSeeded) window.__navLockAnimSeeded = true;

  document.querySelectorAll('.nav-link[data-feature]').forEach((link) => {
    const id = link.getAttribute('data-feature');
    if (!id) return;
    const locked = !unlocked.has(id);
    link.classList.toggle('feature-locked', locked);
    link.setAttribute('aria-disabled', locked ? 'true' : 'false');
    let badge = link.querySelector('.feature-lock-badge');
    if (locked) {
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'feature-lock-badge';
        badge.setAttribute('aria-hidden', 'true');
        badge.innerHTML = '<i class="fa-solid fa-lock"></i>';
        link.appendChild(badge);
      }
    } else if (badge) {
      badge.remove();
    }
  });

  for (const id of pulseIds) {
    document.querySelectorAll('.nav-link[data-feature]').forEach((link) => {
      if (link.getAttribute('data-feature') === id) triggerUnlockPulseOnLink(link);
    });
  }
  if (pulseIds.length > 0) {
    playUnlockSound();
    const firstTitle = UNLOCK_EXPLAIN[pulseIds[0]]?.title || 'ميزة جديدة';
    const suffix = pulseIds.length > 1 ? ` و${pulseIds.length - 1} ميزة أخرى` : '';
    showToast(`🎉 تم فتح ميزة: ${firstTitle}${suffix}`, 'success');
  }

  window.__navLockPrev = { ...currentLocks };
}

function syncWorldCardsLockUi() {
  document.querySelectorAll('.world-card[data-feature]').forEach((card) => {
    const feat = card.dataset.feature;
    const locked = feat && !isFeatureUnlocked(feat);
    card.classList.toggle('locked', locked);
    card.setAttribute('aria-disabled', locked ? 'true' : 'false');
    const overlay = card.querySelector('.world-card-lock-overlay');
    if (overlay) overlay.style.display = locked ? '' : 'none';
  });
}

function syncDockLockUi() {
  document.querySelectorAll('.treasure-dock-btn[data-feature]').forEach((btn) => {
    const id = btn.getAttribute('data-feature');
    if (!id) return;
    const locked = !isFeatureUnlocked(id);
    btn.classList.toggle('dock-feature-locked', locked);
    btn.setAttribute('aria-disabled', locked ? 'true' : 'false');
    const overlay = btn.querySelector('.dock-lock-overlay');
    if (overlay) overlay.style.display = locked ? 'flex' : 'none';
  });
}

function refreshFeatureUnlockUI() {
  if (typeof syncNavLockUi === 'function') syncNavLockUi();
  syncWorldCardsLockUi();
  syncDockLockUi();
}

// ── Theme Switching ──────────────────────────────
const THEME_USE_MESSAGES = {
  lootlingua: 'رجعنا للستايل الأصلي.. نظيف ومرتب مثل أول سيف باللعبة.',
  golden: 'الكنز الذهبي اشتغل. واضح إن القاموس صار داخل غرفة loot.',
  scroll: 'المخطوطة القديمة جاهزة. جو دراسة، بس بدون غبار المكتبات.',
  ocean: 'واحة الهدوء مفعلة. هذا الثيم معمول للمراجعة براحة.',
  glass: 'Liquid Glass اشتغل. هيك دخلنا مرحلة الستايل الفاخر.',
};

const THEME_UNLOCK_MESSAGES = {
  golden: 'فتحت ثيم الكنز الذهبي. أول إنجاز بصري محترم.',
  scroll: 'فتحت ثيم المخطوطة القديمة. القاموس صار عنده تاريخ.',
  ocean: 'فتحت ثيم واحة الهدوء. مكافأة لطيفة بعد التقدم.',
  glass: 'فتحت Liquid Glass. وصلت للستايل الثقيل.',
};

function themeSeenKey(type, theme) {
  return `lootlingua:${type}:theme:${theme}`;
}

function showThemeUseMessageOnce(theme) {
  const key = themeSeenKey('used', theme);
  if (localStorage.getItem(key)) return;
  const msg = THEME_USE_MESSAGES[theme];
  if (!msg) return;
  localStorage.setItem(key, '1');
  setTimeout(() => showToast(msg, 'success', 5200), 2400);
}

window.setTheme = function(theme, skipLockCheck = false) {
  const previousTheme = localStorage.getItem('theme') || document.documentElement.getAttribute('data-theme') || 'lootlingua';
  if (!skipLockCheck && isThemeComingSoon(theme)) {
    showGlassThemeComingSoonMessage();
    return false;
  }
  if (!skipLockCheck && !isThemeUnlocked(theme)) {
    showToast(getThemeLockedMessage(theme), 'warning');
    return false;
  }
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  document.querySelectorAll('.theme-option').forEach(opt => {
    opt.classList.toggle('active', opt.dataset.theme === theme);
  });
  refreshThemeLockUI();
  if (!skipLockCheck && theme !== previousTheme) showThemeUseMessageOnce(theme);
  return true;
};

function loadTheme() {
  const saved = localStorage.getItem('theme') || 'lootlingua';
  let candidate = saved;
  if (isThemeComingSoon(candidate) || !isThemeUnlocked(candidate)) candidate = 'lootlingua';
  setTheme(candidate, true);
  refreshThemeLockUI();
}

// ═══════════════════════════════════════════════════════
// Modal & Toast
// ═══════════════════════════════════════════════════════
function showModal(id) { document.getElementById(id).style.display = 'flex'; }
function hideModal(id) { document.getElementById(id).style.display = 'none'; }

function showToast(msg, type = 'info', duration = 2500) {
  const t = document.getElementById('toastMessage');
  if (!t) return;
  t.textContent = String(msg ?? '');
  t.style.background = '';
  t.style.color = '';
  t.classList.remove('toast-success', 'toast-warning', 'toast-danger', 'toast-info');
  t.classList.add(type === 'success' ? 'toast-success' : type === 'danger' ? 'toast-danger' : type === 'warning' ? 'toast-warning' : 'toast-info');
  t.classList.add('show');
  clearTimeout(window.__toastHideTimer);
  window.__toastHideTimer = setTimeout(() => t.classList.remove('show'), duration);
}

// ═══════════════════════════════════════════════════════
// ONBOARDING — Event-driven, simple, step-based
// ═══════════════════════════════════════════════════════
const ONBOARDING_STORAGE_KEY = 'lootlinguaOnboarding';

const ONBOARDING_STEPS = [
  { id: 'welcome', type: 'modal', title: 'مرحباً في LootLingua', text: 'LootLingua هو قاموسك الشخصي (إنجليزي - عربي).' },
  { id: 'wordInput', target: '#wordInput', text: '✍️ هنا تكتب الكلمة بالإنجليزي. سنستخدم كلمة جاهزة لتسهيل البداية.', action: 'fill' },
  { id: 'searchBtn', target: '#searchBtn', text: '🔍 اضغط هنا لجلب معنى الكلمة وجملة عليها.' },
  { id: 'selectSug', target: '#suggestionsBox', text: '✨ اختر أحد المعاني المقترحة لتعبئة البيانات.', preferredSide: 'left' },
  { id: 'addBtn', target: '#addBtn', text: '⭐ اضغط هنا لإضافة الكلمة إلى القاموس.' },
  { id: 'sound', target: '#list .word-card:first-child .sound-btn', text: '🔊 اضغط هنا لتسمع نطق الكلمة.' },
  { id: 'starBtn', target: '#list .word-card:first-child .star-btn', text: '⭐ هاي النجمة بتخليك تضيف الكلمة لقائمة "الكلمات الصعبة" عشان ترجع تراجعها' },
  { id: 'dictSearch', target: '#searchInput', text: '🔎 من هون تقدر تبحث داخل قاموسك بسهولة' },
  { id: 'legendDock', target: '#legendDock', text: '👇 هذا شريط التنقل الرئيسي — من هون تتحكم بكل أقسام التطبيق', dockStep: true },
  { id: 'worldsBtn', target: '#legendDock [data-dock-view="worlds"]', text: '🌍 ادخل على "العوالم" عشان تستكشف قواميس الألعاب أو تراجع الكلمات الصعبة', dockStep: true, openOnNext: 'worlds' },
  { id: 'quizBtn', target: '#legendDock [data-dock-view="quiz"]', text: '🎮 جرب "الاختبار" واختبر نفسك بالكلمات اللي تعلمتها', dockStep: true, openOnNext: 'quiz' },
  { id: 'treasureBtn', target: '#legendDock [data-dock-view="treasure"]', text: '💎 افتح "الكنز" يوميًا وخذ مكافآت و XP', dockStep: true, openOnNext: 'treasure' },
  { id: 'treasureTitles', target: '#treasureView .treasure-title-strip', text: 'هون بتقدر تتثبت إنك ما كنت قاعد بتتفرج، هون بتفتح ألقاب حسب تعبك 🔥', view: 'treasure' },
  { id: 'streak', target: '#streakWrap', text: '🔥 هذا الـ Streak — استخدم التطبيق كل يوم وخليه يزيد', topBarStep: true },
  { id: 'dailyQuests', target: '#dailyQuestsBtn', text: '🎯 عندك مهام يومية — خلصها عشان تاخذ XP إضافي', topBarStep: true },
  { id: 'notifBtn', target: '#notifBtn', text: '🔔 هون بتشوف كل الإشعارات والأحداث اللي صارت معك', topBarStep: true },
  { id: 'profileAvatar', target: '#heroAvatarBtn', text: '👤 هذا ملفك الشخصي — فيه مستواك، XP، وإحصائياتك', topBarStep: true, openOnNext: 'profile' },
  { id: 'profileThemes', target: '.profile-theme-selector', text: '🎨 تقدر تغير شكل التطبيق من الثيمات حسب ذوقك', view: 'profile' },
  { id: 'profileLogin', target: '#loginBtn', text: '☁️ سجل دخولك عشان تحفظ كلماتك على كل أجهزتك', view: 'profile' },
  { id: 'finish', type: 'finish', text: '🎉 خلصنا!\nضيف كلمات، جرب الكويز، واصير Legend 👑', requiresPersonal: true }
];

const ONBOARDING_SKIP_AFTER = 6;

let onboardState = {
  active: false,
  stepIndex: -1,
  currentStep: null,
  _cleanups: []
};

let onboardingHighlightRing = null;
let onboardingRingTarget = null;

function getSafeWord() {
  const options = ['book', 'go', 'learn', 'run', 'jump', 'play', 'see', 'look'];
  const existing = new Set(window.words.map(w => (w.word || '').toLowerCase().trim()));
  return options.find(w => !existing.has(w.toLowerCase())) || 'go';
}

let currentHighlightedElement = null; // Track the currently highlighted element

function onboardingCleanup() {
  onboardState._cleanups.forEach(fn => { try { fn(); } catch (_) {} });
  onboardState._cleanups = [];
}

function clearOnboardingHighlight() {
  if (currentHighlightedElement) {
    currentHighlightedElement.classList.remove('onboarding-active-target');
    currentHighlightedElement = null;
  }
  onboardingRingTarget = null;
  if (onboardingHighlightRing) {
    onboardingHighlightRing.remove();
    onboardingHighlightRing = null;
  }
}

function updateOnboardingHighlightRing(target, pad = 8) {
  if (!onboardingHighlightRing || !target) return;
  const rect = target.getBoundingClientRect();
  if (!rect.width && !rect.height) return;
  const radius = Math.min(20, Math.max(10, Math.min(rect.width, rect.height) * 0.2));
  onboardingHighlightRing.style.top = `${Math.max(0, rect.top - pad)}px`;
  onboardingHighlightRing.style.left = `${Math.max(0, rect.left - pad)}px`;
  onboardingHighlightRing.style.width = `${rect.width + pad * 2}px`;
  onboardingHighlightRing.style.height = `${rect.height + pad * 2}px`;
  onboardingHighlightRing.style.borderRadius = `${radius}px`;
}

function applyOnboardingHighlight(target, step = {}) {
  clearOnboardingHighlight();
  if (!target) return;
  const pad = step.highlightPad ?? (target.closest('.legend-dock') ? 6 : 8);
  target.classList.add('onboarding-active-target');
  currentHighlightedElement = target;
  onboardingRingTarget = target;

  onboardingHighlightRing = document.createElement('div');
  onboardingHighlightRing.id = 'onboardingHighlightRing';
  onboardingHighlightRing.className = 'onboarding-highlight-ring';
  onboardingHighlightRing.setAttribute('aria-hidden', 'true');
  document.body.appendChild(onboardingHighlightRing);
  updateOnboardingHighlightRing(target, pad);

  const reposition = () => {
    if (onboardingRingTarget) updateOnboardingHighlightRing(onboardingRingTarget, pad);
  };
  window.addEventListener('scroll', reposition, true);
  window.addEventListener('resize', reposition);
  onboardState._cleanups.push(() => {
    window.removeEventListener('scroll', reposition, true);
    window.removeEventListener('resize', reposition);
  });
}

function onboardingWaitLayout(step = {}) {
  const delay = step.dockStep ? 300 : step.view === 'profile' ? 380 : step.view === 'treasure' ? 320 : step.topBarStep ? 120 : 200;
  return new Promise(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, delay)));
  });
}

function executeOnboardingOpen(openKey) {
  if (openKey === 'worlds' && typeof loadWorldsView === 'function') loadWorldsView();
  else if (openKey === 'quiz' && typeof loadQuizView === 'function') loadQuizView();
  else if (openKey === 'treasure' && typeof loadTreasureView === 'function') loadTreasureView();
  else if (openKey === 'profile' && typeof toggleProfileModal === 'function') {
    const modal = document.getElementById('profileModal');
    if (modal && !modal.classList.contains('open')) toggleProfileModal();
  }
}

function scrollOnboardingTarget(el, step) {
  if (!el) return;
  if (step.topBarStep) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  if (step.dockStep) {
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
    return;
  }
  if (step.view === 'profile') {
    const body = document.querySelector('.profile-modal-body');
    if (body && el) body.scrollTo({ top: Math.max(0, el.offsetTop - 28), behavior: 'smooth' });
    return;
  }
  if (step.view === 'treasure') {
    window.scrollTo({ top: 0, behavior: 'auto' });
    el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    return;
  }
  el.scrollIntoView({ behavior: 'smooth', block: step.scrollBlock || 'center', inline: 'nearest' });
}

function ensureOnboardingBackdrop() {
  const backdrop = document.getElementById('onboardingBackdrop');
  if (backdrop) backdrop.classList.add('visible');
}

function prepareOnboardingView(step) {
  if (!step) return;
  const dockIds = ['legendDock', 'worldsBtn', 'quizBtn', 'treasureBtn'];
  const topBarIds = ['streak', 'dailyQuests', 'notifBtn', 'profileAvatar'];
  const profileSteps = ['profileThemes', 'profileLogin'];

  if (typeof closeDailyQuestsSheet === 'function') closeDailyQuestsSheet();
  if (typeof closeNotificationsPanel === 'function') closeNotificationsPanel();

  if (step.view === 'treasure' && typeof loadTreasureView === 'function') {
    loadTreasureView();
    return;
  }

  if (profileSteps.includes(step.id)) {
    if (typeof toggleProfileModal === 'function') {
      const modal = document.getElementById('profileModal');
      if (modal && !modal.classList.contains('open')) toggleProfileModal();
    }
    return;
  }

  if (typeof closeProfileModal === 'function') closeProfileModal();

  if (step.requiresPersonal || step.id === 'finish' || topBarIds.includes(step.id) || dockIds.includes(step.id)) {
    if (currentView !== 'personal' && typeof loadPersonalDictionary === 'function') {
      loadPersonalDictionary();
    }
    if (typeof setTreasureEntryVisible === 'function') setTreasureEntryVisible(true);
  }
}

function appendOnboardingNav(container, step) {
  const row = document.createElement('div');
  row.className = 'onboarding-nav-row';

  if (onboardState.stepIndex > 0) {
    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'onboarding-back-btn';
    back.textContent = 'السابق';
    back.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      prevStep();
    });
    row.appendChild(back);
  }

  if (onboardState.stepIndex >= ONBOARDING_SKIP_AFTER) {
    const skip = document.createElement('button');
    skip.type = 'button';
    skip.className = 'onboarding-skip-btn';
    skip.textContent = 'تخطي الشرح';
    skip.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      setOnboardingStatus('skipped');
      endOnboarding();
    });
    row.appendChild(skip);
  }

  const next = document.createElement('button');
  next.type = 'button';
  next.className = 'onboarding-next-btn';
  next.textContent = 'التالي';
  next.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (step?.openOnNext) {
      executeOnboardingOpen(step.openOnNext);
      await onboardingWaitLayout({ view: step.openOnNext === 'profile' ? 'profile' : step.openOnNext, dockStep: step.dockStep });
    }
    nextStep();
  }, { once: true });
  row.appendChild(next);

  if (row.children.length) container.appendChild(row);
}

function showTooltip(target, text, options = {}) {
  const { preferredSide, dockStep, step } = options;
  const tooltip = document.getElementById('onboardingTooltip');
  if (!tooltip || !target) return;

  ensureOnboardingBackdrop();
  const isMobile = window.innerWidth <= 768;

  applyOnboardingHighlight(target, step || onboardState.currentStep);

  const displayText = text;

  tooltip.style.opacity = '0';
  tooltip.style.pointerEvents = 'none';
  tooltip.style.left = '-9999px';
  tooltip.style.top = '0px';
  tooltip.style.right = 'auto';
  tooltip.style.bottom = 'auto';
  tooltip.style.transform = '';
  const body = document.createElement('div');
  body.className = 'onboarding-tip-text';
  body.innerHTML = displayText.replace(/\n/g, '<br>');
  tooltip.innerHTML = '';
  tooltip.appendChild(body);
  appendOnboardingNav(tooltip, step || onboardState.currentStep);
  tooltip.classList.remove('arrow-top', 'arrow-bottom', 'arrow-left', 'arrow-right', 'mobile-sheet', 'kb-active', 'dock-step', 'profile-step');
  tooltip.classList.add('visible');

  void tooltip.offsetWidth;

  if (isMobile) {
    tooltip.classList.add('mobile-sheet');
    if (dockStep) tooltip.classList.add('dock-step');
    if (step?.view === 'profile') tooltip.classList.add('profile-step');
    const activeEl = document.activeElement;
    if ((activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA') && activeEl.type !== 'button') {
      tooltip.classList.add('kb-active');
    }
    tooltip.style.left = '';
    tooltip.style.top = '';
    tooltip.style.opacity = '1';
    tooltip.style.pointerEvents = 'auto';
    requestAnimationFrame(() => updateOnboardingHighlightRing(target, step?.highlightPad ?? 8));
    return;
  }

  const targetRect = target.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();
  let tipW = tooltipRect.width || tooltip.offsetWidth;
  let tipH = tooltipRect.height || tooltip.offsetHeight;
  const margin = 15;

  // Guard against stale/zero layout readings without waiting on timers.
  if (!tipW || tipW < 1) tipW = Math.min(280, window.innerWidth - margin * 2);
  if (!tipH || tipH < 1) tipH = 80;

  let top = 0, left = 0, arrowClass = '';
  const isRTL = document.dir === 'rtl' || getComputedStyle(document.body).direction === 'rtl';

  if (preferredSide === 'viewport-right') {
    top = targetRect.bottom + margin;
    left = window.innerWidth - tipW - margin;
    arrowClass = 'arrow-top';
  } else if (target.id === 'sidebar' || target.id === 'menuBtn') {
    left = isRTL ? (targetRect.left - tipW - margin) : (targetRect.right + margin);
    top = targetRect.top + Math.min(40, Math.max(0, targetRect.height / 2 - tipH / 2));
    arrowClass = isRTL ? 'arrow-left' : 'arrow-right';
  } else if (preferredSide) {
    top = targetRect.top + (targetRect.height / 2) - (tipH / 2);
    left = (preferredSide === 'left') ? (targetRect.left - tipW - margin) : (targetRect.right + margin);
    arrowClass = (preferredSide === 'left') ? 'arrow-left' : 'arrow-right';
  } else if (dockStep || target.closest('.legend-dock')) {
    top = Math.max(margin, targetRect.top - tipH - margin);
    left = targetRect.left + (targetRect.width / 2) - (tipW / 2);
    arrowClass = 'arrow-top';
  } else if (target.closest('.legend-top-bar') || step?.topBarStep) {
    top = targetRect.bottom + margin;
    left = targetRect.left + (targetRect.width / 2) - (tipW / 2);
    arrowClass = 'arrow-bottom';
  } else if (targetRect.bottom + tipH + margin < window.innerHeight) {
    top = targetRect.bottom + margin;
    left = targetRect.left + (targetRect.width / 2) - (tipW / 2);
    arrowClass = 'arrow-bottom';
  } else {
    top = targetRect.top - tipH - margin;
    left = targetRect.left + (targetRect.width / 2) - (tipW / 2);
    arrowClass = 'arrow-top';
  }

  left = Math.max(margin, Math.min(left, window.innerWidth - tipW - margin));
  top = Math.max(margin, Math.min(top, window.innerHeight - tipH - margin));

  tooltip.style.top = `${top}px`;
  tooltip.style.left = `${left}px`;
  tooltip.classList.remove('arrow-top', 'arrow-bottom', 'arrow-left', 'arrow-right');
  if (arrowClass) tooltip.classList.add(arrowClass);
  tooltip.style.opacity = '1';
  tooltip.style.pointerEvents = 'auto';
}
function hideTooltip() {
  const tooltip = document.getElementById('onboardingTooltip');
  if (tooltip) {
    tooltip.classList.remove('visible');
    tooltip.classList.remove('arrow-top', 'arrow-bottom', 'arrow-left', 'arrow-right');
    tooltip.innerHTML = '';
  }
  clearOnboardingHighlight();
}

// دالة مخصصة لعرض التلميح على يسار الزر (داخل الصفحة)
function setOnboardingStatus(status) {
  localStorage.setItem(ONBOARDING_STORAGE_KEY, status);
}

function getOnboardingStatus() {
  return localStorage.getItem(ONBOARDING_STORAGE_KEY);
}

function hasOnboardingState() {
  return ['completed', 'skipped'].includes(getOnboardingStatus());
}

let isProcessingNextStep = false; // لمنع تكرار الخطوات على الهاتف
let onboardingStepAdvanceTimer = null;

window.startOnboarding = function(force = false) {
  if (isOnboardingComingSoon()) {
    showOnboardingComingSoonMessage();
    return;
  }
  if (force) setOnboardingStatus('new');

  if (typeof closeProfileModal === 'function') closeProfileModal();
  if (typeof closeSidebarIfOpen === 'function') closeSidebarIfOpen();
  if (typeof loadPersonalDictionary === 'function') loadPersonalDictionary();

  onboardingCleanup();
  onboardState.active = true;
  onboardState.stepIndex = 0;
  document.documentElement.classList.add('onboarding-active');
  document.body.classList.add('onboarding-active');
  if (mainContentScrollArea) mainContentScrollArea.style.overflow = 'hidden';

  window.addEventListener('wheel', preventScroll, { passive: false });
  window.addEventListener('touchmove', preventScroll, { passive: false });

  runStep();
};

function prevStep() {
  if (!onboardState.active || onboardState.stepIndex <= 0) return;
  if (isProcessingNextStep) return;
  isProcessingNextStep = true;
  onboardingCleanup();
  onboardState.stepIndex--;
  runStep();
  setTimeout(() => { isProcessingNextStep = false; }, 500);
}

function nextStep(expectedStepIndex = null) {
  expectedStepIndex = Number.isInteger(expectedStepIndex) ? expectedStepIndex : null;
  if (expectedStepIndex !== null && onboardState.stepIndex !== expectedStepIndex) return;
  if (isProcessingNextStep) return;
  isProcessingNextStep = true;

  if (onboardingStepAdvanceTimer) {
    clearTimeout(onboardingStepAdvanceTimer);
    onboardingStepAdvanceTimer = null;
  }

  onboardingCleanup();
  onboardState.stepIndex++;
  runStep();

  setTimeout(() => { isProcessingNextStep = false; }, 700);
}

window.onboardingEvent = function(eventName) {
  if (!onboardState.active || !onboardState.currentStep) return;
  if (onboardState.currentStep.waitFor === eventName) {
    const expectedStepIndex = onboardState.stepIndex;
    onboardState.waitingFor = null;
    if (onboardingStepAdvanceTimer) clearTimeout(onboardingStepAdvanceTimer);
    onboardingStepAdvanceTimer = setTimeout(() => {
      onboardingStepAdvanceTimer = null;
      nextStep(expectedStepIndex);
    }, 100);
  }
};

async function runStep() {
  hideTooltip();
  onboardingCleanup();

  const step = ONBOARDING_STEPS[onboardState.stepIndex];
  if (!step) {
    endOnboarding();
    return;
  }

  onboardState.currentStep = step;
  prepareOnboardingView(step);
  await onboardingWaitLayout(step);

  if (step.type === 'modal') {
    showOnboardingBox(step);
    return;
  }

  if (step.type === 'finish') {
    const box = document.getElementById('onboardingBox');
    if (box) { box.classList.add('hidden'); box.style.display = 'none'; }
    if (typeof closeProfileModal === 'function') closeProfileModal();
    if (typeof loadPersonalDictionary === 'function') loadPersonalDictionary();
    setTimeout(() => showFinishTooltip(step.text), 320);
    return;
  }

  const box = document.getElementById('onboardingBox');
  const backdrop = document.getElementById('onboardingBackdrop');
  if (backdrop) backdrop.classList.remove('modal-backdrop');
  if (box) { box.classList.add('hidden'); box.style.display = 'none'; }

  let el = document.querySelector(step.target);
  if (!el) {
    setTimeout(() => runStep(), 150);
    return;
  }

  scrollOnboardingTarget(el, step);
  await onboardingWaitLayout(step);
  el = document.querySelector(step.target);
  if (!el) {
    setTimeout(() => runStep(), 150);
    return;
  }

  if (step.action === 'fill') {
    applyOnboardingHighlight(el, step);
    el.value = getSafeWord();
    el.dispatchEvent(new Event('input', { bubbles: true }));
    setTimeout(nextStep, 1500);
    return;
  }

  showTooltip(el, step.text, { preferredSide: step.preferredSide, step, dockStep: step.dockStep });
}

function showOnboardingBox(step) {
  const box = document.getElementById('onboardingBox');
  const backdrop = document.getElementById('onboardingBackdrop');
  const title = document.getElementById('onboardingTitle');
  const text = document.getElementById('onboardingText');
  const primary = document.getElementById('onboardingPrimaryBtn');
  const secondary = document.getElementById('onboardingSecondaryBtn');

  title.textContent = step.title;
  text.innerHTML = step.text;
  backdrop.classList.toggle('modal-backdrop', step.id === 'welcome');
  
  if (step.id === 'welcome') {
    primary.textContent = 'ابدأ الشرح';
    primary.addEventListener('click', () => nextStep(), { once: true });
    secondary.textContent = 'لاحقًا';
    secondary.style.display = 'inline-flex';
    secondary.addEventListener('click', () => {
      endOnboarding();
      setOnboardingStatus('skipped');
    }, { once: true });
  } else {
    primary.textContent = 'تمام';
    primary.addEventListener('click', () => {
      setOnboardingStatus('completed');
      hideOnboarding();
      showToast('الشرح انتهى بنجاح!', 'success');
    }, { once: true });
    secondary.style.display = 'none';
  }

  primary.style.display = 'inline-flex';
  box.classList.remove('hidden');
  backdrop.classList.add('visible');
}

function initOnboarding() {
  // حقن تنسيقات الاحترافية للموبايل والـ Spotlight
  const style = document.createElement('style');
  style.textContent = `
    .onboarding-highlight-ring {
      position: fixed;
      z-index: 100005;
      pointer-events: none;
      box-shadow: 0 0 0 max(120vh, 120vw) rgba(0, 0, 0, 0.84);
    }
    .onboarding-active-target {
      z-index: 100007 !important;
      pointer-events: auto !important;
      isolation: isolate;
    }
    .legend-dock .onboarding-active-target,
    .legend-top-bar .onboarding-active-target,
    #heroAvatarBtn.onboarding-active-target,
    .treasure-dock-btn.onboarding-active-target,
    .profile-modal .onboarding-active-target {
      z-index: 100008 !important;
    }
    body.onboarding-active .profile-modal.open {
      pointer-events: auto !important;
    }
    #onboardingTooltip {
      z-index: 100020 !important; /* فوق الـ backdrop والسايدبار وأي overlay داخلي */
    }
    #onboardingBackdrop.visible {
      background: rgba(0, 0, 0, 0.64) !important;
      backdrop-filter: none !important;
      -webkit-backdrop-filter: none !important;
    }
    #onboardingBackdrop.visible.modal-backdrop {
      background: rgba(0, 0, 0, 0.68) !important;
      backdrop-filter: blur(4px) saturate(0.85) !important;
      -webkit-backdrop-filter: blur(4px) saturate(0.85) !important;
    }
    #onboardingBox {
      z-index: 100030 !important;
      filter: none !important;
      backdrop-filter: none !important;
      -webkit-backdrop-filter: none !important;
    }
    body.onboarding-active .main-content,
    body.onboarding-active .sidebar,
    body.onboarding-active .menu-btn,
    body.onboarding-active .legend-top-bar,
    body.onboarding-active .legend-dock {
      pointer-events: none;
    }
    body.onboarding-active .profile-modal:not(.open) {
      pointer-events: none !important;
    }
    body.onboarding-active .onboarding-active-target,
    body.onboarding-active #onboardingTooltip,
    body.onboarding-active #onboardingBox,
    body.onboarding-active #onboardingBackdrop {
      pointer-events: auto !important;
    }
    body.onboarding-active #sidebar:has(.onboarding-active-target),
    body.onboarding-active #sidebar.onboarding-active-target {
      z-index: 100006 !important;
    }
    body.onboarding-active .word-card:has(.sound-btn.onboarding-active-target) .edit-btn,
    body.onboarding-active .word-card:has(.sound-btn.onboarding-active-target) .del-btn,
    body.onboarding-active .word-card:has(.sound-btn.onboarding-active-target) .star-btn {
      position: relative !important;
      z-index: 1 !important;
    }
    /* تجميد محتوى السايدبار أثناء خطوة الشرح لمنع العجقة */
    body.onboarding-active #overlay.show {
      opacity: 0 !important;
      pointer-events: none !important;
    }
    #sidebar.onboarding-active-target * {
      pointer-events: none !important;
    }

    /* القفل الحديدي للسكرول */
    html.onboarding-active, body.onboarding-active {
      overflow: hidden !important;
      overscroll-behavior: none !important; /* يمنع الارتداد في الموبايل */
    }
    /* تأثير انتقالي ناعم للنص عند تغير الخطوات */
    #onboardingTooltip div {
      animation: onboardingTextFade 0.4s ease-out forwards;
    }
    @keyframes onboardingTextFade {
      from { opacity: 0; transform: translateY(5px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @media (max-width: 768px) {
      #onboardingTooltip.mobile-sheet {
        position: fixed !important;
        left: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        top: auto !important;
        width: 100% !important;
        max-width: none !important;
        border-radius: 1.5rem 1.5rem 0 0 !important;
        padding: 0.8rem 1rem !important; /* تقليل الحشو ليكون الصندوق أصغر */
        background: var(--card-bg) !important;
        border: none !important;
        border-top: 3px solid var(--accent) !important;
        box-shadow: 0 -10px 30px rgba(0,0,0,0.5) !important;
        transform: translateY(0) !important;
        margin: 0 !important;
        text-align: center !important;
        z-index: 100020 !important;
      }
      #onboardingTooltip.mobile-sheet div {
        font-size: 0.95rem !important; /* تصغير حجم الخط */
        line-height: 1.4 !important; /* تحسين تباعد الأسطر للحجم الجديد */
      }
      #onboardingTooltip.mobile-sheet.kb-active {
        bottom: auto !important;
        top: 0 !important;
        border-top: none !important;
        border-bottom: 3px solid var(--accent) !important;
        border-radius: 0 0 1.5rem 1.5rem !important;
      }
      .onboarding-next-btn,
      .onboarding-back-btn,
      .onboarding-skip-btn {
        width: auto !important;
        min-width: 88px !important;
        margin-top: 0.55rem !important;
        padding: 0.65rem 0.9rem !important;
        font-size: 0.88rem !important;
      }
      .onboarding-nav-row {
        display: flex !important;
        flex-wrap: wrap !important;
        gap: 8px !important;
        justify-content: center !important;
        margin-top: 0.65rem !important;
      }
      #onboardingTooltip.mobile-sheet.dock-step {
        bottom: calc(96px + env(safe-area-inset-bottom)) !important;
        border-radius: 1.2rem !important;
        max-height: 38vh !important;
        overflow-y: auto !important;
      }
      #onboardingTooltip.mobile-sheet.profile-step {
        bottom: 12px !important;
        max-height: 42vh !important;
      }
      #onboardingTooltip.mobile-sheet.finish-step {
        bottom: auto !important;
        top: 50% !important;
        left: 12px !important;
        right: 12px !important;
        width: auto !important;
        transform: translateY(-50%) !important;
        border-radius: 1.2rem !important;
        max-height: 55vh !important;
      }
    }
  `;
  document.head.appendChild(style);

  // مراقبة لوحة المفاتيح لتحديث مكان التلميح
  // تحديد العنصر الرئيسي القابل للتمرير بعد تحميل DOM
  // **هام:** يجب تغيير 'app-main-scroll-area' إلى الـ ID الفعلي للعنصر الذي يحتوي على المحتوى القابل للتمرير في صفحتك.
  // إذا كان الـ body هو العنصر الوحيد القابل للتمرير، اتركه كما هو (document.body).
  mainContentScrollArea = document.getElementById('app-main-scroll-area') || document.body;
  originalMainContentScrollAreaOverflow = mainContentScrollArea.style.overflow;


  window.addEventListener('focusin', (e) => {
    if (!onboardState.active || window.innerWidth > 768) return;
    const activeEl = document.activeElement;
    const tip = document.getElementById('onboardingTooltip');
    if (tip && tip.classList.contains('mobile-sheet') && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
      tip.classList.add('kb-active');
    }
  });
  window.addEventListener('focusout', (e) => {
    const tip = document.getElementById('onboardingTooltip');
    if (tip) tip.classList.remove('kb-active');
  });

  // ترحيب أول زيارة فقط — لا شرح تفاعلي تلقائي
  scheduleWelcomeModalIfNeeded();
}

function hasSeenWelcomeModal() {
  return localStorage.getItem(WELCOME_STORAGE_KEY) === '1';
}

function markWelcomeModalSeen() {
  localStorage.setItem(WELCOME_STORAGE_KEY, '1');
  if (!getOnboardingStatus() || getOnboardingStatus() === 'new') {
    setOnboardingStatus('skipped');
  }
}

function scheduleWelcomeModalIfNeeded() {
  if (hasSeenWelcomeModal()) return;
  setTimeout(() => showWelcomeModalOnce(), 1400);
}

function showWelcomeModalOnce() {
  if (hasSeenWelcomeModal()) return;
  showModal('welcomeModal');
}

window.dismissWelcomeModal = function() {
  markWelcomeModalSeen();
  hideModal('welcomeModal');
};

function preventScroll(e) {
  if (onboardState.active) e.preventDefault();
}

function endOnboarding() {
  onboardState.active = false;
  hideOnboarding();
}

function hideOnboarding() {
  onboardingCleanup();
  hideTooltip();
  const box = document.getElementById('onboardingBox');
  const backdrop = document.getElementById('onboardingBackdrop');
  const tooltip = document.getElementById('onboardingTooltip');

  if (box) box.classList.add('hidden');
  if (backdrop) backdrop.classList.remove('visible', 'modal-backdrop');
  if (tooltip) {
    tooltip.classList.remove('visible', 'mobile-sheet', 'dock-step', 'profile-step', 'finish-step');
    tooltip.style.animation = '';
    tooltip.innerHTML = '';
  }

  document.documentElement.classList.remove('onboarding-active');
  document.body.classList.remove('onboarding-active');
  if (mainContentScrollArea) mainContentScrollArea.style.overflow = originalMainContentScrollAreaOverflow;

  window.removeEventListener('wheel', preventScroll);
  window.removeEventListener('touchmove', preventScroll);
  if (typeof closeProfileModal === 'function') closeProfileModal();
}

// دالة لعرض tooltip في منتصف الشاشة للخطوة الأخيرة
function showFinishTooltip(text) {
  const tooltip = document.getElementById('onboardingTooltip');
  const backdrop = document.getElementById('onboardingBackdrop');
  if (!tooltip) return;
  if (backdrop) backdrop.classList.add('visible', 'modal-backdrop');

  if (currentHighlightedElement) {
    currentHighlightedElement.classList.remove('onboarding-active-target');
    currentHighlightedElement = null;
  }

  const isMobile = window.innerWidth <= 768;
  const body = document.createElement('div');
  body.className = 'onboarding-tip-text finish-tip';
  body.innerHTML = text.replace(/\n/g, '<br>');
  tooltip.innerHTML = '';
  tooltip.appendChild(body);

  const nav = document.createElement('div');
  nav.className = 'onboarding-nav-row';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'onboarding-next-btn';
  btn.textContent = 'تمام';
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    setOnboardingStatus('completed');
    endOnboarding();
    showToast('الشرح انتهى بنجاح! 🎉', 'success');
    if (typeof launchConfetti === 'function') launchConfetti();
  }, { once: true });
  nav.appendChild(btn);
  tooltip.appendChild(nav);

  tooltip.classList.remove('arrow-top', 'arrow-bottom', 'arrow-left', 'arrow-right', 'dock-step', 'profile-step', 'kb-active');
  tooltip.style.opacity = '0';
  tooltip.style.pointerEvents = 'none';

  if (isMobile) {
    tooltip.classList.add('mobile-sheet', 'finish-step');
    tooltip.style.left = '';
    tooltip.style.top = '';
    tooltip.style.right = '';
    tooltip.style.bottom = '';
    tooltip.style.transform = '';
  } else {
    tooltip.classList.remove('mobile-sheet', 'finish-step');
    void tooltip.offsetWidth;
    const tooltipRect = tooltip.getBoundingClientRect();
    const tipW = tooltipRect.width || 280;
    const tipH = tooltipRect.height || 120;
    const left = Math.max(12, (window.innerWidth - tipW) / 2);
    const top = Math.max(12, (window.innerHeight - tipH) / 2 - 40);
    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;
  }

  tooltip.classList.add('visible');
  tooltip.style.opacity = '1';
  tooltip.style.pointerEvents = 'auto';
  tooltip.style.animation = 'tooltipPopIn 0.5s ease-out';
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
    dailyLootState:   typeof getLootState === 'function' ? getLootState() : loadJSON('lootlinguaDailyLootState', {}),
    titlesState:      typeof getTitleState === 'function' ? getTitleState() : loadJSON('lootlinguaTitlesState', {}),
    streakFreezes:    loadInt('lootlinguaStreakFreezes', 0),
    freezeSaves:      loadInt('lootlinguaFreezeSaves', 0),
    gameDictAdds:     loadInt('lootlinguaGameDictAdds', 0),
    perfectQuizzes:   loadInt('lootlinguaPerfectQuizzes', 0),
    extraChests:      loadJSON('lootlinguaExtraChests', []),
  };
};

window.mergeLootlinguaProfileFromCloud = function(d) {
  // Track if we loaded from cloud to avoid double checkAndUpdateStreak
  window._profileLoaded = true;
  if (!d) return;
  if (d.userXP !== undefined && d.userXP !== null) {
    const cloud = Number(d.userXP) || 0;
    userXP = Math.max(cloud, userXP);
    saveInt('userXP', userXP);
  }
  if (d.dailyStreak !== undefined) {
    dailyStreak = Math.max(Number(d.dailyStreak) || 0, dailyStreak);
    saveInt('dailyStreak', dailyStreak);
  }
  if (d.lastActivityDate) {
    // خُّد الأحدث بين المحلي والسحابة
    if (!lastActivity || d.lastActivityDate > lastActivity) {
      lastActivity = d.lastActivityDate;
      localStorage.setItem('lastActivityDate', lastActivity);
    }
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
  if (d.dailyLootState && typeof d.dailyLootState === 'object') {
    const localLoot = typeof getLootState === 'function' ? getLootState() : loadJSON('lootlinguaDailyLootState', {});
    const cloudLoot = d.dailyLootState;
    const byRewardKey = new Map();
    [...(cloudLoot.rewards || []), ...(localLoot.rewards || [])].forEach((r) => {
      if (!r || typeof r !== 'object') return;
      const key = `${r.at || 0}|${r.type || ''}|${r.label || ''}|${r.xp || 0}|${r.freezes || 0}`;
      if (!byRewardKey.has(key)) byRewardKey.set(key, r);
    });
    const mergedLoot = {
      ...cloudLoot,
      ...localLoot,
      lastOpenAt: Math.max(Number(cloudLoot.lastOpenAt) || 0, Number(localLoot.lastOpenAt) || 0),
      totalOpens: Math.max(Number(cloudLoot.totalOpens) || 0, Number(localLoot.totalOpens) || 0),
      streak: Math.max(Number(cloudLoot.streak) || 0, Number(localLoot.streak) || 0),
      lastOpenDay: [cloudLoot.lastOpenDay || '', localLoot.lastOpenDay || ''].sort().pop() || '',
      rewards: [...byRewardKey.values()].sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, 12),
    };
    if (typeof saveLootState === 'function') saveLootState(mergedLoot);
    else saveJSON('lootlinguaDailyLootState', mergedLoot);
  }
  if (d.titlesState && typeof d.titlesState === 'object') {
    const localTitles = typeof getTitleState === 'function' ? getTitleState() : loadJSON('lootlinguaTitlesState', { unlocked: [], lastUnlockedAt: {} });
    const unlocked = [...new Set([...(d.titlesState.unlocked || []), ...(localTitles.unlocked || [])])];
    const lastUnlockedAt = { ...(d.titlesState.lastUnlockedAt || {}) };
    Object.entries(localTitles.lastUnlockedAt || {}).forEach(([k, v]) => {
      lastUnlockedAt[k] = Math.max(Number(lastUnlockedAt[k]) || 0, Number(v) || 0);
    });
    const mergedTitles = { unlocked, lastUnlockedAt };
    if (typeof saveTitleState === 'function') saveTitleState(mergedTitles);
    else saveJSON('lootlinguaTitlesState', mergedTitles);
  }
  if (d.streakFreezes !== undefined) saveInt('lootlinguaStreakFreezes', Math.max(loadInt('lootlinguaStreakFreezes', 0), Number(d.streakFreezes) || 0));
  if (d.freezeSaves !== undefined) saveInt('lootlinguaFreezeSaves', Math.max(loadInt('lootlinguaFreezeSaves', 0), Number(d.freezeSaves) || 0));
  if (d.gameDictAdds !== undefined) saveInt('lootlinguaGameDictAdds', Math.max(loadInt('lootlinguaGameDictAdds', 0), Number(d.gameDictAdds) || 0));
  if (d.perfectQuizzes !== undefined) saveInt('lootlinguaPerfectQuizzes', Math.max(loadInt('lootlinguaPerfectQuizzes', 0), Number(d.perfectQuizzes) || 0));
  if (Array.isArray(d.extraChests)) {
    const localExtra = loadJSON('lootlinguaExtraChests', []);
    const seen = new Set();
    const mergedExtra = [...d.extraChests, ...localExtra].filter((c) => {
      const key = `${c?.id || ''}|${c?.type || ''}|${c?.earnedAt || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    saveJSON('lootlinguaExtraChests', mergedExtra);
  }
  if (typeof evaluateTitleUnlocks === 'function') evaluateTitleUnlocks(false);
  renderStreak();
  renderDailyGoal();
  renderXPBar();
  refreshFeatureUnlockUI();
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
  {min:0,   max:14,       label:'Noob',     iconClass:'fa-solid fa-seedling', color:'var(--text-gray)'},
  {min:15,  max:39,       label:'Wanderer', iconClass:'fa-solid fa-compass', color:'var(--header-grad)'},
  {min:40,  max:79,       label:'Learner',  iconClass:'fa-solid fa-book-open', color:'var(--accent)'},
  {min:80,  max:149,      label:'Explorer', iconClass:'fa-solid fa-binoculars', color:'var(--accent2)'},
  {min:150, max:249,      label:'Pro',      iconClass:'fa-solid fa-sword', color:'var(--success)'},
  {min:250, max:399,      label:'Veteran',  iconClass:'fa-solid fa-shield-halved', color:'var(--success)'},
  {min:400, max:599,      label:'Elite',    iconClass:'fa-solid fa-fire', color:'var(--star)'},
  {min:600, max:899,      label:'Master',   iconClass:'fa-solid fa-star', color:'var(--star)'},
  {min:900, max:1299,     label:'Legend',   iconClass:'fa-solid fa-crown', color:'var(--accent)'},
  {min:1300,max:Infinity, label:'Linguaer', iconClass:'fa-solid fa-trophy', color:'var(--accent2)'},
];

// userXP already declared in State section above — just reload from localStorage
userXP = loadInt('userXP', 0);

function getRank(xp)     { return [...XP_RANKS].reverse().find(r=>xp>=r.min)||XP_RANKS[0]; }
function getNextRank(xp) { return XP_RANKS.find(r=>r.min>xp)||null; }

const THEME_UNLOCK_LEVELS = {
  lootlingua: 1,
  golden: 2,
  scroll: 3,
  ocean: 4,
  glass: 5,
};

const THEME_DISPLAY_NAMES = {
  lootlingua: 'LootLingua',
  golden: 'الكنز الذهبي',
  scroll: 'المخطوطة القديمة',
  ocean: 'واحة الهدوء',
  glass: 'الثيم الزجاجي',
};

/** ثيمات/ميزات معطّلة مؤقتاً — تظهر باهتة مع «قريباً» */
const THEMES_COMING_SOON = new Set(['glass']);
const ONBOARDING_COMING_SOON = true;
const WELCOME_STORAGE_KEY = 'lootlingua_welcome_v1_seen';

function isThemeComingSoon(theme) {
  return THEMES_COMING_SOON.has(theme);
}

function isOnboardingComingSoon() {
  return ONBOARDING_COMING_SOON;
}

function getThemeDisplayName(theme) {
  return THEME_DISPLAY_NAMES[theme] || theme;
}

function showGlassThemeComingSoonMessage() {
  pushNotification(`«${getThemeDisplayName('glass')}» قريباً — ما زال قيد التطوير. ترقّب التحديث! ✨`, 'warning');
}

function ensureThemeStatusLabel(opt) {
  let label = opt.querySelector('.theme-status-label');
  if (!label) {
    label = document.createElement('span');
    label.className = 'theme-status-label';
    label.setAttribute('aria-hidden', 'true');
    opt.appendChild(label);
  }
  return label;
}

function updateThemeOptionLabels(opt, theme, comingSoon, unlocked) {
  const displayName = getThemeDisplayName(theme);
  const nameEl = opt.querySelector('.theme-display-name') || opt.querySelector('.theme-name');
  if (nameEl) nameEl.textContent = displayName;

  const label = ensureThemeStatusLabel(opt);
  const required = THEME_UNLOCK_LEVELS[theme] || 1;

  if (comingSoon) {
    label.className = 'theme-status-label theme-status-label--soon';
    label.textContent = 'قريباً';
    label.removeAttribute('aria-hidden');
    opt.title = `${displayName} — قريباً (غير متاح بعد)`;
  } else if (!unlocked) {
    label.className = 'theme-status-label theme-status-label--level';
    label.textContent = `مقفل — Level ${required}`;
    label.removeAttribute('aria-hidden');
    opt.title = `${displayName} — يفتح عند Level ${required}`;
  } else {
    label.className = 'theme-status-label theme-status-label--open';
    label.textContent = '';
    label.setAttribute('aria-hidden', 'true');
  }
}

function showOnboardingComingSoonMessage() {
  pushNotification('الشرح التفاعلي قريباً! لسه بنحكيه أحلى — ترقب التحديث 🛠️', 'warning');
}

window.handleOnboardingReplayClick = function(ev) {
  if (ev) { ev.preventDefault(); ev.stopPropagation(); }
  if (isOnboardingComingSoon()) {
    showOnboardingComingSoonMessage();
    return;
  }
  if (typeof closeProfileModal === 'function') closeProfileModal();
  startOnboarding(true);
};

function getLevelFromXP(xp) {
  const level = XP_RANKS.filter(r => xp >= r.min).length;
  return Math.max(1, level);
}

function isThemeUnlocked(theme) {
  if (isThemeComingSoon(theme)) return false;
  const required = THEME_UNLOCK_LEVELS[theme] || 1;
  return getLevelFromXP(userXP) >= required;
}

function getThemeLockedMessage(theme) {
  const name = getThemeDisplayName(theme);
  const required = THEME_UNLOCK_LEVELS[theme] || 1;
  return required === 1
    ? `${name} متاح الآن.`
    : `${name} مقفل — ارفع مستواك إلى Level ${required} لفتحه`;
}

function refreshThemeLockUI() {
  const previous = window.__themeLockPrev;
  const current = {};
  const newlyUnlocked = [];
  const newlyLocked = [];
  let activeThemeLocked = false;
  const activeTheme = localStorage.getItem('theme') || document.documentElement.getAttribute('data-theme') || 'lootlingua';

  document.querySelectorAll('.theme-option').forEach(opt => {
    const theme = opt.dataset.theme;
    const comingSoon = isThemeComingSoon(theme);
    const unlocked = isThemeUnlocked(theme);
    current[theme] = !unlocked;
    opt.classList.toggle('theme-coming-soon', comingSoon);
    opt.classList.toggle('theme-locked', !unlocked && !comingSoon);
    opt.classList.toggle('theme-locked-level', !unlocked && !comingSoon);
    opt.setAttribute('aria-disabled', unlocked && !comingSoon ? 'false' : 'true');
    updateThemeOptionLabels(opt, theme, comingSoon, unlocked);
    if (comingSoon) opt.classList.remove('active');
    else if (unlocked) opt.removeAttribute('title');

    if (window.__themeLockSeeded && previous?.[theme] === false && !unlocked) {
      newlyLocked.push(theme);
      localStorage.removeItem(themeSeenKey('unlocked', theme));
      localStorage.removeItem(themeSeenKey('used', theme));
    }

    const unlockKey = themeSeenKey('unlocked', theme);
    if (window.__themeLockSeeded && previous?.[theme] === true && unlocked && !localStorage.getItem(unlockKey)) {
      newlyUnlocked.push(theme);
      localStorage.setItem(unlockKey, '1');
    }

    if (theme === activeTheme && (!unlocked || comingSoon)) activeThemeLocked = true;
  });

  const replayBtn = document.getElementById('replayOnboardingBtn');
  if (replayBtn) {
    replayBtn.classList.toggle('feature-coming-soon', isOnboardingComingSoon());
    replayBtn.setAttribute('aria-disabled', isOnboardingComingSoon() ? 'true' : 'false');
    replayBtn.title = isOnboardingComingSoon() ? 'الشرح التفاعلي قريباً' : '';
  }

  if (activeThemeLocked) {
    document.documentElement.setAttribute('data-theme', 'lootlingua');
    localStorage.setItem('theme', 'lootlingua');
    document.querySelectorAll('.theme-option').forEach(opt => {
      opt.classList.toggle('active', opt.dataset.theme === 'lootlingua');
    });
    if (window.__themeLockSeeded) {
      setTimeout(() => showToast('الثيم هذا رجع للخزنة مؤقتًا. ارجع ارفع مستواك وبتفتحه من جديد.', 'warning', 5600), 600);
    }
  }

  if (!window.__themeLockSeeded) window.__themeLockSeeded = true;
  window.__themeLockPrev = current;

  if (newlyUnlocked.length > 0) {
    const theme = newlyUnlocked[0];
    playUnlockSound();
    setTimeout(() => showToast(THEME_UNLOCK_MESSAGES[theme] || 'فتحت ثيم جديد. شكلك ماشي صح.', 'success', 5200), 4100);
  }
}

function updateXP(amount) {
  if (!amount) return;
  const oldRank = getRank(userXP);
  userXP = Math.max(0, userXP + amount);
  saveInt('userXP', userXP);
  if (window.saveProfileToCloud) window.saveProfileToCloud();
  renderXPBar();
  if (amount > 0 && getRank(userXP).label !== oldRank.label)
    setTimeout(()=>showRankUp(getRank(userXP)), 400);
  if (typeof evaluateTitleUnlocks === 'function') evaluateTitleUnlocks(false);
  refreshFeatureUnlockUI();
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
  el.fill.style.background = rank.color;
  refreshThemeLockUI();
  if (el.lbl) { el.lbl.textContent=rank.label; el.lbl.style.color=rank.color; }
  if (el.ico)   el.ico.innerHTML = `<i class="${rank.iconClass}" aria-hidden="true"></i>`;
  if (el.val)   el.val.textContent = userXP+' XP';
  if (el.nxt)   el.nxt.innerHTML = next ? `${next.min} XP` : `MAX <i class="fa-solid fa-trophy" aria-hidden="true"></i>`;
  syncHeroAvatar();
}

function showXPBadge(amount, anchorId, isNeg) {
  const b = document.getElementById('xpBadge');
  if (!b) return;
  b.textContent      = (isNeg?'-':'+')+amount+' XP';
  const root = getComputedStyle(document.documentElement);
  b.style.background = isNeg ? 'var(--danger)' : 'var(--star)';
  b.style.color      = isNeg ? 'var(--text-on-accent)' : 'var(--text-on-star)';
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
  t.style.background='var(--accent)'; t.style.color='var(--text-on-accent)'; t.classList.add('show');
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
    const freezes = typeof getStreakFreezeCount === 'function' ? getStreakFreezeCount() : loadInt('lootlinguaStreakFreezes', 0);
    if (freezes > 0) {
      if (typeof saveStreakFreezeCount === 'function') saveStreakFreezeCount(freezes - 1);
      else saveInt('lootlinguaStreakFreezes', freezes - 1);
      saveInt('lootlinguaFreezeSaves', loadInt('lootlinguaFreezeSaves', 0) + 1);
      dailyStreak = Math.max(1, dailyStreak);
      setTimeout(() => showToast('Streak Freeze اشتغل وأنقذ السلسلة. رجعت قبل ما تنكسر!', 'success', 5600), 900);
      if (typeof evaluateTitleUnlocks === 'function') evaluateTitleUnlocks(true);
    } else {
      dailyStreak = 1;
    }
  } else {
    dailyStreak = 1; // أول استخدام
  }

  saveInt('dailyStreak', dailyStreak);
  const maxS = loadInt('lootlinguaMaxStreak', 0);
  if (dailyStreak > maxS) saveInt('lootlinguaMaxStreak', dailyStreak);
  lastActivity = today;
  localStorage.setItem('lastActivityDate', today);
  if (window.saveProfileToCloud) window.saveProfileToCloud();
  renderStreak();
  renderProfileModalStats();
}

function renderStreak() {
  const el   = document.getElementById('streakCount');
  const ico  = document.getElementById('streakIcon');
  const wrap = document.getElementById('streakWrap');
  if (!el) return;
  el.textContent = dailyStreak+' يوم';
  if (dailyStreak>=30)      { if(ico)ico.innerHTML='<i class="fa-solid fa-bolt"></i>'; el.style.color='var(--accent)'; }
  else if (dailyStreak>=14) { if(ico)ico.innerHTML='<i class="fa-solid fa-fire"></i>'; el.style.color='var(--accent2)'; }
  else if (dailyStreak>=7)  { if(ico)ico.innerHTML='<i class="fa-solid fa-fire"></i>'; el.style.color='var(--star)'; }
  else                      { if(ico)ico.innerHTML='<i class="fa-solid fa-fire"></i>'; el.style.color='var(--text-gray)'; }
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
  if (typeof updateDailyQuestsBadge === 'function') updateDailyQuestsBadge();
  renderDailyGoal();
  if (map[today] === DAILY_GOAL) setTimeout(launchConfetti, 400);
}

function decrementDailyCount() {
  const today = todayStr();
  const map   = loadJSON('activityMap', {});
  if (map[today] && map[today] > 0) {
    map[today]--;
    saveJSON('activityMap', map);
    if (window.saveProfileToCloud) window.saveProfileToCloud();
    renderDailyGoal();
  }
}

function renderDailyGoal() {
  const count = getDailyCount();
  const pct   = Math.min((count / DAILY_GOAL) * 100, 100);
  const ring  = document.getElementById('goalRing');
  const txt   = document.getElementById('goalText');
  if (!ring) return;
  const circ = 100.53;
  ring.style.strokeDashoffset = circ - (pct / 100) * circ;
  ring.style.stroke = pct >= 100 ? 'var(--success)' : 'var(--accent)';
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
  const colors=['var(--star)','var(--accent)','var(--success)','var(--accent2)','var(--danger)','var(--header-grad)'];
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
function persistDictionary() {
  localStorage.setItem('lootlinguaDict', JSON.stringify(window.words));
  if (typeof evaluateTitleUnlocks === 'function') evaluateTitleUnlocks(false);
  refreshFeatureUnlockUI();
}

function saveAndRender() {
  persistDictionary();
  renderLimit = 20; // العودة للحد الأول عند الحفظ
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
    renderLimit = 20;
    btn.innerHTML = 'إضافة للقاموس <i class="fa-solid fa-floppy-disk"></i>';
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
    renderLimit = 20;
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
  btn.innerHTML = 'تحديث الكلمة <i class="fa-solid fa-floppy-disk"></i>';
  btn.style.background = 'var(--accent)';
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

    // البحث عن العنصر في الواجهة لعمل أنيميشن التلاشي قبل الحذف
    const li = document.querySelector(`[data-id="${pendingDeleteId}"]`)?.closest('.word-card');
    if (li) {
      li.style.transition = 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
      li.style.transform = 'scale(0.9) translateY(10px)';
      li.style.opacity = '0';
    }

    setTimeout(async () => {
      if (xpLoss > 0) { updateXP(-xpLoss); showXPBadge(xpLoss, null, true); }
      decrementDailyCount();
      window.words = window.words.filter(w => w.id !== pendingDeleteId);
      if (window.deleteWordFromCloud) await window.deleteWordFromCloud(pendingDeleteId);
      pendingDeleteId = null;
      document.querySelector('#deleteModal .xp-delete-warn')?.remove();
      
      // تحديث البيانات في الخلفية ورسم القائمة من جديد (بعد اكتمال الأنيميشن)
      localStorage.setItem('lootlinguaDict', JSON.stringify(window.words));
      if (currentView === 'starred') renderStarredWords();
      else render();
    }, 300);
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

  // تحديث البيانات في الخلفية بصمت
  localStorage.setItem('lootlinguaDict', JSON.stringify(window.words));
  if (window.updateWordInCloud) window.updateWordInCloud(id, { starred: word.starred });

  // تحديث شكل النجمة مباشرة في الـ DOM لتجنب الرمشة
  // تم استبدال currentTarget بـ target.closest لحل مشكلة تفويض الأحداث
  const btn = event?.target ? event.target.closest('.star-btn') : document.querySelector(`[data-id="${id}"][data-action="star"]`);
  if (btn) btn.classList.toggle('active', word.starred);

  // إذا كنا في عرض "الكلمات الصعبة" والكلمة لم تعد صعبة، نحذفها بأنيميشن
  if ((currentView === 'starred' || currentFilter === 'starred') && !word.starred) {
    const li = btn.closest('.word-card');
    if (li) {
      li.style.transition = 'all 0.4s ease';
      li.style.opacity = '0';
      li.style.transform = 'translateX(30px)';
      setTimeout(() => {
        li.remove();
        const list = document.getElementById('list');
        if (list && list.children.length === 0) render();
      }, 400);
    }
  }
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
const DICT_API_BASE = 'https://dictionary7-ayes.onrender.com';
const GUEST_LS_NORMAL = 'hasUsedNormalGuestShot';
const GUEST_LS_GAMER = 'hasUsedGamerGuestShot';

function isAiUserLoggedIn() {
  return !!window.auth?.currentUser;
}

function isGuestSearchLocked(type) {
  if (isAiUserLoggedIn()) return false;
  const key = type === 'gamer' ? GUEST_LS_GAMER : GUEST_LS_NORMAL;
  return localStorage.getItem(key) === '1';
}

function markGuestSearchUsed(type) {
  const key = type === 'gamer' ? GUEST_LS_GAMER : GUEST_LS_NORMAL;
  localStorage.setItem(key, '1');
  refreshGuestSearchLocks();
}

function clearGuestSearchLocks() {
  localStorage.removeItem(GUEST_LS_NORMAL);
  localStorage.removeItem(GUEST_LS_GAMER);
  refreshGuestSearchLocks();
}

function applySearchZoneLock(zoneEl, locked) {
  if (!zoneEl) return;
  zoneEl.classList.toggle('search-locked', locked);
  zoneEl.querySelectorAll('input, button, textarea, select').forEach((el) => {
    if (el.classList.contains('search-lock-overlay')) return;
    el.disabled = locked;
    if (locked) el.setAttribute('aria-disabled', 'true');
    else el.removeAttribute('aria-disabled');
  });
  const overlay = zoneEl.querySelector('.search-lock-overlay');
  if (overlay) overlay.setAttribute('aria-hidden', locked ? 'false' : 'true');
}

window.refreshGuestSearchLocks = function() {
  const loggedIn = isAiUserLoggedIn();
  applySearchZoneLock(document.getElementById('normalSearchZone'), !loggedIn && isGuestSearchLocked('normal'));
  applySearchZoneLock(document.getElementById('gamerAiSearchZone'), !loggedIn && isGuestSearchLocked('gamer'));
  applySearchZoneLock(document.getElementById('gamerMeaningBubble'), !loggedIn && isGuestSearchLocked('gamer'));
};

function showGuestTrialBlocked() {
  pushNotification('استنفدت تجربتك المجانية يا بطل! سجل دخولك لفتح قوة الذكاء الاصطناعي بلا حدود 🚀', 'warning');
  const modal = document.getElementById('profileModal');
  if (typeof window.toggleProfileModal === 'function' && modal && !modal.classList.contains('open')) {
    window.toggleProfileModal();
  }
}

function showSearchLockRegisterHint() {
  pushNotification('عذراً يا بطل! ميزة البحث مخصصة للأساطير المسجلين فقط. سجل الآن مجاناً!', 'warning');
  const modal = document.getElementById('profileModal');
  if (typeof window.toggleProfileModal === 'function' && modal && !modal.classList.contains('open')) {
    window.toggleProfileModal();
  }
}

function guardGuestAiSearch(type) {
  if (isAiUserLoggedIn()) return true;
  if (isGuestSearchLocked(type)) {
    showGuestTrialBlocked();
    return false;
  }
  return true;
}

async function buildAiRequestHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  const user = window.auth?.currentUser;
  if (user) {
    try {
      const token = await user.getIdToken();
      headers.Authorization = `Bearer ${token}`;
    } catch (e) {
      console.warn('getIdToken failed:', e);
    }
  }
  return headers;
}

function bindSearchLockOverlays() {
  document.querySelectorAll('.search-zone .search-lock-overlay').forEach((overlay) => {
    if (overlay.dataset.bound) return;
    overlay.dataset.bound = '1';
    overlay.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!overlay.closest('.search-zone')?.classList.contains('search-locked')) return;
      showSearchLockRegisterHint();
    });
  });
}

/**
 * جلب معاني AI: كاش Firestore → API (بعد فحص الضيف/التوكن على السيرفر).
 */
async function fetchAiMeaningsWithCache(word, type) {
  const trimmed = String(word || '').trim();
  if (!trimmed) return { ok: false, data: [], error: 'empty' };

  if (!guardGuestAiSearch(type)) {
    const err = new Error('Forbidden');
    err.code = 403;
    throw err;
  }

  if (typeof window.getAiGlobalCache === 'function') {
    try {
      const cached = await window.getAiGlobalCache(trimmed, type);
      if (Array.isArray(cached) && cached.length) {
        return { ok: true, data: cached, fromCache: true };
      }
    } catch (e) {
      console.warn('fetchAiMeaningsWithCache: cache read', e);
    }
  }

  if (!guardGuestAiSearch(type)) {
    const err = new Error('Forbidden');
    err.code = 403;
    throw err;
  }

  const endpoint = type === 'gamer' ? '/api/gamer-dictionary' : '/api/dictionary';
  const headers = await buildAiRequestHeaders();
  const res = await fetch(`${DICT_API_BASE}${endpoint}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ word: trimmed }),
  });

  const payload = await res.json().catch(() => ({}));
  if (res.status === 403) {
    markGuestSearchUsed(type);
    showGuestTrialBlocked();
    const err = new Error('Forbidden');
    err.code = 403;
    throw err;
  }
  if (!res.ok) {
    if (res.status === 502 || res.status === 503 || res.status === 504) {
      throw new Error('sleeping');
    }
    throw new Error(payload.error || 'server error');
  }

  const data = Array.isArray(payload) ? payload : [];
  if (!isAiUserLoggedIn()) {
    markGuestSearchUsed(type);
  }
  if (data.length && typeof window.saveAiGlobalCache === 'function') {
    window.saveAiGlobalCache(trimmed, type, data).catch((e) => {
      console.warn('fetchAiMeaningsWithCache: cache save', e);
    });
  }

  return { ok: true, data, fromCache: false };
}

function clearGamerSuggestionsUI() {
  document.getElementById('gamerMeaningBubble')?.remove();
  document.getElementById('gamerSuggestionsPanel')?.remove();
}

function clearGameGamerAiPanel() {
  const panel = document.getElementById('gameGamerAiPanel');
  if (panel) {
    panel.style.display = 'none';
    panel.innerHTML = '';
  }
}

function sugAttr(str) {
  return encodeURIComponent(String(str ?? ''));
}

function decodeSugAttr(str) {
  if (str == null || str === '') return '';
  try { return decodeURIComponent(String(str)); } catch { return String(str); }
}

function pickSuggestionFields(s) {
  return {
    ar: s.ar || s.arabic || s.meaning_ar || s.translation || s.meaning || '',
    pos: s.pos || s.partOfSpeech || s.category || 'مصطلح ألعاب',
    ex: s.ex || s.example || s.sentence || '',
    game: s.game || '',
  };
}

function getSuggestionGameLabel() {
  if (currentView === 'minecraft') return 'Minecraft';
  if (currentView === 'pubg') return 'PUBG';
  return '';
}

window.submitSuggestionFromUI = async function(wordEnc, arEnc, gameEnc, ev) {
  if (ev) { ev.preventDefault(); ev.stopPropagation(); }
  if (!rateLimit('submitSuggestion', 10, 60000)) return;
  if (typeof window.submitWordSuggestion !== 'function') {
    pushNotification('خدمة الاقتراحات غير جاهزة. حدّث الصفحة.', 'warning');
    return;
  }
  const user = window.auth?.currentUser;
  if (!user) {
    pushNotification('سجل دخولك أولاً يا بطل عشان تقدر ترسل اقتراحك! 🚀', 'warning');
    const profileModal = document.getElementById('profileModal');
    if (typeof window.toggleProfileModal === 'function' && profileModal && !profileModal.classList.contains('open')) {
      window.toggleProfileModal();
    }
    return;
  }
  const word = decodeSugAttr(wordEnc);
  const ar = decodeSugAttr(arEnc);
  const game = decodeSugAttr(gameEnc);
  const btn = ev?.currentTarget;
  if (btn) { btn.disabled = true; btn.classList.add('loading'); }
  const result = await window.submitWordSuggestion({ word, ar, game });
  if (btn) { btn.disabled = false; btn.classList.remove('loading'); }
  if (result?.ok) {
    pushNotification('وصل الاقتراح لغرفة العمليات.. كفو يا أسطورة! 🔥', 'success');
  } else {
    pushNotification(result?.error || 'ما قدرنا نرسل الاقتراح.', 'danger');
  }
};

async function addAiMeaningCore({ word, ar, pos, ex, game }, btn) {
  if (!word || !ar) {
    pushNotification('بيانات ناقصة للإضافة', 'warning');
    return;
  }
  if (wordExists(word)) {
    pushNotification('هذه الكلمة موجودة أصلاً بقاموسك', 'warning');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-check" aria-hidden="true"></i><span>مضافة مسبقاً</span>';
      btn.classList.add('sug-added');
    }
    return;
  }
  if (!rateLimit('addAiMeaningToPersonal', 12, 30000)) return;

  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; }

  const xpGain = 3;
  const inGameDict = currentView === 'minecraft' || currentView === 'pubg';
  const category = inGameDict ? (game || 'لعبة') : (pos || 'مصطلح ألعاب');
  let added = false;

  try {
    if (window.saveWordToCloud) {
      const realId = await window.saveWordToCloud(word, category, ar, ex || '');
      if (realId) {
        window.words.unshift({
          id: realId, word, meaning: ar, example: ex || '', category,
          starred: false, forgetCount: 0, xpValue: xpGain,
        });
        persistDictionary();
        if (currentView === 'personal') render();
        updateXP(xpGain);
        showXPBadge(xpGain, null, false);
        checkAndUpdateStreak();
        incrementDailyCount();
        if (inGameDict && typeof recordGameDictionaryAdd === 'function') recordGameDictionaryAdd();
        pushNotification('تمت الإضافة لقاموسك الشخصي!', 'success');
        added = true;
      } else {
        const nw = { id: Date.now().toString(), word, meaning: ar, example: ex || '', category, starred: false, forgetCount: 0, xpValue: xpGain };
        window.words.unshift(nw);
        persistDictionary();
        if (currentView === 'personal') render();
        updateXP(xpGain);
        if (inGameDict && typeof recordGameDictionaryAdd === 'function') recordGameDictionaryAdd();
        pushNotification('تمت الإضافة محلياً — سجّل دخول للمزامنة', 'success');
        added = true;
      }
    } else {
      const nw = { id: Date.now().toString(), word, meaning: ar, example: ex || '', category, starred: false, forgetCount: 0, xpValue: xpGain };
      window.words.unshift(nw);
      persistDictionary();
      if (currentView === 'personal') render();
      updateXP(xpGain);
      if (inGameDict && typeof recordGameDictionaryAdd === 'function') recordGameDictionaryAdd();
      pushNotification('تمت الإضافة لقاموسك الشخصي!', 'success');
      added = true;
    }
    if (added && btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-check" aria-hidden="true"></i><span>تمت الإضافة</span>';
      btn.classList.add('sug-added');
    }
  } catch (err) {
    console.error('addAiMeaningCore:', err);
    pushNotification('ما قدرنا نضيف الكلمة. جرّب مرة ثانية.', 'danger');
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-book" aria-hidden="true"></i><span>إضافة للقاموسك الشخصي</span>';
    }
  }
}

window.addAiMeaningToPersonal = async function(wordEnc, arEnc, posEnc, exEnc, ev) {
  if (ev) { ev.preventDefault(); ev.stopPropagation(); }
  await addAiMeaningCore({
    word: decodeSugAttr(wordEnc),
    ar: decodeSugAttr(arEnc),
    pos: decodeSugAttr(posEnc),
    ex: decodeSugAttr(exEnc),
    game: getSuggestionGameLabel(),
  }, ev?.currentTarget);
};

function injectGamerMeaningBubble() {
  const list = document.getElementById('suggestionsList');
  const box = document.getElementById('suggestionsBox');
  if (!list || !box || !list.querySelector('.sug-item')) return;

  clearGamerSuggestionsUI();

  const bubble = document.createElement('div');
  bubble.id = 'gamerMeaningBubble';
  bubble.className = 'gamer-meaning-bubble search-zone';
  bubble.setAttribute('data-search-type', 'gamer');
  bubble.innerHTML = `
    <button type="button" class="gamer-meaning-btn" onclick="fetchGamerSuggestions()">
      <span class="gamer-meaning-icon" aria-hidden="true"><i class="fa-solid fa-gamepad"></i></span>
      <span class="gamer-meaning-text">
        <strong>معنى ألعاب؟</strong>
        <span>طيّب شوف الترجمة الصح (جيمر → جيمر)</span>
      </span>
      <i class="fa-solid fa-chevron-up gamer-meaning-chevron" aria-hidden="true"></i>
    </button>
    <button type="button" class="search-lock-overlay" aria-label="بحث الألعاب مقفل — سجّل دخولك" tabindex="-1">
      <i class="fa-solid fa-lock" aria-hidden="true"></i>
    </button>`;
  list.insertAdjacentElement('afterend', bubble);
  refreshGuestSearchLocks();
  bindSearchLockOverlays();
}

function renderSuggestionHtml(suggestions, itemClass, options = {}) {
  const {
    sourceWord = window.__lastDictSearchWord || '',
    game = getSuggestionGameLabel(),
    allowSelect = true,
    listSelector = '',
  } = options;

  const wordEnc = sugAttr(sourceWord);
  let html = '';

  suggestions.forEach((s, i) => {
    const fields = pickSuggestionFields(s);
    const safeAr = fields.ar.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const safeEx = fields.ex.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const safePos = fields.pos.replace(/'/g, "\\'");
    const arEsc = escapeHtml(fields.ar);
    const posEsc = escapeHtml(fields.pos);
    const exEsc = escapeHtml(fields.ex);
    const exArEsc = escapeHtml(s.ex_ar || '');
    const gameTag = escapeHtml(fields.game || game || '');
    const starsNum = Math.max(1, Math.min(3, Number(s.stars) || 1));
    const starsHtml = '★'.repeat(starsNum) + '☆'.repeat(3 - starsNum);
    const extraClass = i >= 4 ? 'extra-meaning' : '';
    const extraStyle = i >= 4 ? 'style="display:none"' : '';
    const itemGameEnc = sugAttr(fields.game || game || '');
    const click = allowSelect
      ? `onclick="selectSuggestion('${safeAr}','${safePos}','${safeEx}')"`
      : '';

    html += `
      <div class="sug-result-card ${extraClass}" ${extraStyle}>
        <div class="${itemClass} sug-item ${allowSelect ? 'sug-item-clickable' : ''}" ${click}>
          <div class="sug-main">
            <span class="sug-ar">${arEsc}</span>
            <span class="sug-pos">${posEsc}</span>
            ${gameTag ? `<span class="sug-game-tag">${gameTag}</span>` : ''}
          </div>
          <div class="sug-stars">${starsHtml}</div>
          ${fields.ex ? `
            <div class="sug-ex">
              <div class="sug-ex-en">"${exEsc}"</div>
              ${exArEsc ? `<div class="sug-ex-ar">${exArEsc}</div>` : ''}
            </div>
          ` : ''}
        </div>
        <div class="sug-actions">
          <button type="button" class="sug-gamer-action-btn sug-add-personal-btn" data-action="add-ai-meaning"
            data-word="${wordEnc}" data-ar="${sugAttr(fields.ar)}" data-pos="${sugAttr(fields.pos)}" data-ex="${sugAttr(fields.ex)}" data-game="${itemGameEnc}">
            <i class="fa-solid fa-book" aria-hidden="true"></i>
            <span>إضافة للقاموسك الشخصي</span>
          </button>
          <button type="button" class="sug-gamer-action-btn sug-suggest-btn" data-action="submit-suggestion"
            title="اقترح إضافة هذه الكلمة للموقع"
            aria-label="اقترح إضافة للموقع"
            data-word="${wordEnc}" data-ar="${sugAttr(fields.ar)}" data-game="${itemGameEnc}">
            <i class="fa-solid fa-lightbulb" aria-hidden="true"></i>
          </button>
        </div>
      </div>`;
  });

  if (listSelector && suggestions.length > 4) {
    html += `<div class="sug-toggle gamer-sug-toggle"
      onclick="const e=document.querySelectorAll('${listSelector} .extra-meaning'),h=e[0]&&e[0].style.display==='none';e.forEach(x=>x.style.display=h?'block':'none');this.innerHTML=h?'عرض أقل ▲':'عرض المزيد (${suggestions.length - 4}) ▼'">
      عرض المزيد (${suggestions.length - 4}) ▼</div>`;
  }

  return html;
}

window.fetchGamerSuggestions = async function() {
  const word = window.__lastDictSearchWord || document.getElementById('wordInput')?.value.trim();
  if (!word) {
    showToast('اكتب كلمة وابحث أولاً!');
    return;
  }
  if (!guardGuestAiSearch('gamer')) return;
  if (!rateLimit('fetchGamerSuggestions', 4, 45000)) return;

  const bubbleBtn = document.querySelector('#gamerMeaningBubble .gamer-meaning-btn');
  let panel = document.getElementById('gamerSuggestionsPanel');

  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'gamerSuggestionsPanel';
    panel.className = 'gamer-suggestions-panel';
    document.getElementById('gamerMeaningBubble')?.insertAdjacentElement('afterend', panel);
  }

  if (bubbleBtn) {
    bubbleBtn.disabled = true;
    bubbleBtn.classList.add('loading');
  }
  panel.style.display = 'block';
  panel.innerHTML = '<p class="gamer-suggestions-loading"><i class="fas fa-spinner fa-spin"></i> جاري جلب معنى الألعاب...</p>';

  try {
    const { data, fromCache } = await fetchAiMeaningsWithCache(word, 'gamer');
    if (!data.length) {
      panel.innerHTML = '<p class="gamer-suggestions-empty">ما لقينا معنى ألعاب واضح لهالكلمة.</p>';
      return;
    }

    const cacheNote = fromCache
      ? ' <span class="ai-cache-tag">من الذاكرة المشتركة</span>'
      : '';
    let html = `<p class="gamer-suggestions-title"><i class="fa-solid fa-gamepad"></i> معنى الألعاب (جيمر → جيمر)${cacheNote}</p>`;
    html += '<div class="gamer-suggestions-results">';
    html += renderSuggestionHtml(data, 'gamer-sug-item', {
      sourceWord: word,
      game: getSuggestionGameLabel() || 'ألعاب',
      allowSelect: true,
      listSelector: '.gamer-suggestions-results',
    });
    html += '</div>';
    panel.innerHTML = html;
  } catch (err) {
    if (err.code === 403) return;
    const msg = err.message === 'sleeping' || String(err.message).includes('fetch')
      ? 'السيرفر كان نايم.. جرّب بعد شوي.'
      : (err.message || 'فشل جلب معنى الألعاب');
    panel.innerHTML = `<p class="gamer-suggestions-error">${escapeHtml(msg)}</p>`;
  } finally {
    if (bubbleBtn) {
      bubbleBtn.disabled = false;
      bubbleBtn.classList.remove('loading');
    }
  }
};

window.fetchSuggestions = async function() {
  const word = document.getElementById('wordInput')?.value.trim();

  if (!word) {
    showToast("اكتب الكلمة أولاً!");
    return;
  }

  if (!guardGuestAiSearch('normal')) return;
  // Spam protection: max 5 requests per 30 seconds
  if (!rateLimit('fetchSuggestions', 5, 30000)) return;
  const btn  = document.getElementById('searchBtn');
  const box  = document.getElementById('suggestionsBox');
  const list = document.getElementById('suggestionsList');

  btn.innerHTML = "<i class='fas fa-spinner fa-spin'></i>";
  btn.disabled  = true;
  clearGamerSuggestionsUI();
  if (box) box.style.display = 'block';
  
  const loadingTimers = [];
  const setLoadingMessage = (message) => {
    if (!list) return;
    list.innerHTML = `<p style="text-align:center;font-size:12px;color:var(--text-gray);padding:10px;line-height:1.8;">${message}</p>`;
  };

  setLoadingMessage('جاري البحث... لحظة وبنجيب المعاني.');
  loadingTimers.push(setTimeout(() => setLoadingMessage('استنى شوي.. هي المعاني بترسبن!'), 7000));
  loadingTimers.push(setTimeout(() => setLoadingMessage('في تأخير بسيط في الرسبون.. السيرفر يمكن كان نايم.'), 14000));
  loadingTimers.push(setTimeout(() => setLoadingMessage('لسه بنحاول.. لا تطلع من اللوبي.'), 22000));

  try {
    const { data: suggestions, fromCache } = await fetchAiMeaningsWithCache(word, 'normal');
    window.__lastDictSearchWord = word;

    if (!suggestions.length) {
      list.innerHTML = '<p style="text-align:center;font-size:12px;color:var(--text-gray);padding:10px;">ما لقينا معاني لهالكلمة.</p>';
      return;
    }

    if (fromCache) {
      loadingTimers.forEach(clearTimeout);
      setLoadingMessage('تم العثور على معاني محفوظة مسبقاً!');
    }

    let html = '<div class="dict-suggestions-results">';
    html += renderSuggestionHtml(suggestions, 'sug-item', {
      sourceWord: word,
      game: '',
      allowSelect: true,
      listSelector: '.dict-suggestions-results',
    });
    html += '</div>';
    list.innerHTML = html;
    injectGamerMeaningBubble();

  } catch (error) {
    if (error.code === 403) return;
    console.error("Frontend Error:", error);
    
    // التعامل مع الأخطاء بطريقة مريحة للمستخدم
    if (error.message === "sleeping" || error.message.includes("fetch")) {
         list.innerHTML = "<p style='color:var(--warning);text-align:center;font-size:12px;padding:10px;'>السيرفر كان في وضع السكون ويستيقظ الآن.. جرب الضغط على بحث مرة أخرى بعد ثوانٍ</p>";
    } else {
         list.innerHTML = "<p style='color:var(--danger);text-align:center;font-size:12px;padding:10px;'>فشل في جلب البيانات من السيرفر</p>";
    }
  } finally {
    loadingTimers.forEach(clearTimeout);
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
  clearGamerSuggestionsUI();
}

window.openGameGamerAiSearch = function() {
  if (!guardGuestAiSearch('gamer')) return;
  const input = document.getElementById('gameSearchInput');
  const word = (input?.value || '').trim();
  if (!word) {
    showToast('اكتب المصطلح اللي بدك تسأل عنه بالإنجليزي');
    input?.focus();
    return;
  }
  fetchGameGamerSuggestions(word);
};

window.fetchGameGamerSuggestions = async function(forcedWord) {
  const word = (forcedWord || document.getElementById('gameSearchInput')?.value || '').trim();
  if (!word) {
    showToast('اكتب كلمة أولاً');
    return;
  }
  if (!guardGuestAiSearch('gamer')) return;
  if (!rateLimit('fetchGameGamerSuggestions', 4, 45000)) return;

  const panel = document.getElementById('gameGamerAiPanel');
  const askBtn = document.querySelector('.game-gamer-ask-btn');
  if (!panel) return;

  if (askBtn) { askBtn.disabled = true; askBtn.classList.add('loading'); }
  panel.style.display = 'block';
  panel.innerHTML = '<p class="gamer-suggestions-loading"><i class="fas fa-spinner fa-spin"></i> جاري سؤال الـ AI عن معنى الألعاب...</p>';

  const gameLabel = getSuggestionGameLabel() || 'ألعاب';

  try {
    const { data, fromCache } = await fetchAiMeaningsWithCache(word, 'gamer');
    if (!data.length) {
      panel.innerHTML = '<p class="gamer-suggestions-empty">ما لقينا معنى جيمر واضح. جرّب تهجئة ثانية أو كلمة ثانية.</p>';
      return;
    }

    const cacheNote = fromCache
      ? ' <span class="ai-cache-tag">من الذاكرة المشتركة</span>'
      : '';
    let html = `<p class="gamer-suggestions-title"><i class="fa-solid fa-gamepad"></i> نتائج AI — ${escapeHtml(gameLabel)}${cacheNote}</p>`;
    html += '<div class="game-gamer-results">';
    html += renderSuggestionHtml(data, 'gamer-sug-item', {
      sourceWord: word,
      game: gameLabel,
      allowSelect: false,
      listSelector: '.game-gamer-results',
    });
    html += '</div>';
    panel.innerHTML = html;
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch (err) {
    if (err.code === 403) return;
    const msg = String(err.message || '').includes('fetch') || err.message === 'sleeping'
      ? 'السيرفر كان نايم.. جرّب بعد شوي.'
      : (err.message || 'فشل جلب معنى الألعاب');
    panel.innerHTML = `<p class="gamer-suggestions-error">${escapeHtml(msg)}</p>`;
  } finally {
    if (askBtn) { askBtn.disabled = false; askBtn.classList.remove('loading'); }
  }
};

// ═══════════════════════════════════════════════════════
// Filter
// ═══════════════════════════════════════════════════════
function setFilter(f) {
  currentFilter = f;
  renderLimit = 20; // إعادة التصفير عند تغيير الفلتر
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
    // حفظ حالة الفتح في مصفوفة الكلمات الأصلية
    const word = window.words[index];
    if (word) {
      word.expanded = !word.expanded;
      localStorage.setItem('lootlinguaDict', JSON.stringify(window.words));
      // تحديث الكلاس مباشرة لتوسيع/إغلاق البطاقة بدون إعادة رسم القائمة
      el.classList.toggle('show-example', word.expanded);
    }
  }
}

function showBackupHelp(type, event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }

  const messages = {
    export: 'التصدير يحفظ نسخة من كلماتك كملف JSON. تقدر تنقله لجهاز ثاني، تحتفظ فيه كنسخة أمان، أو تشاركه مع شخص تثق فيه.',
    import: 'الاستيراد يقرأ ملف JSON سبق وطلعته من LootLingua، ويدمج كلماته مع قاموسك بدون تكرار الكلمات الموجودة.',
  };

  const old = document.querySelector('.backup-help-popover');
  if (old) old.remove();

  const pop = document.createElement('div');
  pop.className = 'backup-help-popover';
  pop.textContent = messages[type] || 'هذه الأداة تساعدك تحفظ قاموسك أو ترجعه وقت الحاجة.';
  document.body.appendChild(pop);

  const btn = event?.currentTarget;
  const rect = btn?.getBoundingClientRect();
  if (rect) {
    const gap = 10;
    const top = rect.top - pop.offsetHeight - gap;
    pop.style.top = `${Math.max(12, top)}px`;
    pop.style.left = `${Math.min(window.innerWidth - pop.offsetWidth - 12, Math.max(12, rect.left + rect.width / 2 - pop.offsetWidth / 2))}px`;
  }

  const close = (e) => {
    if (e?.target === btn || pop.contains(e?.target)) return;
    pop.remove();
    document.removeEventListener('click', close, true);
  };
  setTimeout(() => document.addEventListener('click', close, true), 0);
  setTimeout(() => {
    pop.remove();
    document.removeEventListener('click', close, true);
  }, 6500);
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
// Treasure Loot & Titles
// ═══════════════════════════════════════════════════════
const LOOT_BOX_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const LOOT_STATE_KEY = 'lootlinguaDailyLootState';
const TITLE_STATE_KEY = 'lootlinguaTitlesState';
const STREAK_FREEZE_KEY = 'lootlinguaStreakFreezes';
const FREEZE_SAVES_KEY = 'lootlinguaFreezeSaves';
const GAME_DICT_ADDS_KEY = 'lootlinguaGameDictAdds';
const EXTRA_CHESTS_KEY = 'lootlinguaExtraChests';

const TITLE_DEFS = [
  {
    id: 'first_spark',
    icon: 'fa-solid fa-bolt',
    name: 'أول شرارة',
    how: 'افتح أول صندوق يومي.',
    unlocked: () => getLootState().totalOpens >= 1,
  },
  {
    id: 'loot_hunter',
    icon: 'fa-solid fa-box-open',
    name: 'صياد اللوت',
    how: 'افتح 7 صناديق يومية متتالية.',
    unlocked: () => getLootState().streak >= 7,
  },
  {
    id: 'streak_savior',
    icon: 'fa-solid fa-shield-halved',
    name: 'درع الستريك',
    how: 'خلّي Streak Freeze ينقذ سلسلتك مرة واحدة.',
    unlocked: () => loadInt(FREEZE_SAVES_KEY, 0) >= 1,
  },
  {
    id: 'game_explorer',
    icon: 'fa-solid fa-dice-d20',
    name: 'رحّالة الألعاب',
    how: 'أضف كلمة من أي قاموس ألعاب إلى قاموسك.',
    unlocked: () => loadInt(GAME_DICT_ADDS_KEY, 0) >= 1,
  },
  {
    id: 'word_collector',
    icon: 'fa-solid fa-layer-group',
    name: 'جامع الكلمات',
    how: 'اجمع 25 كلمة في قاموسك.',
    unlocked: () => window.words.length >= 25,
  },
  {
    id: 'dictionary_keeper',
    icon: 'fa-solid fa-book-bookmark',
    name: 'أمين القاموس',
    how: 'وصل قاموسك إلى 50 كلمة.',
    unlocked: () => window.words.length >= 50,
  },
  {
    id: 'star_chaser',
    icon: 'fa-solid fa-star',
    name: 'صائد الصعب',
    how: 'علّم 10 كلمات ككلمات صعبة.',
    unlocked: () => window.words.filter(w => w.starred).length >= 10,
  },
  {
    id: 'strategist',
    icon: 'fa-solid fa-chess-knight',
    name: 'الخبير الاستراتيجي',
    how: 'أنهِ 10 اختبارات كاملة بدون ولا غلطة.',
    unlocked: () => loadInt('lootlinguaPerfectQuizzes', 0) >= 10,
  },
  {
    id: 'streak_guard',
    icon: 'fa-solid fa-fire-flame-curved',
    name: 'لهيب الأسبوع',
    how: 'حافظ على Streak لمدة 7 أيام.',
    unlocked: () => loadInt('dailyStreak', 0) >= 7,
  },
  {
    id: 'level_climber',
    icon: 'fa-solid fa-mountain-sun',
    name: 'متسلّق المستويات',
    how: 'وصل إلى Level 5.',
    unlocked: () => getLevelFromXP(loadInt('userXP', 0)) >= 5,
  },
];

function getLootState() {
  return loadJSON(LOOT_STATE_KEY, { lastOpenAt: 0, streak: 0, totalOpens: 0, lastOpenDay: '', rewards: [], freezesEarned: 0 });
}

function saveLootState(state) {
  saveJSON(LOOT_STATE_KEY, state);
}

function getTitleState() {
  return loadJSON(TITLE_STATE_KEY, { unlocked: [], lastUnlockedAt: {} });
}

function saveTitleState(state) {
  saveJSON(TITLE_STATE_KEY, state);
}

function formatLootTime(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}س ${String(m).padStart(2, '0')}د`;
  if (m > 0) return `${m}د ${String(s).padStart(2, '0')}ث`;
  return `${s}ث`;
}

function getLootAvailability() {
  const state = getLootState();
  const nextAt = (state.lastOpenAt || 0) + LOOT_BOX_COOLDOWN_MS;
  const remaining = nextAt - Date.now();
  return { state, ready: !state.lastOpenAt || remaining <= 0, remaining: Math.max(0, remaining) };
}

function pickDailyLootReward() {
  const roll = Math.random();
  if (roll < 0.04) return { type: 'freeze', freezes: 1, label: 'Streak Freeze نادر' };
  if (roll < 0.58) return { type: 'xp', xp: 5 + Math.floor(Math.random() * 16), label: 'XP سريع' };
  if (roll < 0.88) return { type: 'xp', xp: 21 + Math.floor(Math.random() * 20), label: 'XP محترم' };
  return { type: 'xp', xp: 41 + Math.floor(Math.random() * 10), label: 'ضربة ذهبية' };
}

function updateLootStreak(state) {
  const today = todayStr();
  const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  if (state.lastOpenDay === today) return state.streak || 0;
  if (state.lastOpenDay === yesterday) return (state.streak || 0) + 1;
  return 1;
}

function getStreakFreezeCount() {
  return loadInt(STREAK_FREEZE_KEY, 0);
}

function saveStreakFreezeCount(count) {
  saveInt(STREAK_FREEZE_KEY, Math.max(0, Number(count) || 0));
}

function recordGameDictionaryAdd() {
  saveInt(GAME_DICT_ADDS_KEY, loadInt(GAME_DICT_ADDS_KEY, 0) + 1);
  if (typeof evaluateTitleUnlocks === 'function') evaluateTitleUnlocks(true);
  if (window.saveProfileToCloud) window.saveProfileToCloud();
}

function describeLootReward(reward) {
  if (!reward) return 'لوت غامض';
  if (reward.type === 'freeze') return `${reward.label}: يحمي الستريك يوم غياب واحد`;
  return `${reward.label} +${reward.xp || 0} XP`;
}

function revealDailyLootReward(state, reward) {
  state.streak = updateLootStreak(state);
  state.totalOpens = (state.totalOpens || 0) + 1;
  state.lastOpenAt = Date.now();
  state.lastOpenDay = todayStr();
  if (reward.type === 'freeze') {
    saveStreakFreezeCount(getStreakFreezeCount() + (reward.freezes || 1));
    state.freezesEarned = (state.freezesEarned || 0) + (reward.freezes || 1);
  }
  state.rewards = [{ at: state.lastOpenAt, ...reward }, ...(state.rewards || [])].slice(0, 12);
  saveLootState(state);

  if (reward.xp) {
    updateXP(reward.xp);
    showXPBadge(reward.xp, 'dailyLootChest', false);
  }
  launchConfetti();
  setTimeout(() => showToast(`طلع لك: ${describeLootReward(reward)}`, 'success', 5600), 90);
  evaluateTitleUnlocks(true);
  markDailyQuestFlag('openLoot');
  updateDailyQuestsBadge();
  renderTreasureRoom();
  if (window.saveProfileToCloud) window.saveProfileToCloud();
}

window.startLootChestCharge = function(event) {
  if (event) event.preventDefault();
  const chest = document.getElementById('dailyLootChest');
  const preview = document.getElementById('lootRewardPreview');
  const availability = getLootAvailability();
  if (!availability.ready) {
    window.openDailyLootBox();
    return;
  }
  if (window.__lootOpening || window.__lootHoldTimer) return;
  chest?.classList.add('is-charging');
  if (preview) preview.textContent = 'ثبّت ضغطتك شوي... الصندوق بدأ يتشقق.';
  window.__lootHoldTimer = setTimeout(() => {
    window.__lootHoldTimer = null;
    window.openDailyLootBox();
  }, 820);
};

window.releaseLootChestCharge = function(event) {
  if (event) event.preventDefault();
  if (!window.__lootHoldTimer) return;
  clearTimeout(window.__lootHoldTimer);
  window.__lootHoldTimer = null;
  document.getElementById('dailyLootChest')?.classList.remove('is-charging');
  const preview = document.getElementById('lootRewardPreview');
  if (preview) preview.textContent = 'ثبّت الضغط شوي عشان الصندوق يفقع.';
};

window.cancelLootChestCharge = function(event) {
  window.releaseLootChestCharge(event);
};

window.openDailyLootBox = function() {
  const availability = getLootAvailability();
  if (!availability.ready) {
    showToast(`الصندوق يستنى الرسبون: ${formatLootTime(availability.remaining)}`, 'info', 3600);
    renderTreasureRoom();
    return;
  }
  if (window.__lootOpening) return;
  window.__lootOpening = true;
  clearTimeout(window.__lootHoldTimer);
  window.__lootHoldTimer = null;
  const chest = document.getElementById('dailyLootChest');
  const preview = document.getElementById('lootRewardPreview');
  chest?.classList.remove('is-charging');
  chest?.classList.add('is-opening');
  if (preview) preview.textContent = 'الصندوق فتح... بنفرز اللوت الآن!';
  const state = availability.state;
  const reward = pickDailyLootReward();
  setTimeout(() => {
    revealDailyLootReward(state, reward);
    chest?.classList.remove('is-opening');
    window.__lootOpening = false;
  }, 900);
};

function getTitleProgress(def) {
  const loot = getLootState();
  const words = Array.isArray(window.words) ? window.words : [];
  const starred = words.filter(w => w.starred).length;
  const perfect = loadInt('lootlinguaPerfectQuizzes', 0);
  const freezeSaves = loadInt(FREEZE_SAVES_KEY, 0);
  const gameAdds = loadInt(GAME_DICT_ADDS_KEY, 0);
  const level = getLevelFromXP(loadInt('userXP', 0));
  const streak = loadInt('dailyStreak', 0);
  const map = {
    first_spark: `${Math.min(loot.totalOpens || 0, 1)} / 1`,
    loot_hunter: `${Math.min(loot.streak || 0, 7)} / 7`,
    streak_savior: `${Math.min(freezeSaves, 1)} / 1`,
    game_explorer: `${Math.min(gameAdds, 1)} / 1`,
    word_collector: `${Math.min(words.length, 25)} / 25`,
    dictionary_keeper: `${Math.min(words.length, 50)} / 50`,
    star_chaser: `${Math.min(starred, 10)} / 10`,
    strategist: `${Math.min(perfect, 10)} / 10`,
    streak_guard: `${Math.min(streak, 7)} / 7`,
    level_climber: `${Math.min(level, 5)} / 5`,
  };
  return map[def.id] || '';
}

function evaluateTitleUnlocks(celebrate = false) {
  const state = getTitleState();
  const unlocked = new Set(state.unlocked || []);
  const newly = [];
  TITLE_DEFS.forEach(def => {
    if (!unlocked.has(def.id) && def.unlocked()) {
      unlocked.add(def.id);
      state.lastUnlockedAt[def.id] = Date.now();
      newly.push(def);
    }
  });
  state.unlocked = [...unlocked];
  saveTitleState(state);
  if (newly.length && window.saveProfileToCloud) window.saveProfileToCloud();
  if (newly.length && celebrate) {
    const first = newly[0];
    launchConfetti();
    showToast(`لقب جديد: ${first.name}`, 'success', 5200);
  }
  renderTitlesGrid();
  return newly;
}

function renderTitlesGrid() {
  const grid = document.getElementById('titlesGrid');
  if (!grid) return;
  const state = getTitleState();
  const unlocked = new Set(state.unlocked || []);
  const unlockedCount = TITLE_DEFS.filter(def => unlocked.has(def.id)).length;
  const progress = document.getElementById('titleProgressText');
  if (progress) progress.textContent = `فتحت ${unlockedCount} من ${TITLE_DEFS.length} ألقاب.`;
  grid.innerHTML = TITLE_DEFS.map(def => {
    const isUnlocked = unlocked.has(def.id);
    const cls = isUnlocked ? 'title-card unlocked' : 'title-card locked';
    const progressText = getTitleProgress(def);
    return `
      <article class="${cls}" title="${escapeHtml(def.how)}">
        <div class="title-icon"><i class="${def.icon}" aria-hidden="true"></i></div>
        <div class="title-info">
          <h3>${escapeHtml(isUnlocked ? def.name : 'لقب مخفي')}</h3>
          <p>${escapeHtml(def.how)}</p>
          <span>${escapeHtml(progressText)}</span>
        </div>
      </article>`;
  }).join('');
}

function renderLootSummary() {
  const { state, ready, remaining } = getLootAvailability();
  const chest = document.getElementById('dailyLootChest');
  const status = document.getElementById('lootStatusText');
  const count = document.getElementById('lootCountdownText');
  const preview = document.getElementById('lootRewardPreview');
  const slots = document.getElementById('treasureSlots');
  if (chest) chest.classList.toggle('is-locked', !ready);
  if (status) status.innerHTML = ready
    ? '<i class="fa-solid fa-box-open" aria-hidden="true"></i> الصندوق اليومي جاهز'
    : '<i class="fa-regular fa-clock" aria-hidden="true"></i> الصندوق يرجع بعد';
  if (count) count.textContent = ready ? 'افتحه الآن' : formatLootTime(remaining);
  if (preview) {
    preview.textContent = ready
      ? 'فيه XP عشوائي، ومعه فرصة نادرة لـ Streak Freeze. ثبّت ضغطتك وافتحه.'
      : `سلسلة صناديقك: ${state.streak || 0} يوم | Freeze عندك: ${getStreakFreezeCount()} | مجموع الفتحات: ${state.totalOpens || 0}`;
  }
  if (slots) {
    const rewards = state.rewards || [];
    slots.innerHTML = `
      <article class="treasure-slot ${ready ? 'treasure-slot-ready' : 'treasure-slot-locked'}">
        <i class="fa-solid ${ready ? 'fa-box-open' : 'fa-lock'}" aria-hidden="true"></i>
        <h3>الصندوق اليومي</h3>
        <p>${ready ? 'جاهز للفتح الآن.' : 'مقفول مؤقتاً حتى الرسبون.'}</p>
      </article>
      <article class="treasure-slot">
        <i class="fa-solid fa-fire-flame-curved" aria-hidden="true"></i>
        <h3>سلسلة اللوت</h3>
        <p>${state.streak || 0} يوم متتالي | Freeze: ${getStreakFreezeCount()}.</p>
      </article>
      <article class="treasure-slot">
        <i class="fa-solid fa-medal" aria-hidden="true"></i>
        <h3>الألقاب المفتوحة</h3>
        <p>${getTitleState().unlocked?.length || 0} لقب حالياً.</p>
      </article>
      <article class="treasure-slot">
        <i class="fa-solid fa-scroll" aria-hidden="true"></i>
        <h3>آخر لوت</h3>
        <p>${rewards[0] ? describeLootReward(rewards[0]) : 'لسه ما فتحت ولا صندوق.'}</p>
      </article>`;
  }
}

function renderTreasureRoom() {
  evaluateTitleUnlocks(false);
  renderLootSummary();
  renderTitlesGrid();
  clearInterval(window.__lootCountdownTimer);
  window.__lootCountdownTimer = setInterval(() => {
    if (currentView !== 'treasure') {
      clearInterval(window.__lootCountdownTimer);
      return;
    }
    renderLootSummary();
  }, 1000);
}

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
const viewScrollY = { personal: 0, worlds: 0, minecraft: 0, pubg: 0, starred: 0, quiz: 0, treasure: 0 };

function saveCurrentViewScroll() {
  viewScrollY[currentView] = window.scrollY || window.pageYOffset || 0;
}

function restoreViewScroll(viewKey) {
  const targetY = viewScrollY[viewKey] || 0;
  requestAnimationFrame(() => {
    window.scrollTo({ top: targetY, behavior: 'auto' });
  });
}

function setTreasureMode(active) {
  document.body.classList.toggle('treasure-mode', Boolean(active));
  if (active) {
    closeSidebarIfOpen();
    document.getElementById('overlay')?.classList.remove('show');
  }
}

function setTreasureEntryVisible(visible) {
  document.body.classList.toggle('treasure-dock-visible', Boolean(visible));
  document.body.classList.toggle('legend-dock-visible', Boolean(visible));
  document.body.classList.remove('treasure-side-next-visible', 'treasure-side-back-visible');
  const dock = document.getElementById('legendDock') || document.getElementById('treasureDock');
  if (dock) dock.style.display = visible ? 'flex' : 'none';
}

function setTreasureDockActive(viewKey) {
  const dockKey = viewKey === 'minecraft' || viewKey === 'pubg' || viewKey === 'starred' ? 'worlds' : viewKey;
  document.querySelectorAll('#legendDock .treasure-dock-btn, #treasureDock .treasure-dock-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.dockView === dockKey);
  });
}

function unloadListForView(nextView) {
  const usesList = ['personal', 'starred', 'minecraft', 'pubg'];
  if (!usesList.includes(nextView)) {
    const list = document.getElementById('list');
    if (list) list.innerHTML = '';
  }
}

function animateTreasureRoute(direction) {
  document.body.classList.remove('treasure-route-next', 'treasure-route-back');
  void document.body.offsetWidth;
  document.body.classList.add(direction === 'back' ? 'treasure-route-back' : 'treasure-route-next');
  clearTimeout(window.__treasureRouteTimer);
  window.__treasureRouteTimer = setTimeout(() => {
    document.body.classList.remove('treasure-route-next', 'treasure-route-back');
  }, 360);
}

const WORLDS_VIEWS = new Set(['worlds', 'minecraft', 'pubg', 'starred']);

function animateWorldsRoute(direction) {
  document.body.classList.remove('worlds-route-next', 'worlds-route-back');
  void document.body.offsetWidth;
  document.body.classList.add(direction === 'back' ? 'worlds-route-back' : 'worlds-route-next');
  clearTimeout(window.__worldsRouteTimer);
  window.__worldsRouteTimer = setTimeout(() => {
    document.body.classList.remove('worlds-route-next', 'worlds-route-back');
  }, 360);
}

function unloadPersonalListForTreasure() {
  const list = document.getElementById('list');
  if (list) list.innerHTML = '';
}

let treasureSwipeStartX = null;
let treasureSwipeStartY = null;

function initTreasureSwipeNavigation() {
  if (window.__treasureSwipeReady) return;
  window.__treasureSwipeReady = true;
  document.addEventListener('touchstart', (event) => {
    if (!document.body.classList.contains('treasure-dock-visible')) return;
    const t = event.touches && event.touches[0];
    if (!t) return;
    treasureSwipeStartX = t.clientX;
    treasureSwipeStartY = t.clientY;
  }, { passive: true });
  document.addEventListener('touchend', (event) => {
    if (treasureSwipeStartX == null || treasureSwipeStartY == null) return;
    const t = event.changedTouches && event.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - treasureSwipeStartX;
    const dy = t.clientY - treasureSwipeStartY;
    treasureSwipeStartX = null;
    treasureSwipeStartY = null;
    if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.25) return;
    if (currentView === 'personal' && dx > 0) loadTreasureView();
    else if (currentView === 'treasure' && dx < 0) loadPersonalDictionary();
  }, { passive: true });
}

initTreasureSwipeNavigation();

window.loadGameDictionary = function(gameKey) {
  if (!isFeatureUnlocked(gameKey)) {
    openUnlockExplainModal(gameKey);
    refreshFeatureUnlockUI();
    return;
  }
  const fromPersonal = currentView === 'personal';
  const fromWorlds = currentView === 'worlds';
  if (fromPersonal || fromWorlds) animateWorldsRoute('next');
  beginViewSwitch();
  saveCurrentViewScroll();
  closeSidebarIfOpen();
  setTreasureMode(false);
  const game = gameData[gameKey];
  if (!game) return;

  unloadListForView(gameKey);
  currentView      = gameKey;
  currentGameWords = [...game.words];
  viewBackTarget = 'worlds';

  setActiveNavLink(gameKey);
  document.body.classList.add('game-bg-active');
  document.body.setAttribute('data-game', gameKey);

  hideAllViewElements();
  setViewBackBar(true, 'رجوع لعوالم الأساطير');
  setTreasureEntryVisible(true);
  setTreasureDockActive('worlds');
  document.getElementById('list').style.display = '';

  // إظهار search bar الألعاب وتفريغه
  const gameSearch = document.getElementById('gameSearchBar');
  gameSearch.style.display = 'block';
  gameSearch.querySelector('input').value = '';

  // تحديث العنوان
  document.querySelector('.page-header h1').innerHTML =
    `<img src="${game.titleIcon}" width="24" height="24" style="vertical-align:middle;margin-left:6px;" alt=""> ${game.title}`;

  clearGameGamerAiPanel();
  renderGameWords(currentGameWords);
  restoreViewScroll(gameKey);
  refreshFeatureUnlockUI();
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
    ? `<li class="game-empty-search" style="list-style:none;">
         <div class="game-empty-icon">🔍</div>
         <p>ما لقيت مصطلحك بالقاموس</p>
         <p class="game-empty-hint">ما لقيته؟ استخدم زر «اسأل الـ AI» فوق عشان تبحث عن معنى أي مصطلح.</p>
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
  clearGameGamerAiPanel();
  renderGameWords(currentGameWords);
};

// ── Hide all non-personal view elements ──
function hideAllViewElements() {
  document.getElementById('personalControls').style.display = 'none';
  document.querySelector('.search-bar-row').style.display   = 'none';
  document.querySelector('.backup-zone').style.display      = 'none';
  document.getElementById('gameSearchBar').style.display    = 'none';
  document.getElementById('starredSearchBar').style.display = 'none';
  document.getElementById('quizView').style.display         = 'none';
  const treasureView = document.getElementById('treasureView');
  if (treasureView) treasureView.style.display = 'none';
  const worldsView = document.getElementById('worldsView');
  if (worldsView) worldsView.style.display = 'none';
  setTreasureEntryVisible(false);
  document.getElementById('list').style.display = 'none';
}


// ── Worlds Hub ──
window.loadWorldsView = function() {
  if (currentView === 'personal') animateWorldsRoute('next');
  else if (WORLDS_VIEWS.has(currentView) && currentView !== 'worlds') animateWorldsRoute('back');
  beginViewSwitch();
  saveCurrentViewScroll();
  closeSidebarIfOpen();
  unloadListForView('worlds');
  currentView = 'worlds';

  setActiveNavLink(null);
  document.body.classList.remove('game-bg-active');
  document.body.removeAttribute('data-game');
  setTreasureMode(false);

  hideAllViewElements();
  setViewBackBar(false);
  setTreasureEntryVisible(true);
  setTreasureDockActive('worlds');

  const worldsView = document.getElementById('worldsView');
  if (worldsView) worldsView.style.display = 'block';

  syncWorldCardsLockUi();

  document.querySelector('.page-header h1').innerHTML =
    '<i class="fa-solid fa-earth-americas" aria-hidden="true"></i> عوالم الأساطير';
  restoreViewScroll('worlds');
  refreshFeatureUnlockUI();
};

// ── Treasure Full-Page View ──
window.loadTreasureView = function() {
  animateTreasureRoute('next');
  beginViewSwitch();
  saveCurrentViewScroll();
  closeSidebarIfOpen();
  unloadListForView('treasure');
  unloadPersonalListForTreasure();
  currentView = 'treasure';

  setActiveNavLink(null);
  document.body.classList.remove('game-bg-active');
  document.body.removeAttribute('data-game');

  hideAllViewElements();
  setViewBackBar(false);
  setTreasureMode(true);
  setTreasureEntryVisible(true);
  setTreasureDockActive('treasure');

  const view = document.getElementById('treasureView');
  if (view) view.style.display = 'block';
  renderTreasureRoom();

  document.querySelector('.page-header h1').innerHTML = '<i class="fa-solid fa-gem" aria-hidden="true"></i> صفحة الكنز';
  window.scrollTo({ top: 0, behavior: 'smooth' });
  refreshFeatureUnlockUI();
};

// ── Starred Words View ──
window.loadStarredView = function() {
  if (!isFeatureUnlocked('starred')) {
    openUnlockExplainModal('starred');
    refreshFeatureUnlockUI();
    return;
  }
  if (currentView === 'personal' || currentView === 'worlds') animateWorldsRoute('next');
  beginViewSwitch();
  saveCurrentViewScroll();
  closeSidebarIfOpen();
  currentView = 'starred';
  viewBackTarget = 'worlds';

  setActiveNavLink('starred');

  document.body.classList.remove('game-bg-active');
  document.body.removeAttribute('data-game');
  setTreasureMode(false);

  hideAllViewElements();
  setViewBackBar(true, 'رجوع لعوالم الأساطير');
  setTreasureEntryVisible(true);
  setTreasureDockActive('worlds');
  document.getElementById('starredSearchBar').style.display = 'block';
  document.getElementById('starredSearchInput').value = '';
  document.getElementById('list').style.display = '';

  document.querySelector('.page-header h1').innerHTML = '<i class="fas fa-star" aria-hidden="true"></i> الكلمات الصعبة';

  renderStarredWords();
  restoreViewScroll('starred');
  refreshFeatureUnlockUI();
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
    const ri = window.words.findIndex(x => x.id === w.id);
    const safeId = w.id.replace(/'/g, "\\'");
    const dispWord   = query ? highlightText(w.word, query) : escapeHtml(w.word);
    const dispMeaning = query ? highlightText(w.meaning, query) : escapeHtml(w.meaning);
    const cls = ['word-card', w.expanded ? 'show-example' : ''].filter(Boolean).join(' ');
    return `
      <li class="${cls}" data-action="toggle-expand" data-index="${ri}">
        <div class="word-body" style="flex:1;min-width:0;" data-action="toggle-expand" data-index="${ri}">
          <div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:4px;">
            <button class="star-btn active" data-tip="صعبة" data-action="star" data-id="${safeId}">
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
          <button class="icon-circle sound-btn" data-tip="نطق" data-action="sound" data-id="${safeId}"><i class="fas fa-volume-up"></i></button>
          <button class="icon-circle edit-btn"  data-tip="تعديل" data-action="edit" data-id="${safeId}"><i class="fas fa-edit"></i></button>
          <button class="icon-circle del-btn"   data-tip="حذف" data-action="delete" data-id="${safeId}"><i class="fas fa-trash-alt"></i></button>
        </div>
      </li>`;
  }).join('');
}

// ── Quiz Full-Page View ──
window.loadQuizView = function() {
  if (!isFeatureUnlocked('quiz')) {
    openUnlockExplainModal('quiz');
    refreshFeatureUnlockUI();
    return;
  }
  beginViewSwitch();
  saveCurrentViewScroll();
  closeSidebarIfOpen();
  unloadListForView('quiz');
  currentView = 'quiz';

  setActiveNavLink('quiz');

  // Remove game background
  document.body.classList.remove('game-bg-active');
  document.body.removeAttribute('data-game');
  setTreasureMode(false);

  // Hide personal controls, show only quiz view
  hideAllViewElements();
  setViewBackBar(false);
  setTreasureEntryVisible(true);
  setTreasureDockActive('quiz');
  document.getElementById('quizView').style.display = 'block';
  document.getElementById('quizViewSetup').style.display = 'block';
  document.getElementById('quizViewCard').style.display = 'none';

  document.querySelector('.page-header h1').innerHTML = '<i class="fas fa-gamepad" aria-hidden="true"></i> الاختبار';

  // Update available words count
  const quizCountEl = document.getElementById('quizAvailableCount');
  if (quizCountEl) quizCountEl.textContent = window.words.length > 0
    ? `الكلمات المتاحة: ${window.words.length}`
    : 'القاموس فاضي!';

  restoreViewScroll('quiz');
  refreshFeatureUnlockUI();
};

window.loadPersonalDictionary = function() {
  const returningFromTreasure = currentView === 'treasure';
  const returningFromWorlds = WORLDS_VIEWS.has(currentView) || currentView === 'quiz';
  if (returningFromTreasure) animateTreasureRoute('back');
  else if (returningFromWorlds) animateWorldsRoute('back');
  beginViewSwitch();
  saveCurrentViewScroll();
  closeSidebarIfOpen();
  currentView = 'personal';
  // لو كان فلتر الصعبة مفعّل — يرجع للكل
  if (currentFilter !== 'all') {
    currentFilter = 'all';
  }

  // إزالة خلفية اللعبة
  document.body.classList.remove('game-bg-active');
  document.body.removeAttribute('data-game');
  setTreasureMode(false);

  // إظهار كل عناصر القاموس الشخصي
  document.getElementById('personalControls').style.display = 'block';
  document.querySelector('.search-bar-row').style.display   = '';
  document.querySelector('.backup-zone').style.display      = '';
  document.getElementById('list').style.display             = '';

  // إخفاء search bar الألعاب والكلمات الصعبة والكويز
  document.getElementById('gameSearchBar').style.display    = 'none';
  document.getElementById('starredSearchBar').style.display = 'none';
  document.getElementById('quizView').style.display         = 'none';
  const treasureView = document.getElementById('treasureView');
  if (treasureView) treasureView.style.display = 'none';
  const worldsView = document.getElementById('worldsView');
  if (worldsView) worldsView.style.display = 'none';
  setTreasureEntryVisible(true);
  setTreasureDockActive('personal');

  document.querySelector('.page-header h1').innerHTML = '<i class="fa-solid fa-sword" aria-hidden="true"></i> قاموسك الشخصي';
  setActiveNavLink('personal');
  setViewBackBar(false);
  clearInterval(window.__lootCountdownTimer);
  render();
  updateDailyQuestsBadge();
  restoreViewScroll('personal');
  refreshFeatureUnlockUI();
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
      persistDictionary();
      if (currentView === 'personal') render();
      showToast('تمت الإضافة لقاموسك');
      updateXP(xpGain); showXPBadge(xpGain,null,false);
      checkAndUpdateStreak(); incrementDailyCount(); recordGameDictionaryAdd();
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
    checkAndUpdateStreak(); incrementDailyCount(); recordGameDictionaryAdd();
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
  if (currentView !== 'personal') {
    refreshFeatureUnlockUI();
    return;
  }

  const searchEl = document.getElementById('searchInput');
  const filterEl = document.getElementById('searchFilter');
  if (!searchEl) {
    refreshFeatureUnlockUI();
    return;
  }

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

  // Lazy Loading: عرض مجموعة محددة فقط لضمان سرعة الواجهة
  const displayWords = isReorderMode ? filtered : filtered.slice(0, renderLimit);

  const listEl = document.getElementById('list');
  if (!listEl) return;

  if (filtered.length === 0) {
    listEl.innerHTML = `
      <li style="list-style:none;text-align:center;padding:40px 20px;color:var(--text-gray);">
        <div style="font-size:32px;margin-bottom:10px;"><i class="fa-solid fa-book-open" aria-hidden="true"></i></div>
        ${query ? 'ما في نتائج للبحث' : 'قاموسك فاضي، ابدأ بإضافة كلمة!'}
      </li>`;
    refreshFeatureUnlockUI();
    return;
  }

  listEl.innerHTML = displayWords.map(w => {
    const ri   = window.words.findIndex(x => x.id === w.id);
    const drag = isReorderMode
      ? `draggable="true" ondragstart="drag(event,${ri})" ondragover="allowDrop(event)" ondrop="drop(event,${ri})"`
      : '';
    const cls = ['word-card', isReorderMode ? 'reorder-mode-li' : '', 
                 selectedIndices.includes(ri) ? 'selected-for-move' : '', w.expanded ? 'show-example' : '']
      .filter(Boolean).join(' ');
    const safeId = w.id.replace(/'/g, "\\'");

    return `
      <li ${drag} class="${cls}" data-action="toggle-expand" data-index="${ri}">
        <div class="word-body" style="flex:1;min-width:0;" data-action="toggle-expand" data-index="${ri}">
          <div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:4px;">
            <button class="star-btn ${w.starred ? 'active' : ''}" data-tip="صعبة" 
                    data-action="star" data-id="${safeId}">
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
          ? '<span style="font-size:20px;color:var(--text-gray);padding:0 8px;flex-shrink:0;">☰</span>'
          : `<div class="actions">
               <button class="icon-circle sound-btn" data-tip="نطق" data-action="sound" data-id="${safeId}"><i class="fas fa-volume-up"></i></button>
               <button class="icon-circle edit-btn"  data-tip="تعديل" data-action="edit" data-id="${safeId}"><i class="fas fa-edit"></i></button>
               <button class="icon-circle del-btn"   data-tip="حذف" data-action="delete" data-id="${safeId}"><i class="fas fa-trash-alt"></i></button>
             </div>`
        }
      </li>`;
  }).join('');
  refreshFeatureUnlockUI();
}

// ── تفويض أزرار نتائج AI (إضافة + اقتراح) ───────────────
document.addEventListener('click', (e) => {
  const addBtn = e.target.closest('[data-action="add-ai-meaning"]');
  if (addBtn) {
    e.preventDefault();
    e.stopPropagation();
    addAiMeaningCore({
      word: decodeSugAttr(addBtn.dataset.word),
      ar: decodeSugAttr(addBtn.dataset.ar),
      pos: decodeSugAttr(addBtn.dataset.pos),
      ex: decodeSugAttr(addBtn.dataset.ex),
      game: decodeSugAttr(addBtn.dataset.game) || getSuggestionGameLabel(),
    }, addBtn);
    return;
  }
  const sugBtn = e.target.closest('[data-action="submit-suggestion"]');
  if (sugBtn) {
    e.preventDefault();
    e.stopPropagation();
    submitSuggestionFromUI(sugBtn.dataset.word, sugBtn.dataset.ar, sugBtn.dataset.game, e);
  }
});

// ── Centralized Click Handling (Event Delegation) ───────
document.addEventListener('DOMContentLoaded', () => {
  bindSearchLockOverlays();
  refreshGuestSearchLocks();

  const list = document.getElementById('list');
  if (!list) return;

  list.addEventListener('click', (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;

    const action = target.dataset.action;
    const id     = target.dataset.id;
    const index  = target.dataset.index;

    // Stop propagation if it's a button action to prevent li toggle
    if (action !== 'toggle-expand') e.stopPropagation();

    switch (action) {
      case 'star':   window.toggleStar(id, e); break;
      case 'sound':  window.playSound(id, e);  break;
      case 'edit':   window.editWord(id, e);   break;
      case 'delete': window.deleteWord(id, e); break;
      case 'toggle-expand': 
        if (!isReorderMode) handleLiClick(parseInt(index), target.closest('li')); 
        break;
    }
  });

  // تصفير العداد عند كتابة أي شيء في البحث لتبدأ النتائج من الأعلى
  document.getElementById('searchInput')?.addEventListener('input', () => {
    renderLimit = 20;
  });
});

// ── Infinite Scroll Logic ───────────────────────────────
window.addEventListener('scroll', () => {
  if (currentView !== 'personal' || isReorderMode) return;

  // إذا اقترب المستخدم من نهاية الصفحة (500 بكسل مسافة أمان)
  if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 500) {
    if (renderLimit < window.words.length) {
      renderLimit += 20;
      render();
    }
  }
}, { passive: true });

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
  currentQuizMistakes = 0;

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
  else { finishQuizRun(); }
}

function finishQuizRun() {
  if (currentQuizMistakes === 0 && currentQuizWords.length > 0) {
    saveInt('lootlinguaPerfectQuizzes', loadInt('lootlinguaPerfectQuizzes', 0) + 1);
    markDailyQuestFlag('perfectQuiz');
    if (typeof evaluateTitleUnlocks === 'function') evaluateTitleUnlocks(true);
  }
  showToast(currentQuizMistakes === 0 ? 'اختبار كامل بدون ولا غلطة!' : 'أبدعت! 👏', 'success', 3200);
  setTimeout(closeQuiz, 600);
}

function markForgot() {
  currentStreak = 0;
  currentQuizMistakes++;
  const w = currentQuizWords[quizIndex];
  if (!w) return;
  const prevForget = w.forgetCount || 0;
  const nextForget = prevForget + 1;

  // حدّث forgetCount في window.words
  window.words = window.words.map(x =>
    x.id === w.id ? { ...x, forgetCount: nextForget } : x
  );
  const updatedWord = { ...w, forgetCount: nextForget };
  currentQuizWords[quizIndex] = updatedWord;

  // احفظ فوراً في localStorage والسحابة
  localStorage.setItem('lootlinguaDict', JSON.stringify(window.words));
  if (window.updateWordInCloud) window.updateWordInCloud(w.id, { forgetCount: nextForget });

  // أعد إدراج الكلمة بعد 3-4 بطاقات
  const gap = Math.max(2, Math.min(5 - nextForget, 4));
  const insertAt = Math.min(quizIndex + gap, currentQuizWords.length);
  currentQuizWords.splice(insertAt, 0, { ...updatedWord });

  // حدّث عداد البطاقات في الواجهة
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
  loadTheme();
  renderXPBar();
  syncHeroAvatar();
  renderDailyGoal();
  renderStreak();
  renderProfileModalStats();
  render();
  updateDailyQuestsBadge();
  initOnboarding();
  // استدعيها بعد تأخير 0 عشان تعطي Firebase فرصة
  // لو المستخدم مش مسجل دخول، ستشتغل مباشرة
  setTimeout(() => {
    if (!window._profileLoaded) checkAndUpdateStreak();
  }, 1200);
  refreshFeatureUnlockUI();
};

// ═══════════════════════════════════════════════════════
// Sidebar Tooltip (JS — bypasses overflow clipping)
// ═══════════════════════════════════════════════════════
(function(){
  const tip = document.createElement('div');
  tip.className = 'sidebar-tip';
  document.body.appendChild(tip);

  function showTip(e) {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar || sidebar.classList.contains('open')) return;
    const el = e.currentTarget;
    if (!el.dataset.tip) return;
    const rect = el.getBoundingClientRect();
    tip.textContent = el.dataset.tip;
    tip.style.top = (rect.top + rect.height / 2) + 'px';
    tip.style.right = (window.innerWidth - rect.left + 10) + 'px';
    tip.style.left = '';
    tip.style.transform = 'translateY(-50%)';
    tip.classList.add('show');
  }
  function hideTip() { tip.classList.remove('show'); }

  document.querySelectorAll('[data-tip]').forEach(el => {
    if (el.closest('.sidebar')) {
      el.addEventListener('mouseenter', showTip);
      el.addEventListener('mouseleave', hideTip);
    }
  });
})();

// ═══════════════════════════════════════════════════════
// Sidebar toggle (must be defined BEFORE any code that wraps window.toggleSidebar)
// ═══════════════════════════════════════════════════════
if (typeof window.toggleSidebar !== 'function') {
  window.toggleSidebar = function() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');
    if (!sidebar) return;
    const isOpen = sidebar.classList.toggle('open');
    if (overlay) overlay.classList.toggle('show', isOpen);
  };
}

if (typeof window.closeSidebarIfOpen !== 'function') {
  window.closeSidebarIfOpen = function() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');
    if (sidebar && sidebar.classList.contains('open')) {
      sidebar.classList.remove('open');
      if (overlay) overlay.classList.remove('show');
    }
  };
}

(function() {
  const HIDDEN_CLASS = 'hide-mobile-hamburger';
  const MOBILE_QUERY = window.matchMedia('(max-width: 768px)');
  let lastScrollY = window.scrollY || 0;
  let scrollTimer = null;

  function isMobileViewport() {
    return MOBILE_QUERY.matches;
  }

  function setHamburgerVisible(visible) {
    document.body.classList.toggle(HIDDEN_CLASS, !visible);
  }

  function updateHamburgerByScroll() {
    if (!isMobileViewport()) {
      document.body.classList.remove(HIDDEN_CLASS);
      return;
    }
    if (document.body.classList.contains('sidebar-open')) {
      document.body.classList.add(HIDDEN_CLASS);
      return;
    }
    const currentY = window.scrollY || 0;
    const delta = currentY - lastScrollY;
    if (Math.abs(delta) < 10) {
      lastScrollY = currentY;
      return;
    }
    if (delta > 0 && currentY > 40) {
      setHamburgerVisible(false);
    } else if (delta < 0) {
      setHamburgerVisible(true);
    }
    lastScrollY = currentY;
  }

  window.updateMobileHamburgerState = function(open) {
    document.documentElement.classList.toggle('sidebar-open', open);
    document.body.classList.toggle('sidebar-open', open);
    if (open) {
      setHamburgerVisible(false);
    } else {
      setHamburgerVisible(true);
    }
  };

  window.addEventListener('scroll', () => {
    if (!isMobileViewport()) return;
    if (scrollTimer) clearTimeout(scrollTimer);
    scrollTimer = setTimeout(updateHamburgerByScroll, 80);
  }, { passive: true });

  window.addEventListener('resize', () => {
    if (!isMobileViewport()) {
      document.body.classList.remove(HIDDEN_CLASS);
    }
  });

  const origCloseSidebarIfOpen = window.closeSidebarIfOpen;
  window.closeSidebarIfOpen = function() {
    if (typeof origCloseSidebarIfOpen === 'function') origCloseSidebarIfOpen();
    document.documentElement.classList.remove('sidebar-open');
    document.body.classList.remove('sidebar-open');
    setHamburgerVisible(true);
  };
})();

// ═══════════════════════════════════════════════════════
// Sidebar Book Icon → Open Icon on Hover
// ═══════════════════════════════════════════════════════
(function(){
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;
  const headerIcon = () => sidebar.querySelector('.sidebar-header i');
  const origClass = 'fa-solid fa-book-open';
  const hoverClass = 'fa-solid fa-angles-left';

  sidebar.addEventListener('mouseenter', () => {
    const icon = headerIcon();
    if (icon && !sidebar.classList.contains('open')) icon.className = hoverClass;
  });
  sidebar.addEventListener('mouseleave', () => {
    const icon = headerIcon();
    if (icon) icon.className = origClass;
  });
  // رجّع الأيقون لما يفتح السايدبار
  const origToggle = window.toggleSidebar;
  window.toggleSidebar = function() {
    if (typeof origToggle === 'function') origToggle();
    window.updateMobileHamburgerState(sidebar.classList.contains('open'));
    const icon = headerIcon();
    if (icon) icon.className = sidebar.classList.contains('open') ? origClass : origClass;
  };
})();

// ── Back to Top Button ──────────────────────────────────
(function initBackToTop() {
  // إضافة التنسيقات الخاصة بالزر داخل الصفحة
  const style = document.createElement('style');
  style.textContent = `
    .back-to-top {
      position: fixed;
      bottom: 20px;
      right: 360px; /* نقلناه لليمين وقربناه من مصفوفة الكلمات */
      width: 30px;  /* تصغير الحجم ليكون أكثر تناسقاً */
      height: 30px;
      border-radius: 50%;
      background: var(--accent);
      color: var(--text-on-accent);
      border: none;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1rem;
      opacity: 0;
      visibility: hidden;
      transition: all 0.3s ease;
      z-index: 9000;
    }
    .back-to-top.show {
      opacity: 0.8; /* شفافية بسيطة لكي لا يحجب النص تحت الزر */
      visibility: visible;
      bottom: 30px;
    }
    .back-to-top:hover {
      opacity: 1;
      transform: translateY(-3px);
      filter: brightness(1.1);
    }
    @media (max-width: 768px) {
      .back-to-top {
        right: 15px; /* تقريبه أكثر من الحافة في الموبايل */
        width: 35px;
        height: 35px;
      }
      .back-to-top.show {
        bottom: 25px;
      }
    }
  `;
  document.head.appendChild(style);

  // إنشاء عنصر الزر
  const btn = document.createElement('button');
  btn.className = 'back-to-top';
  btn.innerHTML = '<i class="fa-solid fa-chevron-up"></i>';
  btn.setAttribute('aria-label', 'العودة للأعلى');
  document.body.appendChild(btn);

  // وظيفة النقر للعودة للأعلى
  btn.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  // مراقبة التمرير لإظهار/إخفاء الزر
  window.addEventListener('scroll', () => {
    if (window.scrollY > 400) btn.classList.add('show');
    else btn.classList.remove('show');
  }, { passive: true });
})();

















