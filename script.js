// ═══════════════════════════════════════════════════════
// Smart Loading Overlay - Handles authentication and data-fetching delay
// Full-screen blurred overlay that appears instantly on page load
// and dismisses the moment user data arrives (300ms opacity fade-out).
// Includes slow connection/offline detection (5s warning).
// ═══════════════════════════════════════════════════════
(function() {
  'use strict';

  // ============================================
  // CONFIGURATION
  // ============================================
  // Guest storage key matches: WORDS_NORMAL_PREFIX + 'guest' = 'words_normal_guest'
  const GUEST_STORAGE_KEY = 'words_normal_guest';
  const LEGACY_DICTIONARY_KEY = 'lootlinguaDict';
  const LOADING_TEXT = 'جارٍ التحميل...';
  const SLOW_CONNECTION_TEXT = 'يبدو أن التحميل يستغرق وقتًا أطول من المعتاد. يرجى التحقق من اتصالك بالإنترنت.';
  const OVERLAY_ID = 'smartLoadingOverlay';
  const SLOW_WARNING_ID = 'smartLoadingSlowWarning';

  // Timing constants
  const SLOW_CONNECTION_THRESHOLD_MS = 5000; // Time before showing slow connection warning
  const FADE_OUT_DURATION_MS = 300;        // CSS transition duration (must match CSS)

  // ============================================
  // STATE
  // ============================================
  let overlayElement = null;
  let slowWarningElement = null;
  let isOverlayVisible = false;
  let slowWarningTimer = null;
  let dismissPending = false;

  // ============================================
  // CREATE OVERLAY HTML
  // ============================================
  function createOverlay() {
    if (document.getElementById(OVERLAY_ID)) return;

    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.className = 'smart-loading-overlay';
    overlay.setAttribute('role', 'status');
    overlay.setAttribute('aria-live', 'polite');
    overlay.setAttribute('aria-label', LOADING_TEXT);
    
    overlay.innerHTML = `
      <div class="smart-loading-backdrop"></div>
      <div class="smart-loading-content">
        <div class="smart-loading-spinner" aria-hidden="true"></div>
        <p class="smart-loading-text">${LOADING_TEXT}</p>
        <p id="${SLOW_WARNING_ID}" class="smart-loading-slow-warning" aria-live="assertive" style="display: none; opacity: 0;">${SLOW_CONNECTION_TEXT}</p>
      </div>
    `;

    document.body.appendChild(overlay);
    overlayElement = overlay;
    slowWarningElement = document.getElementById(SLOW_WARNING_ID);
    return overlay;
  }

  // ============================================
  // CHECK FOR GUEST DATA (SYNCHRONOUS, INSTANT)
  // ============================================
  function checkGuestDataExists() {
    try {
      // Check for guest words in localStorage
      const guestWords = localStorage.getItem(GUEST_STORAGE_KEY);
      const legacyDict = localStorage.getItem(LEGACY_DICTIONARY_KEY);
      
      // Also check for any guest profile data
      const guestXP = localStorage.getItem('userXP');
      const guestStreak = localStorage.getItem('dailyStreak');
      
      // Guest exists if they have words OR profile data
      const hasGuestWords = guestWords && guestWords !== '[]' && JSON.parse(guestWords).length > 0;
      const hasLegacyWords = legacyDict && legacyDict !== '[]' && JSON.parse(legacyDict).length > 0;
      const hasGuestProfile = (guestXP && parseInt(guestXP) > 0) || (guestStreak && parseInt(guestStreak) > 0);
      
      return hasGuestWords || hasLegacyWords || hasGuestProfile;
    } catch (e) {
      console.warn('SmartLoadingOverlay: Error checking guest data:', e);
      return false;
    }
  }

  // ============================================
  // SHOW OVERLAY
  // ============================================
  function showOverlay() {
    if (isOverlayVisible) return;
    
    if (!overlayElement) createOverlay();
    
    isOverlayVisible = true;
    overlayElement.style.transition = 'none';
    overlayElement.style.opacity = '1';
    overlayElement.classList.add('visible');
    document.body.classList.add('smart-loading-active');
    
    // Prevent scrolling while loading
    document.body.style.overflow = 'hidden';
    
    // Start the slow connection warning timer
    startSlowConnectionTimer();
  }

  // ============================================
  // SLOW CONNECTION WARNING TIMER
  // ============================================
  function startSlowConnectionTimer() {
    // Clear any existing timer
    if (slowWarningTimer) {
      clearTimeout(slowWarningTimer);
      slowWarningTimer = null;
    }
    
    slowWarningTimer = setTimeout(() => {
      if (isOverlayVisible && slowWarningElement) {
        // Fade in the slow connection warning
        slowWarningElement.style.display = 'block';
        // Force reflow for transition
        slowWarningElement.offsetHeight;
        slowWarningElement.style.opacity = '1';
        slowWarningElement.style.transition = 'opacity 0.4s cubic-bezier(0.25, 0.8, 0.25, 1)';
        console.log('SmartLoadingOverlay: Slow connection warning displayed');
      }
    }, SLOW_CONNECTION_THRESHOLD_MS);
  }

  function clearSlowConnectionTimer() {
    if (slowWarningTimer) {
      clearTimeout(slowWarningTimer);
      slowWarningTimer = null;
    }
    // Also hide the warning if it was shown
    if (slowWarningElement) {
      slowWarningElement.style.opacity = '0';
      slowWarningElement.style.display = 'none';
    }
  }

  // ============================================
  // SCHEDULE DISMISSAL (instant trigger + smooth fade)
  // ============================================
  function scheduleDismiss() {
    if (dismissPending || !isOverlayVisible) return;
    dismissPending = true;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        hideOverlay();
      });
    });
  }

  // ============================================
  // HIDE OVERLAY (with smooth fade out)
  // ============================================
  function hideOverlay() {
    if (!isOverlayVisible || !overlayElement) return;
    
    clearSlowConnectionTimer();
    
    isOverlayVisible = false;
    overlayElement.style.transition = `opacity ${FADE_OUT_DURATION_MS}ms ease, visibility ${FADE_OUT_DURATION_MS}ms ease`;
    overlayElement.style.opacity = '0';
    overlayElement.classList.remove('visible');
    document.body.classList.remove('smart-loading-active');
    document.body.style.overflow = '';
    
    // Remove from DOM after transition
    setTimeout(() => {
      if (overlayElement && !isOverlayVisible) {
        overlayElement.remove();
        overlayElement = null;
        slowWarningElement = null;
      }
      dismissPending = false;
    }, FADE_OUT_DURATION_MS);
  }

  // ============================================
  // SMART DETECTION LOGIC
  // ============================================
  function runSmartDetection() {
    const isGuest = checkGuestDataExists();
    console.log(
      isGuest
        ? 'SmartLoadingOverlay: Guest data present, waiting for auth resolution'
        : 'SmartLoadingOverlay: No guest data, waiting for Firebase Auth...'
    );
    return isGuest;
  }

  // ============================================
  // PUBLIC API
  // ============================================
  window.SmartLoadingOverlay = {
    // Call this ASAP on page load (before Firebase initializes)
    init: function() {
      showOverlay();
      const bypassed = runSmartDetection();
      return bypassed;
    },

    // Call this when Firebase Auth state is resolved (user or null)
    onAuthResolved: function(user) {
      if (!user) {
        console.log('SmartLoadingOverlay: Auth resolved - no user, dismissing');
        scheduleDismiss();
        return;
      }
      
      console.log('SmartLoadingOverlay: Auth resolved - user found, waiting for data...');
    },

    // Call this when user words data is fully loaded from Firebase
    onUserDataLoaded: function() {
      console.log('SmartLoadingOverlay: User data loaded, dismissing');
      scheduleDismiss();
    },

    // Force hide (emergency fallback)
    forceHide: function() {
      hideOverlay();
    },

    // Check if overlay is currently visible
    isVisible: function() {
      return isOverlayVisible;
    }
  };

  // ============================================
  // AUTO-INITIALIZE ON SCRIPT LOAD
  // ============================================
  // Show overlay immediately when this script loads
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.SmartLoadingOverlay.init();
    }, { once: true });
  } else {
    window.SmartLoadingOverlay.init();
  }

})();
// Performance mode
// ═══════════════════════════════════════════════════════
const PERFORMANCE_MODE_KEY = 'lootlinguaPerformanceMode';
const PERFORMANCE_MODE_NOTICE_KEY = 'lootlinguaPerformanceModeNoticeSeen';
const PERFORMANCE_LEVELS = ['ultra', 'balanced', 'stable', 'turbo'];
const PERFORMANCE_LEVEL_LABELS = {
  ultra: 'أقصى جرافيك',
  balanced: 'متوازن',
  stable: 'أداء مستقر',
  turbo: 'تربو',
};

function detectPerformanceLevel() {
  const cores = navigator.hardwareConcurrency || 0;
  const memory = navigator.deviceMemory || 0;
  const isMobile = /Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(navigator.userAgent || '');
  if ((cores && cores <= 2) || (memory && memory <= 2)) return 'turbo';
  if (isMobile || (cores && cores < 4) || (memory && memory <= 4)) return 'stable';
  if ((cores && cores >= 8) && (!memory || memory >= 8)) return 'ultra';
  return 'balanced';
}

function getPerformanceModePreference() {
  const pref = localStorage.getItem(PERFORMANCE_MODE_KEY);
  if (PERFORMANCE_LEVELS.includes(pref)) return pref;
  if (pref === 'on') {
    localStorage.setItem(PERFORMANCE_MODE_KEY, 'turbo');
    return 'turbo';
  }
  if (pref === 'off') {
    localStorage.setItem(PERFORMANCE_MODE_KEY, 'ultra');
    return 'ultra';
  }
  const autoLevel = detectPerformanceLevel();
  localStorage.setItem(PERFORMANCE_MODE_KEY, autoLevel);
  return autoLevel;
}

function syncPerformanceModeToggle() {
  const slider = document.getElementById('performanceLevelSlider');
  const text = document.getElementById('performanceModeState');
  const level = getPerformanceModePreference();
  const index = Math.max(0, PERFORMANCE_LEVELS.indexOf(level));
  if (slider) {
    slider.value = String(index);
    slider.setAttribute('aria-valuetext', PERFORMANCE_LEVEL_LABELS[level]);
    slider.style.setProperty('--perf-progress', `${(index / (PERFORMANCE_LEVELS.length - 1)) * 100}%`);
  }
  if (text) {
    text.textContent = PERFORMANCE_LEVEL_LABELS[level];
  }
}

function getPerformanceSliderPercent(slider, clientX) {
  const rect = slider.getBoundingClientRect();
  if (!rect.width) return 0;
  return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
}

function setPerformanceSliderHover(slider, clientX) {
  const pct = getPerformanceSliderPercent(slider, clientX) * 100;
  slider.style.setProperty('--perf-hover', `${pct}%`);
}

function previewPerformanceLevelFromPointer(slider, clientX) {
  const pct = getPerformanceSliderPercent(slider, clientX);
  const max = Number(slider.max) || PERFORMANCE_LEVELS.length - 1;
  const min = Number(slider.min) || 0;
  const value = min + pct * (max - min);
  slider.value = String(value);
  slider.style.setProperty('--perf-progress', `${pct * 100}%`);
}

function snapPerformanceLevelFromPointer(slider, clientX) {
  const pct = getPerformanceSliderPercent(slider, clientX);
  const max = Number(slider.max) || PERFORMANCE_LEVELS.length - 1;
  const min = Number(slider.min) || 0;
  const value = Math.round(min + pct * (max - min));
  setPerformanceLevel(value);
}

function initPerformanceSliderInteraction() {
  const slider = document.getElementById('performanceLevelSlider');
  if (!slider || slider.dataset.pointerReady === '1') return;
  slider.dataset.pointerReady = '1';

  let dragging = false;

  slider.addEventListener('pointerenter', (e) => {
    slider.classList.add('is-hovering');
    setPerformanceSliderHover(slider, e.clientX);
  });

  slider.addEventListener('pointermove', (e) => {
    setPerformanceSliderHover(slider, e.clientX);
    if (dragging) {
      e.preventDefault();
      previewPerformanceLevelFromPointer(slider, e.clientX);
    }
  });

  slider.addEventListener('pointerleave', () => {
    if (!dragging) slider.classList.remove('is-hovering');
  });

  slider.addEventListener('pointerdown', (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    dragging = true;
    slider.classList.add('is-hovering', 'is-dragging');
    slider.setPointerCapture?.(e.pointerId);
    e.preventDefault();
    setPerformanceSliderHover(slider, e.clientX);
    previewPerformanceLevelFromPointer(slider, e.clientX);
  });

  slider.addEventListener('pointerup', (e) => {
    dragging = false;
    slider.classList.remove('is-dragging');
    slider.releasePointerCapture?.(e.pointerId);
    snapPerformanceLevelFromPointer(slider, e.clientX);
  });

  slider.addEventListener('pointercancel', (e) => {
    dragging = false;
    slider.classList.remove('is-dragging', 'is-hovering');
    slider.releasePointerCapture?.(e.pointerId);
    syncPerformanceModeToggle();
  });

  slider.addEventListener('input', () => {
    const max = Number(slider.max) || PERFORMANCE_LEVELS.length - 1;
    const min = Number(slider.min) || 0;
    const raw = Math.min(max, Math.max(min, Number(slider.value) || 0));
    slider.style.setProperty('--perf-progress', `${((raw - min) / (max - min)) * 100}%`);
  });

  slider.addEventListener('change', () => {
    setPerformanceLevel(slider.value);
  });
}

function initPerformanceControls() {
  applyPerformanceMode();
  initPerformanceSliderInteraction();
}

function applyPerformanceMode() {
  const hadPreference = localStorage.getItem(PERFORMANCE_MODE_KEY) !== null;
  const level = getPerformanceModePreference();
  document.body.classList.remove('low-end-device', ...PERFORMANCE_LEVELS.map(l => `perf-${l}`));
  document.body.classList.add(`perf-${level}`);
  document.body.classList.toggle('low-end-device', level === 'turbo');
  syncPerformanceModeToggle();
  if (!hadPreference && level !== 'ultra' && !localStorage.getItem(PERFORMANCE_MODE_NOTICE_KEY)) {
    localStorage.setItem(PERFORMANCE_MODE_NOTICE_KEY, '1');
    setTimeout(() => {
      if (typeof showToast === 'function') {
        showToast(`اخترنا مستوى الأداء ${PERFORMANCE_LEVEL_LABELS[level]} تلقائياً. تقدر تغيّره من الإعدادات.`, 'info', 5600);
      }
    }, 900);
  }
}

window.setPerformanceLevel = function(value) {
  const index = Math.round(Math.min(PERFORMANCE_LEVELS.length - 1, Math.max(0, Number(value) || 0)));
  localStorage.setItem(PERFORMANCE_MODE_KEY, PERFORMANCE_LEVELS[index]);
  applyPerformanceMode();
};

window.togglePerformanceMode = function() {
  const current = getPerformanceModePreference();
  const next = current === 'turbo' ? 'balanced' : 'turbo';
  localStorage.setItem(PERFORMANCE_MODE_KEY, next);
  applyPerformanceMode();
};

window.showPerformanceModeHelp = function(event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  showModal('performanceModeInfoModal');
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPerformanceControls);
} else {
  initPerformanceControls();
}

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
  if (!opening) {
    closeNotificationsPanel();
    return;
  }
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
    setAppRoute('overlay', 'notifications');
  }
}

window.addEventListener('resize', () => {
  if (document.getElementById('notificationsPanel')?.classList.contains('open')) positionNotifPopover();
});

function closeNotificationsPanel(silent) {
  const close = () => {
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
  };
  if (silent) close();
  else closeRouteEntry('overlay', 'notifications', close);
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
  if (!open) {
    closeProfileModal();
    return;
  }
  modal.classList.toggle('open', open);
  modal.setAttribute('aria-hidden', open ? 'false' : 'true');
  document.body.classList.toggle('profile-modal-open', open);
  lockBackgroundScroll('profile');
  syncHeroAvatar();
  renderProfileModalStats();
  renderXPBar();
  refreshFeatureUnlockUI();
  closeSidebarIfOpen();
  setAppRoute('overlay', 'profile');
};

window.closeProfileModal = function(silent) {
  const close = () => {
    const modal = document.getElementById('profileModal');
    if (!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('profile-modal-open');
    unlockBackgroundScroll('profile');
  };
  if (silent) close();
  else closeRouteEntry('overlay', 'profile', close);
};

const backgroundScrollLocks = new Set();
let backgroundScrollY = 0;
let backgroundScrollStyles = null;

function lockBackgroundScroll(key) {
  if (backgroundScrollLocks.has(key)) return;
  if (backgroundScrollLocks.size === 0) {
    backgroundScrollY = window.scrollY || document.documentElement.scrollTop || 0;
    backgroundScrollStyles = {
      position: document.body.style.position,
      top: document.body.style.top,
      left: document.body.style.left,
      right: document.body.style.right,
      width: document.body.style.width,
      overflow: document.body.style.overflow,
    };
    document.documentElement.classList.add('modal-scroll-locked');
    document.body.classList.add('modal-scroll-locked');
    document.body.style.position = 'fixed';
    document.body.style.top = `-${backgroundScrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';
  }
  backgroundScrollLocks.add(key);
}

function unlockBackgroundScroll(key) {
  backgroundScrollLocks.delete(key);
  if (backgroundScrollLocks.size > 0) return;
  document.documentElement.classList.remove('modal-scroll-locked');
  document.body.classList.remove('modal-scroll-locked');
  if (backgroundScrollStyles) {
    document.body.style.position = backgroundScrollStyles.position;
    document.body.style.top = backgroundScrollStyles.top;
    document.body.style.left = backgroundScrollStyles.left;
    document.body.style.right = backgroundScrollStyles.right;
    document.body.style.width = backgroundScrollStyles.width;
    document.body.style.overflow = backgroundScrollStyles.overflow;
    backgroundScrollStyles = null;
  }
  window.scrollTo(0, backgroundScrollY);
}

function syncHeroAvatar() {
  const rank = getRank(userXP);
  const letterEl = document.getElementById('heroAvatarLetter');
  const iconEl = document.getElementById('heroAvatarIcon');
  const levelEl = document.getElementById('heroLevelBadge');
  const heroTitleBadge = document.getElementById('heroActiveTitleBadge');
  const xpMini = document.getElementById('heroXpMini');
  const profileAv = document.getElementById('profileModalAvatar');
  const profileTitle = document.getElementById('profileModalTitle');
  const profileBadge = document.getElementById('profileActiveTitleBadge');
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
  if (heroTitleBadge && typeof getActiveTitleDef === 'function') {
    const unlockedTitles = getUnlockedTitleDefs();
    if (unlockedTitles.length) {
      heroTitleBadge.hidden = false;
      heroTitleBadge.innerHTML = unlockedTitles.map(def => renderTitleIcon(def, 'hero-active-title-icon')).join('');
      heroTitleBadge.title = unlockedTitles.map(def => def.name).join('، ');
    } else {
      heroTitleBadge.hidden = true;
      heroTitleBadge.innerHTML = '';
    }
  }
  if (xpMini) xpMini.textContent = userXP + ' XP';
  if (profileAv) {
    profileAv.textContent = '';
    if (initial) {
      const span = document.createElement('span');
      span.className = 'profile-avatar-letter';
      span.textContent = initial;
      profileAv.appendChild(span);
    } else {
      profileAv.innerHTML = '<i class="fa-solid fa-user"></i>';
    }
  }
  if (profileTitle) profileTitle.textContent = name || 'ملفك الشخصي';
  if (profileBadge && typeof getActiveTitleDef === 'function') {
    const unlockedTitles = getUnlockedTitleDefs();
    if (unlockedTitles.length) {
      profileBadge.hidden = false;
      profileBadge.innerHTML = unlockedTitles.map(def => renderTitleIcon(def, 'profile-active-title-icon')).join('');
      profileBadge.title = unlockedTitles.map(def => def.name).join('، ');
    } else {
      profileBadge.hidden = true;
      profileBadge.innerHTML = '';
    }
  }
  if (typeof renderProfileTitlePicker === 'function') renderProfileTitlePicker();
}

function getProfileDisplayName() {
  return window.auth?.currentUser?.displayName || localStorage.getItem('lootlinguaDisplayName') || '';
}

window.setLootlinguaDisplayName = function(name) {
  if (name) localStorage.setItem('lootlinguaDisplayName', name);
  syncHeroAvatar();
};

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (handleEscapeShortcut(e)) return;
  closeNotificationsPanel();
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

const ONBOARDING_INTRO_QUEST_DEFS = [
  { id: 'introSearch', label: 'ابحث عن أول كلمة إلك في صندوق البحث.', reward: 0, icon: 'fa-magnifying-glass', introOnly: true },
  { id: 'introAdd', label: 'ضيف الكلمة لقاموسك عشان تفتح أولى ميزات الموقع.', reward: 0, icon: 'fa-plus', introOnly: true },
];

const EMPTY_ONBOARDING_STORAGE_KEY = 'hasCompletedOnboarding';

const EMPTY_ONBOARDING_COPY = {
  questTip: '🎯 ابدأ من هون! عندك مهام ترحيبية بسيطة بتستناك.',
  searchTip: '💡 محتار بأول كلمة؟ جرب اكتب Sword أو Book وشوف السحر كيف بيصير! ⚔️',
  firstWordToast: 'شوف! زادت نقاط خبرتك الـ XP.. اضغط على صورتك فوق ع اليمين وشوف كم صارت! 🔥',
  treasureUnlock: '🔓 انفتحت لك ميزة الصندوق! روح شوف خانة المكافآت بالأسفل وافتح صندوقك اليومي لتكسب مكافآت جديدة وتثبت حماسلك!',
};

let emptyOnboardingState = {
  active: false,
  phase: 0,
  questTip: null,
  searchTip: null,
  repositionHandler: null,
};

function hasCompletedEmptyOnboarding() {
  return localStorage.getItem(EMPTY_ONBOARDING_STORAGE_KEY) === 'true';
}

function getPersonalDictionaryWordsSnapshot() {
  if (typeof readWordsFromStorage === 'function') {
    try {
      const stored = readWordsFromStorage('normal');
      if (Array.isArray(stored)) return stored;
    } catch (_) {}
  }
  return Array.isArray(window.words) ? window.words : [];
}

function getDictionaryWordCount() {
  return getPersonalDictionaryWordsSnapshot().length;
}

function shouldRunEmptyOnboarding() {
  if (hasCompletedEmptyOnboarding()) return false;
  if (getDictionaryWordCount() > 0) return false;
  if (document.documentElement.classList.contains('onboarding-active')) return false;
  return true;
}

function isIntroQuestMode() {
  return shouldRunEmptyOnboarding();
}

function getActiveQuestDefs() {
  return isIntroQuestMode() ? ONBOARDING_INTRO_QUEST_DEFS : DAILY_QUEST_DEFS;
}

function canStartEmptyOnboardingNow() {
  if (isInitialLoad || window.isInitialLoad) return false;
  if (window.__initialFeatureLoadPending instanceof Set && window.__initialFeatureLoadPending.has('words')) return false;
  return true;
}

function getDailyQuestState() {
  return loadJSON(getDailyQuestStorageKey(), { claimed: {}, flags: {} });
}

function getDailyQuestStorageKey(date = todayStr()) {
  return 'lootlinguaDailyQuests_' + date;
}

function saveDailyQuestState(state) {
  saveJSON(getDailyQuestStorageKey(), state);
  if (!hasSignedInUser()) markGuestDataDirty();
  if (window.saveProfileToCloud) window.saveProfileToCloud();
}

function isDailyQuestDone(id) {
  if (id === 'introSearch') {
    const wordInput = document.getElementById('wordInput');
    const suggestions = document.getElementById('suggestionsList');
    const hasInput = Boolean(wordInput?.value.trim());
    const hasSuggestions = Boolean(suggestions?.querySelector('.sug-item, .suggestion-item, li, button'));
    return hasInput || hasSuggestions;
  }
  if (id === 'introAdd') return getDictionaryWordCount() >= 1;
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
  const def = getActiveQuestDefs().find(q => q.id === id);
  if (!def || def.introOnly || !isDailyQuestDone(id)) return;
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
  if (!opening) {
    closeDailyQuestsSheet();
    return;
  }
  if (opening) closeNotificationsPanel(true);
  sheet.classList.toggle('open', opening);
  backdrop?.classList.toggle('open', opening);
  sheet.setAttribute('aria-hidden', opening ? 'false' : 'true');
  btn?.setAttribute('aria-expanded', opening ? 'true' : 'false');
  document.body.classList.toggle('daily-quests-open', opening);
  if (opening) renderDailyQuests();
  setAppRoute('overlay', 'quests');
};

window.closeDailyQuestsSheet = function(silent) {
  const sheet = document.getElementById('dailyQuestsSheet');
  const wasOpen = sheet?.classList.contains('open');
  const close = () => {
    const backdrop = document.getElementById('dailyQuestsBackdrop');
    const btn = document.getElementById('dailyQuestsBtn');
    if (!sheet) return;
    sheet.classList.remove('open');
    backdrop?.classList.remove('open');
    sheet.setAttribute('aria-hidden', 'true');
    btn?.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('daily-quests-open');
    if (wasOpen && emptyOnboardingState.active && emptyOnboardingState.phase === 1) {
      startEmptyOnboardingPhase2();
    }
  };
  if (silent) close();
  else closeRouteEntry('overlay', 'quests', close);
};

function updateDailyQuestsBadge() {
  const badge = document.getElementById('dailyQuestsBadge');
  if (!badge) return;
  const defs = getActiveQuestDefs();
  const done = defs.filter(q => isDailyQuestDone(q.id)).length;
  badge.textContent = done + '/' + defs.length;
  const btn = document.getElementById('dailyQuestsBtn');
  if (btn) btn.classList.toggle('has-pending', done < defs.length);
}

function renderDailyQuests() {
  const list = document.getElementById('dailyQuestsList');
  if (!list) return;
  updateDailyQuestsBadge();
  const defs = getActiveQuestDefs();
  const hint = document.getElementById('dailyQuestsResetHint');
  if (hint) {
    hint.textContent = isIntroQuestMode()
      ? 'مهام ترحيبية بسيطة — ابدأ من أول خطوة وكمّل على مزاجك'
      : 'تتجدد كل يوم — اضغط المهمة المكتملة لاستلام XP';
  }
  const state = getDailyQuestState();
  list.innerHTML = defs.map(q => {
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
    const def = defs.find((q) => q.id === id);
    if (def?.introOnly) return;
    const st = getDailyQuestState();
    if (!st.claimed[id]) {
      el.style.cursor = 'pointer';
      el.onclick = () => claimDailyQuest(id);
    }
  });
}

function unbindEmptyOnboardingReposition() {
  if (!emptyOnboardingState.repositionHandler) return;
  window.removeEventListener('resize', emptyOnboardingState.repositionHandler);
  window.removeEventListener('scroll', emptyOnboardingState.repositionHandler, true);
  emptyOnboardingState.repositionHandler = null;
}

function positionEmptyOnboardingTooltip(tip, anchor, placement = 'above') {
  if (!tip || !anchor) return;
  tip.classList.remove('placement-above', 'placement-below', 'placement-below-bar');
  const width = tip.offsetWidth || 280;
  const height = tip.offsetHeight || 72;

  if (placement === 'below-bar') {
    const topBar = document.getElementById('legendTopBar') || anchor.closest('.legend-top-bar');
    const barRect = topBar?.getBoundingClientRect();
    const btnRect = anchor.getBoundingClientRect();
    if (!barRect) return;
    tip.classList.add('placement-below-bar');
    let top = barRect.bottom + 10;
    let left = btnRect.left + btnRect.width / 2 - width / 2;
    left = Math.max(12, Math.min(left, window.innerWidth - width - 12));
    top = Math.max(barRect.bottom + 8, Math.min(top, window.innerHeight - height - 12));
    tip.style.top = `${top}px`;
    tip.style.left = `${left}px`;
    const arrowLeft = btnRect.left + btnRect.width / 2 - left;
    tip.style.setProperty('--tip-arrow-left', `${arrowLeft}px`);
    return;
  }

  tip.classList.add(placement === 'below' ? 'placement-below' : 'placement-above');
  const rect = anchor.getBoundingClientRect();
  let top = placement === 'below' ? rect.bottom + 14 : rect.top - height - 14;
  let left = rect.left + rect.width / 2 - width / 2;
  left = Math.max(12, Math.min(left, window.innerWidth - width - 12));
  top = Math.max(12, Math.min(top, window.innerHeight - height - 12));
  tip.style.top = `${top}px`;
  tip.style.left = `${left}px`;
}

function bindEmptyOnboardingReposition(tip, anchor, placement) {
  unbindEmptyOnboardingReposition();
  const handler = () => positionEmptyOnboardingTooltip(tip, anchor, placement);
  emptyOnboardingState.repositionHandler = handler;
  window.addEventListener('resize', handler);
  window.addEventListener('scroll', handler, true);
}

function createEmptyOnboardingTooltip(text, anchor, placement = 'above') {
  const tip = document.createElement('div');
  tip.className = 'empty-onboarding-tip';
  tip.setAttribute('role', 'tooltip');
  tip.innerHTML = `<span class="empty-onboarding-tip-inner">${text}</span>`;
  document.body.appendChild(tip);
  positionEmptyOnboardingTooltip(tip, anchor, placement);
  requestAnimationFrame(() => {
    positionEmptyOnboardingTooltip(tip, anchor, placement);
    tip.classList.add('visible');
  });
  bindEmptyOnboardingReposition(tip, anchor, placement);
  return tip;
}

function removeEmptyOnboardingTooltip(tip, onDone) {
  if (!tip) {
    onDone?.();
    return;
  }
  tip.classList.remove('visible');
  tip.classList.add('fade-out');
  const finish = () => {
    tip.remove();
    onDone?.();
  };
  tip.addEventListener('transitionend', finish, { once: true });
  setTimeout(finish, 380);
}

function hideEmptyOnboardingQuestTooltip(onDone) {
  if (!emptyOnboardingState.questTip) {
    onDone?.();
    return;
  }
  const tip = emptyOnboardingState.questTip;
  emptyOnboardingState.questTip = null;
  removeEmptyOnboardingTooltip(tip, onDone);
}

function removeOrphanEmptyOnboardingTips() {
  document.querySelectorAll('.empty-onboarding-tip').forEach((tip) => {
    if (tip !== emptyOnboardingState.questTip && tip !== emptyOnboardingState.searchTip) {
      tip.remove();
    }
  });
}

function hideEmptyOnboardingSearchTooltip() {
  unbindEmptyOnboardingSearchDismiss();
  if (emptyOnboardingState.searchTip) {
    const tip = emptyOnboardingState.searchTip;
    emptyOnboardingState.searchTip = null;
    removeEmptyOnboardingTooltip(tip);
  }
  document.querySelectorAll('.empty-onboarding-tip').forEach((tip) => {
    if (tip !== emptyOnboardingState.questTip) tip.remove();
  });
}

function hideAllEmptyOnboardingTooltips() {
  hideEmptyOnboardingQuestTooltip();
  hideEmptyOnboardingSearchTooltip();
  removeOrphanEmptyOnboardingTips();
  unbindEmptyOnboardingReposition();
}

function unbindEmptyOnboardingSearchDismiss() {
  const wordInput = document.getElementById('wordInput');
  if (!wordInput?.__emptyOnboardingDismiss) return;
  const dismiss = wordInput.__emptyOnboardingDismiss;
  wordInput.removeEventListener('input', dismiss);
  wordInput.removeEventListener('focus', dismiss);
  wordInput.removeEventListener('keydown', dismiss);
  wordInput.removeEventListener('pointerdown', dismiss);
  wordInput.removeEventListener('click', dismiss);
  wordInput.__emptyOnboardingDismiss = null;
}

function bindEmptyOnboardingSearchDismiss() {
  const wordInput = document.getElementById('wordInput');
  if (!wordInput) return;
  unbindEmptyOnboardingSearchDismiss();
  const dismiss = () => {
    hideEmptyOnboardingSearchTooltip();
    removeOrphanEmptyOnboardingTips();
  };
  wordInput.__emptyOnboardingDismiss = dismiss;
  wordInput.addEventListener('input', dismiss);
  wordInput.addEventListener('focus', dismiss);
  wordInput.addEventListener('keydown', dismiss);
  wordInput.addEventListener('pointerdown', dismiss);
  wordInput.addEventListener('click', dismiss);
}

function initEmptyOnboardingInputWatcher() {
  if (window.__emptyOnboardingInputWatcher) return;
  window.__emptyOnboardingInputWatcher = true;
  const isPersonalSearchTarget = (el) => {
    if (!el) return false;
    if (el.id === 'wordInput') return true;
    return Boolean(el.closest?.('#normalSearchZone'));
  };
  const dismissIfTyping = (e) => {
    if (!emptyOnboardingState.searchTip && !document.querySelector('.empty-onboarding-tip')) return;
    if (!isPersonalSearchTarget(e.target)) return;
    hideEmptyOnboardingSearchTooltip();
  };
  document.addEventListener('input', dismissIfTyping, true);
  document.addEventListener('keydown', dismissIfTyping, true);
  document.addEventListener('beforeinput', dismissIfTyping, true);
  document.addEventListener('compositionstart', dismissIfTyping, true);
}

function startEmptyOnboardingPhase1() {
  if (!shouldRunEmptyOnboarding() || emptyOnboardingState.active) return;
  initEmptyOnboardingInputWatcher();
  const btn = document.getElementById('dailyQuestsBtn');
  if (!btn) return;
  emptyOnboardingState.active = true;
  emptyOnboardingState.phase = 1;
  emptyOnboardingState.questTip = createEmptyOnboardingTooltip(EMPTY_ONBOARDING_COPY.questTip, btn, 'below-bar');
  updateDailyQuestsBadge();
}

function startEmptyOnboardingPhase2() {
  if (!emptyOnboardingState.active || emptyOnboardingState.phase !== 1) return;
  emptyOnboardingState.phase = 2;
  const wordInput = document.getElementById('wordInput');
  if (!wordInput) return;
  hideEmptyOnboardingQuestTooltip(() => {
    if (!shouldRunEmptyOnboarding()) {
      hideAllEmptyOnboardingTooltips();
      emptyOnboardingState.active = false;
      emptyOnboardingState.phase = 0;
      return;
    }
    removeOrphanEmptyOnboardingTips();
    if (emptyOnboardingState.searchTip) {
      removeEmptyOnboardingTooltip(emptyOnboardingState.searchTip);
      emptyOnboardingState.searchTip = null;
    }
    emptyOnboardingState.searchTip = createEmptyOnboardingTooltip(
      EMPTY_ONBOARDING_COPY.searchTip,
      wordInput,
      'below'
    );
    bindEmptyOnboardingSearchDismiss();
  });
}

function highlightTreasureDockForOnboarding() {
  const btn = document.querySelector('.legend-dock-btn[data-dock-view="treasure"]');
  if (!btn) return;
  btn.classList.remove('pulse-onboarding-highlight');
  void btn.offsetWidth;
  btn.classList.add('pulse-onboarding-highlight');
  setTimeout(() => btn.classList.remove('pulse-onboarding-highlight'), 4200);
}

function completeEmptyOnboardingFirstWord() {
  if (hasCompletedEmptyOnboarding()) return;
  hideAllEmptyOnboardingTooltips();
  emptyOnboardingState.active = false;
  emptyOnboardingState.phase = 3;
  showToast(EMPTY_ONBOARDING_COPY.firstWordToast, 'success', 5000);
  setTimeout(() => {
    pushNotification(EMPTY_ONBOARDING_COPY.treasureUnlock, 'success');
    refreshFeatureUnlockUI();
    highlightTreasureDockForOnboarding();
    localStorage.setItem(EMPTY_ONBOARDING_STORAGE_KEY, 'true');
    emptyOnboardingState.phase = 0;
    updateDailyQuestsBadge();
    if (document.getElementById('dailyQuestsSheet')?.classList.contains('open')) renderDailyQuests();
  }, 5200);
}

function notifyDictionaryWordAdded() {
  if (getDictionaryWordCount() !== 1) return;
  if (hasCompletedEmptyOnboarding()) return;
  completeEmptyOnboardingFirstWord();
}

window.tryStartEmptyOnboarding = function() {
  if (!canStartEmptyOnboardingNow() || !shouldRunEmptyOnboarding()) return;
  if (emptyOnboardingState.active) return;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (!canStartEmptyOnboardingNow() || !shouldRunEmptyOnboarding() || emptyOnboardingState.active) return;
      startEmptyOnboardingPhase1();
    });
  });
};

// ── زر الرجوع (عوالم ← كلمات صعبة / قواميس) ──
let viewBackTarget = 'worlds';

function setViewBackBar(visible, label) {
  const nav = document.getElementById('viewNavBar');
  const lbl = document.getElementById('viewBackLabel');
  const btn = document.getElementById('viewBackBar');
  if (!nav) return;
  nav.style.display = '';
  document.body.classList.toggle('view-has-back', Boolean(visible));
  nav.setAttribute('aria-hidden', visible ? 'false' : 'true');
  if (label) {
    if (lbl) lbl.textContent = label;
    if (btn) {
      btn.setAttribute('aria-label', label);
      btn.dataset.tip = label;
    }
  }
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
const LEGACY_DICTIONARY_KEY = 'lootlinguaDict';
const WORDS_NORMAL_PREFIX = 'words_normal_';
const WORDS_GAMER_PREFIX = 'words_gamer_';
const GUEST_MIGRATION_HANDLED_KEY = 'lootlinguaGuestMigrationHandled';
const GUEST_MIGRATION_COMPLETE_KEY = 'lootlingua_migration_complete';
const GUEST_DATA_DIRTY_KEY = 'lootlinguaGuestDataDirty';
const GUEST_PROFILE_DIRTY_KEYS = new Set([
  'userXP',
  'dailyStreak',
  'lootlinguaMaxStreak',
  'lastActivityDate',
  'activityMap',
  'addedGameWords',
  'lootlinguaDailyLootState',
  'lootlinguaTitlesState',
  'lootlinguaActiveTitleId',
  'lootlinguaStreakFreezes',
  'lootlinguaFreezeSaves',
  'lootlinguaGameDictAdds',
  'lootlinguaPerfectQuizzes',
  'lootlinguaExtraChests',
]);
const GUEST_PROFILE_DIRTY_PREFIXES = ['lootlinguaDailyQuests_'];

function hasSignedInUser() {
  return Boolean(window.auth?.currentUser);
}

function markGuestDataDirty() {
  if (hasSignedInUser()) return;
  localStorage.setItem(GUEST_DATA_DIRTY_KEY, '1');
  localStorage.removeItem(GUEST_MIGRATION_HANDLED_KEY);
}

function markGuestProfileDataDirty(key) {
  if (window.__applyingCloudProfile || hasSignedInUser()) return;
  if (GUEST_PROFILE_DIRTY_KEYS.has(key) || GUEST_PROFILE_DIRTY_PREFIXES.some(prefix => key.startsWith(prefix))) {
    markGuestDataDirty();
  }
}

function markGuestMigrationHandled(user, status) {
  localStorage.setItem(GUEST_MIGRATION_HANDLED_KEY, JSON.stringify({
    status,
    uid: user?.uid || '',
    at: Date.now()
  }));
  localStorage.removeItem(GUEST_DATA_DIRTY_KEY);
}

function hasHandledGuestMigration() {
  return Boolean(localStorage.getItem(GUEST_MIGRATION_HANDLED_KEY));
}

function hasHandledGuestMigrationForUser(uid) {
  if (!uid) return hasHandledGuestMigration();
  try {
    const raw = localStorage.getItem(GUEST_MIGRATION_HANDLED_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    return data.uid === uid;
  } catch {
    return hasHandledGuestMigration();
  }
}

function isGuestMigrationComplete(uid) {
  if (!uid) return localStorage.getItem(GUEST_MIGRATION_COMPLETE_KEY) === 'true';
  try {
    const raw = localStorage.getItem(GUEST_MIGRATION_COMPLETE_KEY);
    if (!raw) return false;
    if (raw === 'true') return true;
    const data = JSON.parse(raw);
    return data.uid === uid;
  } catch {
    return localStorage.getItem(GUEST_MIGRATION_COMPLETE_KEY) === 'true';
  }
}

function markGuestMigrationCompleteFlag(user, status) {
  localStorage.setItem(GUEST_MIGRATION_COMPLETE_KEY, JSON.stringify({
    uid: user?.uid || '',
    status,
    at: Date.now()
  }));
  markGuestMigrationHandled(user, status);
  localStorage.removeItem(GUEST_DATA_DIRTY_KEY);
  window.__guestMigrationSessionComplete = true;
}

function purgeStaleGuestLocalData() {
  localStorage.removeItem(getWordsStorageKey('normal', 'guest'));
  localStorage.removeItem(getWordsStorageKey('gamer', 'guest'));
  localStorage.removeItem(LEGACY_DICTIONARY_KEY);
  localStorage.removeItem(GUEST_DATA_DIRTY_KEY);
  GUEST_PROFILE_DIRTY_KEYS.forEach((key) => localStorage.removeItem(key));
  Object.keys(localStorage).forEach((key) => {
    if (GUEST_PROFILE_DIRTY_PREFIXES.some((prefix) => key.startsWith(prefix))) {
      localStorage.removeItem(key);
    }
  });
  if (typeof clearGuestSearchLocks === 'function') clearGuestSearchLocks();
}
window.purgeStaleGuestLocalData = purgeStaleGuestLocalData;

function getGuestLootSnapshot() {
  return {
    words: getGuestMigrationWords(),
    profile: getGuestProgressSnapshot(),
  };
}

function hasMeaningfulGuestLoot(snapshot) {
  const loot = snapshot || getGuestLootSnapshot();
  const words = loot.words || [];
  const p = loot.profile || {};
  const xp = Math.max(Number(p.userXP) || 0, hasSignedInUser() ? 0 : (Number(userXP) || 0));
  if (words.length === 0 && xp === 0) return false;
  if (words.length > 0) return true;
  if (xp > 0) return true;
  if ((Number(p.dailyStreak) || 0) > 0) return true;
  if ((Number(p.maxStreak) || 0) > 0) return true;
  if ((Number(p.streakFreezes) || 0) > 0) return true;
  if ((Number(p.freezeSaves) || 0) > 0) return true;
  if ((Number(p.gameDictAdds) || 0) > 0) return true;
  if ((Number(p.perfectQuizzes) || 0) > 0) return true;
  const titles = p.titlesState?.unlocked;
  if (Array.isArray(titles) && titles.length > 0) return true;
  const lootState = p.dailyLootState;
  if (lootState && ((Number(lootState.totalOpens) || 0) > 0 || (Number(lootState.streak) || 0) > 0)) return true;
  if (Array.isArray(p.addedGameWords) && p.addedGameWords.length > 0) return true;
  if (Array.isArray(p.extraChests) && p.extraChests.length > 0) return true;
  return false;
}

function reconcileEmptyGuestSessionState() {
  if (hasSignedInUser()) return;
  if ((Array.isArray(window.words) ? window.words.length : 0) > 0) return;
  if ((Number(userXP) || 0) > 0) return;
  purgeStaleGuestLocalData();
  resetGuestProgressState();
  localStorage.removeItem(GUEST_MIGRATION_HANDLED_KEY);
  localStorage.removeItem(GUEST_MIGRATION_COMPLETE_KEY);
  window.__guestMigrationSessionComplete = true;
}
window.reconcileEmptyGuestSessionState = reconcileEmptyGuestSessionState;
window.hasMeaningfulGuestLoot = hasMeaningfulGuestLoot;

function hasUserWordsCache(uid) {
  if (!uid) return false;
  return localStorage.getItem(getWordsStorageKey('normal', uid)) !== null;
}

function shouldSkipGuestMigrationPrompt(user) {
  if (!user?.uid) return true;
  if (!hasMeaningfulGuestLoot()) {
    reconcileEmptyGuestSessionState();
    return true;
  }
  if (window.__guestMigrationSessionComplete) return true;
  if (isGuestMigrationComplete(user.uid)) {
    purgeStaleGuestLocalData();
    return true;
  }
  if (hasHandledGuestMigrationForUser(user.uid)) {
    purgeStaleGuestLocalData();
    return true;
  }
  if (window._profileLoaded) {
    purgeStaleGuestLocalData();
    return true;
  }
  if (hasSignedInUser() && hasUserWordsCache(user.uid) && !hasDirtyGuestData()) {
    purgeStaleGuestLocalData();
    return true;
  }
  return false;
}

function hasDirtyGuestData() {
  return localStorage.getItem(GUEST_DATA_DIRTY_KEY) === '1';
}

function getStorageUserId(uid) {
  return uid || window.auth?.currentUser?.uid || 'guest';
}

function getWordsStorageKey(type = 'normal', uid) {
  const prefix = type === 'gamer' ? WORDS_GAMER_PREFIX : WORDS_NORMAL_PREFIX;
  return prefix + getStorageUserId(uid);
}

function readWordsFromStorage(type = 'normal', uid) {
  const key = getWordsStorageKey(type, uid);
  const legacy = !uid && getStorageUserId(uid) === 'guest' ? localStorage.getItem(LEGACY_DICTIONARY_KEY) : null;
  try {
    const raw = localStorage.getItem(key) ?? legacy;
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeWordsToStorage(words = window.words, type = 'normal', uid) {
  localStorage.setItem(getWordsStorageKey(type, uid), JSON.stringify(Array.isArray(words) ? words : []));
  if (getStorageUserId(uid) === 'guest' && Array.isArray(words) && words.length > 0) {
    markGuestDataDirty();
  }
}

window.getWordsStorageKey = getWordsStorageKey;
window.readWordsFromStorage = readWordsFromStorage;
window.writeWordsToStorage = writeWordsToStorage;
window.replaceWordsForCurrentUser = function(words, type = 'normal', uid) {
  window.words = Array.isArray(words) ? words : [];
  writeWordsToStorage(window.words, type, uid);
};

window.clearDictionaryState = function({ renderView = true } = {}) {
  window.words = [];
  editId = null;
  pendingDeleteId = null;
  selectedIndices = [];
  isReorderMode = false;
  renderLimit = 20;
  if (renderView && typeof render === 'function') render();
};

window.loadGuestDictionaryState = function({ renderView = true } = {}) {
  loadDictionarySortPrefs();
  window.words = applyStoredWordOrder(readWordsFromStorage('normal', 'guest'));
  if (dictionarySortMode !== 'auto') {
    window.words = sortDictionaryWords(window.words);
  }
  editId = null;
  pendingDeleteId = null;
  selectedIndices = [];
  isReorderMode = false;
  renderLimit = 20;
  if (renderView && typeof render === 'function') render();
};

let currentFilter    = 'all';
let editId           = null;
let isReorderMode    = false;
let selectedIndices  = [];
let dictionarySortMode = 'auto';
let dictionarySortCategory = 'all';
const WORD_CATEGORY_OPTIONS = [
  { value: 'عام', label: 'عام' },
  { value: 'فعل', label: 'فعل' },
  { value: 'اسم', label: 'اسم' },
  { value: 'صفة', label: 'صفة' },
  { value: 'أداة', label: 'أداة' },
  { value: 'ظرف', label: 'ظرف' },
  { value: 'جمل', label: 'جمل شائعة' },
];
const CATEGORY_SORT_ORDER = ['عام', 'اسم', 'فعل', 'صفة', 'أداة', 'ظرف', 'جمل', 'لعبة'];
const SEARCH_FILTER_LABELS = {
  all: 'بحث في الكل',
  word: 'الكلمة فقط',
  meaning: 'المعنى فقط',
  example: 'الجملة فقط',
};
let _wordOrderSyncTimer = null;

function getDictSortStorageKey() {
  return 'lootlinguaDictSort_' + getStorageUserId();
}

function loadDictionarySortPrefs() {
  try {
    const saved = JSON.parse(localStorage.getItem(getDictSortStorageKey()) || '{}');
    const validModes = ['auto', 'newest', 'oldest', 'alpha', 'category'];
    if (validModes.includes(saved.mode)) dictionarySortMode = saved.mode;
    if (saved.category) dictionarySortCategory = String(saved.category);
  } catch {}
  if (document.body) {
    syncDictionarySortUI();
    syncAppDropdownLabels();
  }
}

function saveDictionarySortPrefs() {
  localStorage.setItem(getDictSortStorageKey(), JSON.stringify({
    mode: dictionarySortMode,
    category: dictionarySortCategory,
  }));
}

function reindexWordOrder(words = window.words) {
  if (!Array.isArray(words)) return [];
  words.forEach((word, index) => { word.order = index; });
  return words;
}

function applyStoredWordOrder(words) {
  const arr = Array.isArray(words) ? [...words] : [];
  if (!arr.length) return arr;
  if (arr.some((word) => Number.isFinite(word?.order))) {
    arr.sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER));
    return reindexWordOrder(arr);
  }
  return reindexWordOrder(arr);
}

function scheduleWordOrderCloudSync() {
  clearTimeout(_wordOrderSyncTimer);
  _wordOrderSyncTimer = setTimeout(() => {
    syncWordOrdersToCloud().catch(() => {});
  }, 450);
}

async function syncWordOrdersToCloud() {
  const user = window.auth?.currentUser;
  if (!user || !window.updateWordInCloud || !Array.isArray(window.words)) return;
  await Promise.all(
    window.words.map((word, index) => window.updateWordInCloud(word.id, { order: index }))
  );
}

function closeAppDropdowns(exceptWrap = null) {
  document.querySelectorAll('.app-dropdown-menu.open').forEach((menu) => {
    const wrap = menu.closest('.app-dropdown-wrap');
    if (exceptWrap && wrap === exceptWrap) return;
    menu.classList.remove('open');
    wrap?.querySelector('.app-dropdown-trigger')?.setAttribute('aria-expanded', 'false');
    wrap?.querySelector('.app-dropdown-trigger-icon')?.setAttribute('aria-expanded', 'false');
  });
}

function syncAppDropdownLabels() {
  const searchFilter = document.getElementById('searchFilter');
  const searchBtn = document.getElementById('searchFilterBtn');
  if (searchFilter && searchBtn) {
    const label = SEARCH_FILTER_LABELS[searchFilter.value] || SEARCH_FILTER_LABELS.all;
    searchBtn.setAttribute('aria-label', `إعدادات البحث: ${label}`);
    searchBtn.removeAttribute('title');
    searchBtn.dataset.tip = 'إعدادات البحث';
  }
  const categoryInput = document.getElementById('categoryInput');
  const categoryBtn = document.getElementById('categoryDropdownBtn');
  if (categoryInput && categoryBtn) {
    const option = WORD_CATEGORY_OPTIONS.find((item) => item.value === categoryInput.value);
    categoryBtn.textContent = option?.label || categoryInput.value || 'عام';
  }
}

function setSearchFilterValue(value) {
  const input = document.getElementById('searchFilter');
  const menu = document.getElementById('searchFilterMenu');
  if (!input) return;
  input.value = value;
  menu?.querySelectorAll('[data-value]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.value === value);
  });
  syncAppDropdownLabels();
  renderLimit = 20;
  render();
}

function setCategoryDropdownValue(value) {
  const input = document.getElementById('categoryInput');
  const menu = document.getElementById('categoryDropdownMenu');
  if (!input) return;
  input.value = value;
  menu?.querySelectorAll('[data-value]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.value === value);
  });
  syncAppDropdownLabels();
}

function initAppDropdowns() {
  initSearchFilterDropdown();
  initCategoryDropdown();

  document.querySelectorAll('.app-dropdown-wrap').forEach((wrap) => {
    if (wrap.dataset.dropdownReady === '1') return;
    if (wrap.id === 'searchFilterWrap' || wrap.id === 'categoryDropdownWrap') return;
    const trigger = wrap.querySelector('.app-dropdown-trigger');
    const menu = wrap.querySelector('.app-dropdown-menu');
    if (!trigger || !menu) return;
    wrap.dataset.dropdownReady = '1';
    trigger.addEventListener('click', (event) => {
      event.stopPropagation();
      const willOpen = !menu.classList.contains('open');
      closeAppDropdowns(wrap);
      menu.classList.toggle('open', willOpen);
      trigger.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
    });
  });
}

function initSearchFilterDropdown() {
  const searchWrap = document.getElementById('searchFilterWrap');
  const searchTrigger = document.getElementById('searchFilterBtn');
  const searchMenu = document.getElementById('searchFilterMenu');
  if (!searchWrap || !searchTrigger || !searchMenu || searchWrap.dataset.dropdownReady === '1') return;
  searchWrap.dataset.dropdownReady = '1';
  searchTrigger.addEventListener('click', (event) => {
    event.stopPropagation();
    const willOpen = !searchMenu.classList.contains('open');
    closeAppDropdowns(searchWrap);
    searchMenu.classList.toggle('open', willOpen);
    searchTrigger.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
  });
  searchMenu.querySelectorAll('[data-value]').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      setSearchFilterValue(btn.dataset.value || 'all');
      searchMenu.classList.remove('open');
      searchTrigger.setAttribute('aria-expanded', 'false');
    });
  });
}

function initCategoryDropdown() {
  const categoryWrap = document.getElementById('categoryDropdownWrap');
  const categoryTrigger = document.getElementById('categoryDropdownBtn');
  const categoryMenu = document.getElementById('categoryDropdownMenu');
  if (!categoryWrap || !categoryTrigger || !categoryMenu || categoryWrap.dataset.dropdownReady === '1') return;
  categoryWrap.dataset.dropdownReady = '1';
  categoryTrigger.addEventListener('click', (event) => {
    event.stopPropagation();
    const willOpen = !categoryMenu.classList.contains('open');
    closeAppDropdowns(categoryWrap);
    categoryMenu.classList.toggle('open', willOpen);
    categoryTrigger.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
  });
  categoryMenu.querySelectorAll('[data-value]').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      setCategoryDropdownValue(btn.dataset.value || 'عام');
      categoryMenu.classList.remove('open');
      categoryTrigger.setAttribute('aria-expanded', 'false');
    });
  });
}

window.toggleSortCategorySubmenu = function(event) {
  event?.preventDefault();
  event?.stopPropagation();
  document.querySelector('.sort-submenu-wrap')?.classList.toggle('open');
};
let isBulkDeleteMode = false;
let bulkSelectedWordIds = new Set();
let suppressDeleteClickOnce = false;
let currentQuizWords = [];
let quizIndex        = 0;
let currentStreak    = 0;
let pendingDeleteId  = null;
let userXP           = parseInt(localStorage.getItem('userXP')) || 0;
let dailyStreak      = loadInt('dailyStreak', 0);
let lastActivity     = localStorage.getItem('lastActivityDate') || '';
let currentView      = 'personal'; // 'personal' | 'worlds' | 'minecraft' | 'pubg' | 'starred' | 'quiz' | 'treasure'
let renderLimit      = 20;  // عدد الكلمات التي تظهر في البداية
const WORD_RENDER_FAST_MODE = true;
const WORD_DOM_WINDOW_SIZE = 48;
const WORD_DOM_BUFFER = 8;
const WORD_DOM_EDGE_BUFFER = 8;
const WORD_RENDER_TRANSITION_MS = 48;
const WORD_RENDER_SCROLL_THROTTLE_MS = 120;
let wordVirtualState = {
  key: '',
  start: 0,
  end: 0,
  rowHeight: 126,
  listTop: 0,
  lastHtmlKey: '',
  total: 0,
  isTransitioning: false,
  transitionTargetY: null,
  transitionPinnedY: null,
  transitionTimer: null,
  loadingTimer: null,
  programmaticScroll: false
};
let currentQuizMistakes = 0;
let isInitialLoad = true;
window.isInitialLoad = true;
window.__initialFeatureLoadPending = new Set();
window.__suppressUnlockNotices = true;
window.beginInitialFeatureLoad = function(parts = []) {
  isInitialLoad = true;
  window.isInitialLoad = true;
  window.__suppressUnlockNotices = true;
  window.__initialFeatureLoadPending = new Set(Array.isArray(parts) ? parts : []);
};
window.finishInitialFeatureLoad = function() {
  isInitialLoad = false;
  window.isInitialLoad = false;
  window.__suppressUnlockNotices = false;
  window.__initialFeatureLoadPending?.clear?.();
  if (typeof tryStartEmptyOnboarding === 'function') tryStartEmptyOnboarding();
};
window.markInitialFeatureLoadPartDone = function(part) {
  if (part && window.__initialFeatureLoadPending instanceof Set) {
    window.__initialFeatureLoadPending.delete(part);
  }
  if (!(window.__initialFeatureLoadPending instanceof Set) || window.__initialFeatureLoadPending.size === 0) {
    setTimeout(() => {
      if (!(window.__initialFeatureLoadPending instanceof Set) || window.__initialFeatureLoadPending.size === 0) {
        window.finishInitialFeatureLoad();
      }
    }, 250);
  }
};

function shouldSuppressUnlockNotices() {
  return isInitialLoad === true || window.__suppressUnlockNotices === true || window.__applyingCloudProfile === true;
}

function safeVibrate(duration = 80) {
  try {
    if (navigator?.vibrate) navigator.vibrate(duration);
  } catch {}
}

function triggerShakeEffect(target, duration = 320) {
  const el = typeof target === 'string' ? document.querySelector(target) : target;
  if (!el) return;
  el.classList.remove('shake-effect');
  void el.offsetWidth;
  el.classList.add('shake-effect');
  setTimeout(() => el.classList.remove('shake-effect'), duration);
}

function cssEscapeValue(value) {
  if (window.CSS?.escape) return CSS.escape(String(value));
  return String(value).replace(/["\\]/g, '\\$&');
}

function getWordSortStamp(word) {
  const created = word?.createdAt || word?.timestamp || word?.addedAt;
  if (created?.toMillis) return created.toMillis();
  const parsed = Date.parse(created || '');
  if (Number.isFinite(parsed)) return parsed;
  const numericId = parseInt(word?.id, 10);
  return Number.isFinite(numericId) ? numericId : 0;
}

function sortDictionaryWords(wordsToSort) {
  const sorted = [...wordsToSort];
  if (dictionarySortMode === 'auto') {
    if (sorted.some((word) => Number.isFinite(word?.order))) {
      sorted.sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER));
    }
    return sorted;
  }
  if (dictionarySortMode === 'oldest') {
    sorted.sort((a, b) => getWordSortStamp(a) - getWordSortStamp(b));
  } else if (dictionarySortMode === 'alpha') {
    sorted.sort((a, b) => String(a.word || '').localeCompare(String(b.word || ''), undefined, { sensitivity: 'base' }));
  } else if (dictionarySortMode === 'newest') {
    sorted.sort((a, b) => getWordSortStamp(b) - getWordSortStamp(a));
  } else if (dictionarySortMode === 'category') {
    sorted.sort((a, b) => {
      const catA = a.category || 'عام';
      const catB = b.category || 'عام';
      if (dictionarySortCategory && dictionarySortCategory !== 'all') {
        const priA = catA === dictionarySortCategory ? 0 : 1;
        const priB = catB === dictionarySortCategory ? 0 : 1;
        if (priA !== priB) return priA - priB;
      } else {
        const idxA = CATEGORY_SORT_ORDER.indexOf(catA);
        const idxB = CATEGORY_SORT_ORDER.indexOf(catB);
        const orderA = idxA === -1 ? CATEGORY_SORT_ORDER.length : idxA;
        const orderB = idxB === -1 ? CATEGORY_SORT_ORDER.length : idxB;
        if (orderA !== orderB) return orderA - orderB;
      }
      return String(a.word || '').localeCompare(String(b.word || ''), undefined, { sensitivity: 'base' });
    });
  }
  return sorted;
}

function syncDictionarySortUI() {
  const btn = document.getElementById('dictionarySortBtn');
  const menu = document.getElementById('dictionarySortMenu');
  if (btn) btn.setAttribute('aria-expanded', String(menu?.classList.contains('open') || false));
  menu?.querySelectorAll('[data-sort-mode]').forEach((item) => {
    const mode = item.dataset.sortMode;
    const category = item.dataset.sortCategory;
    let active = false;
    if (mode === 'category') {
      active = dictionarySortMode === 'category' &&
        (category ? category === dictionarySortCategory : false);
    } else {
      active = dictionarySortMode === mode;
    }
    item.classList.toggle('active', active);
  });
  document.querySelector('.sort-submenu-wrap')?.classList.toggle('open', dictionarySortMode === 'category');
}

window.toggleDictionarySortMenu = function() {
  const menu = document.getElementById('dictionarySortMenu');
  if (!menu) return;
  const willOpen = !menu.classList.contains('open');
  closeAppDropdowns(document.querySelector('.sort-dropdown-wrap'));
  menu.classList.toggle('open', willOpen);
  syncDictionarySortUI();
};

window.setDictionarySortMode = function(mode, category) {
  const validModes = ['auto', 'newest', 'oldest', 'alpha', 'category'];
  dictionarySortMode = validModes.includes(mode) ? mode : 'auto';
  if (mode === 'category') {
    dictionarySortCategory = category || 'all';
  } else {
    dictionarySortCategory = 'all';
  }
  window.words = sortDictionaryWords(window.words);
  saveDictionarySortPrefs();
  if (dictionarySortMode === 'auto') {
    persistDictionary();
  }
  document.getElementById('dictionarySortMenu')?.classList.remove('open');
  document.querySelector('.sort-submenu-wrap')?.classList.toggle('open', dictionarySortMode === 'category');
  renderLimit = 20;
  render();
  syncDictionarySortUI();
};

document.addEventListener('click', (event) => {
  if (!event.target.closest('.sort-dropdown-wrap') && !event.target.closest('.app-dropdown-wrap')) {
    closeAppDropdowns();
    document.getElementById('dictionarySortMenu')?.classList.remove('open');
    syncDictionarySortUI();
  }
});

window.words = applyStoredWordOrder(readWordsFromStorage('normal'));
loadDictionarySortPrefs();
if (dictionarySortMode !== 'auto') {
  window.words = sortDictionaryWords(window.words);
}

window.startVoiceSearch = function() {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const input = document.getElementById('searchInput');
  const btn = document.getElementById('voiceSearchBtn');
  if (!Recognition || !input) {
    showToast('البحث الصوتي غير مدعوم في هذا المتصفح.');
    return;
  }
  if (window.__activeVoiceRecognition) {
    try { window.__activeVoiceRecognition.abort(); } catch (_) {}
    window.__activeVoiceRecognition = null;
  }
  const recognition = new Recognition();
  window.__activeVoiceRecognition = recognition;
  recognition.lang = 'en-US';
  recognition.interimResults = false;
  recognition.maxAlternatives = 5;
  btn?.classList.add('is-listening');
  safeVibrate(35);
  recognition.onresult = (event) => {
    const result = event.results?.[0];
    if (!result) return;
    let bestText = '';
    let bestScore = -1;
    for (let i = 0; i < result.length; i++) {
      const candidate = normalizeVoiceTranscript(result[i].transcript);
      if (!candidate) continue;
      const score = scoreVoiceSearchCandidate(candidate);
      if (score > bestScore) {
        bestScore = score;
        bestText = pickBestVoiceQuery(result[i].transcript);
      }
    }
    if (!bestText) return;
    input.value = bestText;
    renderLimit = 20;
    render();
    showToast(`سمّعنا: ${bestText}`, 'success', 1800);
  };
  recognition.onerror = (event) => {
    if (event?.error === 'aborted') return;
    showToast('تعذر التقاط الصوت. جرّب مرة ثانية.');
  };
  recognition.onend = () => {
    btn?.classList.remove('is-listening');
    if (window.__activeVoiceRecognition === recognition) window.__activeVoiceRecognition = null;
  };
  try {
    recognition.start();
  } catch (_) {
    btn?.classList.remove('is-listening');
    showToast('تعذر تشغيل الميكروفون. جرّب مرة ثانية.');
  }
};

function normalizeVoiceTranscript(text) {
  return String(text || '')
    .trim()
    .toLowerCase()
    .replace(/[.,!?;:'"]/g, '')
    .replace(/\s+/g, ' ');
}

function scoreVoiceSearchCandidate(normalized) {
  if (!normalized) return -1;
  let score = normalized.length;
  const dictWords = Array.isArray(window.words) ? window.words : [];
  dictWords.forEach((entry) => {
    const word = normalizeVoiceTranscript(entry.word);
    if (!word) return;
    if (word === normalized) score += 120;
    else if (word.startsWith(normalized) || normalized.startsWith(word)) score += 60;
  });
  return score;
}

function pickBestVoiceQuery(rawText) {
  const normalized = normalizeVoiceTranscript(rawText);
  if (!normalized) return '';
  const dictWords = Array.isArray(window.words) ? window.words : [];
  const exact = dictWords.find((entry) => normalizeVoiceTranscript(entry.word) === normalized);
  if (exact?.word) return exact.word.trim();
  const partial = dictWords.find((entry) => {
    const word = normalizeVoiceTranscript(entry.word);
    return word.startsWith(normalized) || normalized.startsWith(word);
  });
  if (partial?.word) return partial.word.trim();
  return normalized;
}

function updateBulkDeleteBar() {
  const bar = document.getElementById('bulkDeleteBar');
  const btn = document.getElementById('bulkDeleteConfirmBtn');
  const count = bulkSelectedWordIds.size;
  if (bar) bar.hidden = !isBulkDeleteMode;
  if (btn) btn.textContent = `حذف الكلمات المحددة (${count})`;
}

function syncBulkSelectionInDom(id) {
  const cards = id
    ? [document.querySelector(`.word-card[data-id="${cssEscapeValue(String(id))}"]`)].filter(Boolean)
    : [...document.querySelectorAll('.word-card')];
  cards.forEach((card) => {
    const cardId = card.dataset.id;
    if (!cardId) return;
    card.classList.toggle('bulk-selected', bulkSelectedWordIds.has(String(cardId)));
  });
  updateBulkDeleteBar();
}

function clearBulkSelectionInDom() {
  document.querySelectorAll('.word-card.bulk-selected').forEach((card) => {
    card.classList.remove('bulk-selected');
  });
  updateBulkDeleteBar();
}

function enterBulkDeleteMode(id) {
  if (!id) return;
  if (isReorderMode) toggleReorderMode();
  isBulkDeleteMode = true;
  bulkSelectedWordIds.add(String(id));
  safeVibrate(50);
  syncBulkSelectionInDom(id);
}

window.exitBulkDeleteMode = function() {
  isBulkDeleteMode = false;
  bulkSelectedWordIds.clear();
  clearBulkSelectionInDom();
};

function toggleBulkWordSelection(id) {
  if (!id) return;
  const key = String(id);
  if (bulkSelectedWordIds.has(key)) bulkSelectedWordIds.delete(key);
  else bulkSelectedWordIds.add(key);
  if (!bulkSelectedWordIds.size) {
    window.exitBulkDeleteMode();
    return;
  }
  syncBulkSelectionInDom(key);
}

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
  const words = getPersonalDictionaryWordsSnapshot();
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
  if (p.wordCount >= 1) {
    u.add('starred');
    u.add('treasure');
  }
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
  treasure: {
    title: 'صندوق المكافآت',
    why: 'صندوق المكافآت يفتح بعد ما تضيف أول كلمة لقاموسك.',
    how: 'ابحث عن كلمة وأضفها لقاموسك الشخصي.',
    progress: (p) => {
      const need = 1;
      return p.wordCount >= need
        ? `تقدّمك: ${p.wordCount} كلمة (تم استيفاء الشرط).`
        : `تقدّمك: ${p.wordCount} من ${need} كلمة في القاموس.`;
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
  const suppressUnlockNotice = shouldSuppressUnlockNotices();
  if (!suppressUnlockNotice && window.__navLockAnimSeeded && prev) {
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
  if (!THEME_USE_MESSAGES[theme]) return;
  const key = themeSeenKey('used', theme);
  if (localStorage.getItem(key) === '1') return;
  localStorage.setItem(key, '1');
  setTimeout(() => showToast(THEME_USE_MESSAGES[theme], 'success', 5200), 2400);
}

function bootstrapThemeNotificationKeysOnce() {
  const bootKey = 'lootlingua:themeNotifyBootstrapped';
  if (localStorage.getItem(bootKey) === '1') return;
  Object.keys(THEME_UNLOCK_LEVELS).forEach((theme) => {
    if (isThemeComingSoon(theme) || !isThemeUnlocked(theme)) return;
    localStorage.setItem(themeSeenKey('unlocked', theme), '1');
  });
  const activeTheme = localStorage.getItem('theme') || document.documentElement.getAttribute('data-theme') || 'lootlingua';
  if (THEME_USE_MESSAGES[activeTheme] && isThemeUnlocked(activeTheme)) {
    localStorage.setItem(themeSeenKey('used', activeTheme), '1');
  }
  localStorage.setItem(bootKey, '1');
}

function checkThemeUnlocksAfterXP(prevXP, nextXP) {
  if (shouldSuppressUnlockNotices()) return;
  const oldLevel = getLevelFromXP(prevXP);
  const newLevel = getLevelFromXP(nextXP);
  if (newLevel <= oldLevel) return;
  Object.entries(THEME_UNLOCK_LEVELS).forEach(([theme, requiredLevel]) => {
    if (isThemeComingSoon(theme)) return;
    if (oldLevel >= requiredLevel || newLevel < requiredLevel) return;
    const unlockKey = themeSeenKey('unlocked', theme);
    if (localStorage.getItem(unlockKey) === '1') return;
    localStorage.setItem(unlockKey, '1');
    sessionStorage.removeItem(`lootlingua:themeRelockNotice:${theme}`);
    playUnlockSound();
    const msg = THEME_UNLOCK_MESSAGES[theme];
    if (msg) setTimeout(() => showToast(msg, 'success', 5200), 420);
  });
}

function checkThemeRelocksAfterXP(prevXP, nextXP) {
  const oldLevel = getLevelFromXP(prevXP);
  const newLevel = getLevelFromXP(nextXP);
  if (newLevel >= oldLevel) return;
  Object.entries(THEME_UNLOCK_LEVELS).forEach(([theme, requiredLevel]) => {
    if (isThemeComingSoon(theme)) return;
    if (oldLevel >= requiredLevel && newLevel < requiredLevel) {
      localStorage.removeItem(themeSeenKey('unlocked', theme));
      localStorage.removeItem(themeSeenKey('used', theme));
    }
  });
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
  if (!skipLockCheck && window.saveProfileToCloud) window.saveProfileToCloud();
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
const APP_VIEW_ROUTES = {
  personal: 'dictionary',
  treasure: 'treasure',
  worlds: 'worlds',
  minecraft: 'minecraft',
  pubg: 'pubg',
  starred: 'hard-words',
  quiz: 'quiz',
};
const APP_MODAL_ROUTES = {
  deleteModal: 'delete-word',
  unlockExplainModal: 'locked-feature',
  logoutModal: 'logout',
  guestMigrationModal: 'guest-loot-transfer',
  performanceModeInfoModal: 'performance',
  keyboardShortcutsModal: 'keyboard-shortcuts',
  welcomeModal: 'welcome',
};
const APP_OVERLAY_ROUTES = {
  profile: 'profile',
  stats: 'stats',
  quests: 'daily-quests',
  notifications: 'notifications',
};
const APP_ROUTE_TO_VIEW = Object.fromEntries(Object.entries(APP_VIEW_ROUTES).map(([k, v]) => [v, k]));
const APP_ROUTE_TO_MODAL = Object.fromEntries(Object.entries(APP_MODAL_ROUTES).map(([k, v]) => [v, k]));
const APP_ROUTE_TO_OVERLAY = Object.fromEntries(Object.entries(APP_OVERLAY_ROUTES).map(([k, v]) => [v, k]));
const APP_PROJECT_BASE_PATH = '/LootLingua';
let appRouteSyncing = false;
let appRoutingReady = false;

function getAppBasePath() {
  const pathname = location.pathname || '/';
  const isGithubPages = location.hostname.endsWith('github.io');
  const isProjectPath = pathname === APP_PROJECT_BASE_PATH || pathname.startsWith(APP_PROJECT_BASE_PATH + '/');
  return isGithubPages || isProjectPath ? APP_PROJECT_BASE_PATH : '';
}

function getAppRoutePath(kind, key) {
  const slug = kind === 'modal'
    ? APP_MODAL_ROUTES[key]
    : kind === 'overlay'
      ? APP_OVERLAY_ROUTES[key]
      : APP_VIEW_ROUTES[key || 'personal'];
  return getAppBasePath() + '/' + (slug || APP_VIEW_ROUTES.personal);
}

function parseAppRoute() {
  const basePath = getAppBasePath();
  let pathname = decodeURIComponent(location.pathname || '');
  if (basePath && (pathname === basePath || pathname === basePath + '/')) {
    pathname = '';
  } else if (basePath && pathname.startsWith(basePath + '/')) {
    pathname = pathname.slice(basePath.length);
  }
  const slug = pathname.replace(/^\/+|\/+$/g, '');
  if (!slug) return { kind: 'view', key: 'personal' };
  if (APP_ROUTE_TO_VIEW[slug]) return { kind: 'view', key: APP_ROUTE_TO_VIEW[slug] };
  if (APP_ROUTE_TO_MODAL[slug]) return { kind: 'modal', key: APP_ROUTE_TO_MODAL[slug] };
  if (APP_ROUTE_TO_OVERLAY[slug]) return { kind: 'overlay', key: APP_ROUTE_TO_OVERLAY[slug] };
  return { kind: 'view', key: 'personal' };
}

function setAppRoute(kind, key, options = {}) {
  if (!appRoutingReady || appRouteSyncing) return;
  const path = getAppRoutePath(kind, key);
  const state = { lootlingua: true, kind, key, source: options.source || (options.replace ? 'replace' : 'push') };
  try {
    if (location.pathname === path) {
      history.replaceState({ ...state, source: history.state?.source || state.source }, '', path);
      return;
    }
    history[options.replace ? 'replaceState' : 'pushState'](state, '', path);
  } catch (err) {
    console.warn('route:', err.message);
  }
}

function setAppViewRoute(viewKey, options = {}) {
  setAppRoute('view', viewKey, options);
}

function closeRouteOverlays() {
  document.querySelectorAll('.custom-modal').forEach(modal => {
    modal.style.display = 'none';
  });
  const profile = document.getElementById('profileModal');
  if (profile) {
    profile.classList.remove('open');
    profile.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('profile-modal-open');
    unlockBackgroundScroll('profile');
  }
  const stats = document.getElementById('statsPanel');
  if (stats) {
    stats.classList.remove('show');
    stats.style.display = 'none';
    unlockBackgroundScroll('stats');
  }
  const wordHunterModal = document.getElementById('wordHunterModal');
  if (wordHunterModal?.classList.contains('open')) {
    if (typeof window.closeWordHunterModal === 'function') {
      window.closeWordHunterModal();
    } else {
      wordHunterModal.classList.remove('open');
      wordHunterModal.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('word-hunter-open');
      unlockBackgroundScroll('wordHunter');
    }
  }
  if (typeof closeDailyQuestsSheet === 'function') closeDailyQuestsSheet(true);
  if (typeof closeNotificationsPanel === 'function') closeNotificationsPanel(true);
}

function openRouteOverlay(kind, key) {
  if (kind === 'modal') {
    const modal = document.getElementById(key);
    if (modal) modal.style.display = 'flex';
    return;
  }
  if (key === 'profile') {
    const modal = document.getElementById('profileModal');
    if (modal && !modal.classList.contains('open')) toggleProfileModal();
  } else if (key === 'stats') {
    openStatsPanel();
  } else if (key === 'quests') {
    const sheet = document.getElementById('dailyQuestsSheet');
    if (sheet && !sheet.classList.contains('open')) toggleDailyQuestsSheet();
  } else if (key === 'notifications') {
    const panel = document.getElementById('notificationsPanel');
    if (panel && !panel.classList.contains('open')) toggleNotificationsPanel();
  }
}

function openRouteView(viewKey) {
  if (viewKey === 'treasure') loadTreasureView();
  else if (viewKey === 'worlds') loadWorldsView();
  else if (viewKey === 'minecraft') loadGameDictionary('minecraft');
  else if (viewKey === 'pubg') loadGameDictionary('pubg');
  else if (viewKey === 'starred') loadStarredView();
  else if (viewKey === 'quiz') loadQuizView();
  else loadPersonalDictionary();
}

function applyAppRoute(route = parseAppRoute()) {
  appRouteSyncing = true;
  closeRouteOverlays();
  if (route.kind === 'view') {
    openRouteView(route.key);
  } else {
    openRouteView(currentView || 'personal');
    openRouteOverlay(route.kind, route.key);
  }
  appRouteSyncing = false;
}

function handleInitialRouting() {
  if (appRoutingReady) return;
  const route = parseAppRoute();
  appRoutingReady = true;
  try {
    const path = getAppRoutePath(route.kind, route.key);
    const state = { lootlingua: true, ...route, source: 'initial' };
    if (location.pathname === path) {
      history.replaceState(state, '', location.href);
    } else {
      history.replaceState(state, '', path);
    }
  } catch (err) {
    console.warn('route:', err.message);
  }
  applyAppRoute(route);
}

window.addEventListener('popstate', () => {
  if (!appRoutingReady) return;
  applyAppRoute(parseAppRoute());
});

function closeRouteEntry(kind, key, fallbackClose) {
  if (!appRouteSyncing && history.state?.lootlingua && history.state.kind === kind && history.state.key === key) {
    if (history.state.source === 'push') {
      history.back();
      return;
    }
    fallbackClose();
    setAppViewRoute(currentView || 'personal', { replace: true, source: 'close' });
    return;
  }
  fallbackClose();
}

function showModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.style.display = 'flex';
  if (APP_MODAL_ROUTES[id]) setAppRoute('modal', id);
}

function hideModal(id) {
  const close = () => {
    const modal = document.getElementById(id);
    if (modal) modal.style.display = 'none';
  };
  if (APP_MODAL_ROUTES[id]) closeRouteEntry('modal', id, close);
  else close();
}

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

  hideAllEmptyOnboardingTooltips();
  emptyOnboardingState.active = false;
  emptyOnboardingState.phase = 0;

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
function saveInt(k,v)  {
  localStorage.setItem(k,String(v));
  markGuestProfileDataDirty(k);
}
function loadJSON(k,d) { try{const r=JSON.parse(localStorage.getItem(k));return r??d;}catch{return d;} }
function saveJSON(k,v) {
  localStorage.setItem(k,JSON.stringify(v));
  markGuestProfileDataDirty(k);
}
function todayStr()    { return new Date().toISOString().slice(0,10); }

// بيانات الملف الشخصي للسحابة (وحدات ES تتصل بهذا بدل `let` من السكربت العادي)
window.getLootlinguaProfilePayload = function() {
  const dailyQuestDate = todayStr();
  return {
    userXP,
    dailyStreak,
    maxStreak:        loadInt('lootlinguaMaxStreak', dailyStreak),
    lastActivityDate: lastActivity,
    activityMap:      loadJSON('activityMap', {}),
    theme:            localStorage.getItem('theme') || document.documentElement.getAttribute('data-theme') || 'lootlingua',
    displayName:      localStorage.getItem('lootlinguaDisplayName') || '',
    addedGameWords:   loadJSON('addedGameWords', []),
    dailyLootState:   typeof getLootState === 'function' ? getLootState() : loadJSON('lootlinguaDailyLootState', {}),
    titlesState:      typeof getTitleState === 'function' ? getTitleState() : loadJSON('lootlinguaTitlesState', {}),
    activeTitleId:    localStorage.getItem('lootlinguaActiveTitleId') || '',
    dailyQuestDate,
    dailyQuestState:  loadJSON(getDailyQuestStorageKey(dailyQuestDate), { claimed: {}, flags: {} }),
    streakFreezes:    loadInt('lootlinguaStreakFreezes', 0),
    freezeSaves:      loadInt('lootlinguaFreezeSaves', 0),
    gameDictAdds:     loadInt('lootlinguaGameDictAdds', 0),
    perfectQuizzes:   loadInt('lootlinguaPerfectQuizzes', 0),
    extraChests:      loadJSON('lootlinguaExtraChests', []),
  };
};

function clearDailyQuestStorage() {
  Object.keys(localStorage).forEach((key) => {
    if (key.startsWith('lootlinguaDailyQuests_')) localStorage.removeItem(key);
  });
}

window.resetLootlinguaProfileState = function(options = {}) {
  const { clearDisplayName = true, resetTheme = true } = options;
  userXP = 0;
  dailyStreak = 0;
  lastActivity = '';
  [
    'userXP',
    'dailyStreak',
    'lootlinguaMaxStreak',
    'lastActivityDate',
    'activityMap',
    'addedGameWords',
    'lootlinguaDailyLootState',
    'lootlinguaTitlesState',
    'lootlinguaActiveTitleId',
    'lootlinguaStreakFreezes',
    'lootlinguaFreezeSaves',
    'lootlinguaGameDictAdds',
    'lootlinguaPerfectQuizzes',
    'lootlinguaExtraChests',
  ].forEach((key) => localStorage.removeItem(key));
  clearDailyQuestStorage();
  Object.keys(localStorage).forEach((key) => {
    if (key.startsWith('lootlingua:used:theme:') || key.startsWith('lootlingua:unlocked:theme:')) {
      localStorage.removeItem(key);
    }
  });
  if (clearDisplayName) localStorage.removeItem('lootlinguaDisplayName');
  if (resetTheme) {
    localStorage.setItem('theme', 'lootlingua');
    if (typeof setTheme === 'function') setTheme('lootlingua', true);
    else document.documentElement.setAttribute('data-theme', 'lootlingua');
  }
  if (typeof renderStreak === 'function') renderStreak();
  if (typeof renderDailyGoal === 'function') renderDailyGoal();
  if (typeof renderXPBar === 'function') renderXPBar();
  if (typeof syncHeroAvatar === 'function') syncHeroAvatar();
  if (typeof renderProfileModalStats === 'function') renderProfileModalStats();
  if (typeof updateDailyQuestsBadge === 'function') updateDailyQuestsBadge();
  if (typeof refreshFeatureUnlockUI === 'function') refreshFeatureUnlockUI();
  if (typeof renderTreasureRoom === 'function' && currentView === 'treasure') renderTreasureRoom();
};

window.mergeLootlinguaProfileFromCloud = function(d) {
  // Track if we loaded from cloud to avoid double checkAndUpdateStreak
  window._profileLoaded = true;
  if (!d) return;
  const wasApplyingCloudProfile = window.__applyingCloudProfile === true;
  window.__applyingCloudProfile = true;
  try {
  if (d.userXP !== undefined && d.userXP !== null) {
    const cloud = Number(d.userXP) || 0;
    userXP = Math.max(cloud, userXP);
    saveInt('userXP', userXP);
  }
  if (d.dailyStreak !== undefined) {
    dailyStreak = Math.max(Number(d.dailyStreak) || 0, dailyStreak);
    saveInt('dailyStreak', dailyStreak);
  }
  if (d.maxStreak !== undefined) {
    saveInt('lootlinguaMaxStreak', Math.max(loadInt('lootlinguaMaxStreak', 0), Number(d.maxStreak) || 0));
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
      ...localLoot,
      ...cloudLoot,
      lastOpenAt: Math.max(Number(cloudLoot.lastOpenAt) || 0, Number(localLoot.lastOpenAt) || 0),
      totalOpens: Math.max(Number(cloudLoot.totalOpens) || 0, Number(localLoot.totalOpens) || 0),
      streak: Math.max(Number(cloudLoot.streak) || 0, Number(localLoot.streak) || 0),
      freezesEarned: Math.max(Number(cloudLoot.freezesEarned) || 0, Number(localLoot.freezesEarned) || 0),
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
  if (d.dailyQuestDate === todayStr() && d.dailyQuestState && typeof d.dailyQuestState === 'object') {
    const localQuest = loadJSON(getDailyQuestStorageKey(), { claimed: {}, flags: {} });
    saveJSON(getDailyQuestStorageKey(), {
      claimed: { ...(d.dailyQuestState.claimed || {}), ...(localQuest.claimed || {}) },
      flags: { ...(d.dailyQuestState.flags || {}), ...(localQuest.flags || {}) },
    });
  }
  if (d.displayName) localStorage.setItem('lootlinguaDisplayName', d.displayName);
  if (d.activeTitleId) localStorage.setItem('lootlinguaActiveTitleId', String(d.activeTitleId));
  if (d.theme) {
    const nextTheme = isThemeComingSoon(d.theme) || !isThemeUnlocked(d.theme) ? 'lootlingua' : d.theme;
    if (typeof setTheme === 'function') setTheme(nextTheme, true);
  } else if (typeof refreshThemeLockUI === 'function') {
    refreshThemeLockUI();
  }
  if (typeof evaluateTitleUnlocks === 'function') evaluateTitleUnlocks(false);
  renderStreak();
  renderDailyGoal();
  renderXPBar();
  syncHeroAvatar();
  updateDailyQuestsBadge();
  refreshFeatureUnlockUI();
  if (typeof renderStatsNumbers === 'function' &&
      document.getElementById('statsPanel')?.style.display !== 'none') {
    renderStatsNumbers();
    renderHeatmap();
  }
  } finally {
    window.__applyingCloudProfile = wasApplyingCloudProfile;
  }
};

function normalizeMigrationWordKey(word) {
  return String(word?.word || word?.text || '').toLowerCase().trim();
}

function getGuestMigrationWords() {
  const normal = readWordsFromStorage('normal', 'guest');
  const gamer = readWordsFromStorage('gamer', 'guest');
  const seen = new Set();
  return [...normal, ...gamer].filter((word) => {
    const key = normalizeMigrationWordKey(word);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getGuestProgressSnapshot() {
  return window.getLootlinguaProfilePayload ? window.getLootlinguaProfilePayload() : {};
}

function getGuestProgressSummary(profile) {
  const titles = Array.isArray(profile?.titlesState?.unlocked) ? profile.titlesState.unlocked.length : 0;
  const chests = Number(profile?.dailyLootState?.totalOpens) || 0;
  const stats = [];
  if ((Number(profile?.userXP) || 0) > 0) stats.push({ label: `${profile.userXP} XP`, hint: 'خبرة مخزنة' });
  if ((Number(profile?.dailyStreak) || 0) > 0) stats.push({ label: `${profile.dailyStreak} يوم`, hint: 'سلسلة يومية' });
  if (titles > 0) stats.push({ label: `${titles} ألقاب`, hint: 'إنجازات مفتوحة' });
  if (chests > 0) stats.push({ label: `${chests} صناديق`, hint: 'لوت يومي' });
  if ((Number(profile?.streakFreezes) || 0) > 0) stats.push({ label: `${profile.streakFreezes} تجميد`, hint: 'حماية الستريك' });
  return stats;
}

function hasGuestProgress(profile) {
  return getGuestProgressSummary(profile).length > 0 ||
    (Array.isArray(profile?.addedGameWords) && profile.addedGameWords.length > 0) ||
    (Array.isArray(profile?.extraChests) && profile.extraChests.length > 0);
}

function clearGuestWordsStorage() {
  localStorage.removeItem(getWordsStorageKey('normal', 'guest'));
  localStorage.removeItem(getWordsStorageKey('gamer', 'guest'));
  localStorage.removeItem(LEGACY_DICTIONARY_KEY);
}

function resetGuestProgressState() {
  if (typeof window.resetLootlinguaProfileState === 'function') {
    window.resetLootlinguaProfileState({ clearDisplayName: false, resetTheme: true });
  }
}

function renderGuestMigrationModal(summary) {
  const wordCount = summary.words.length;
  const progressStats = getGuestProgressSummary(summary.profile);
  const msg = document.getElementById('guestMigrationMessage');
  const stats = document.getElementById('guestMigrationStats');
  const confirm = document.getElementById('guestMigrationConfirm');
  const decline = document.getElementById('guestMigrationDeclineBtn');
  const accept = document.getElementById('guestMigrationAcceptBtn');
  if (msg) {
    const progressText = progressStats.length ? ' ولقينا كمان XP وتقدم وألقاب مخزنة' : '';
    msg.textContent = `يا بطل! لقينا ${wordCount} كلمات مخبأة في جهازك${progressText}.. بدك تنقلهم لحسابك الأسطوري الجديد عشان ما يضيعوا؟`;
  }
  if (stats) {
    const allStats = [{ label: `${wordCount} كلمات`, hint: 'قاموس الضيف' }, ...progressStats];
    stats.innerHTML = allStats.map((item) => `<div class="guest-migration-stat">${item.label}<small>${item.hint}</small></div>`).join('');
  }
  if (confirm) confirm.style.display = 'none';
  if (decline) {
    decline.dataset.confirmed = '0';
    decline.textContent = 'لا، ابدأ من جديد';
    decline.disabled = false;
  }
  if (accept) {
    accept.disabled = false;
    accept.textContent = 'نعم، انقل اللوت!';
  }
  showModal('guestMigrationModal');
}

window.prepareGuestMigrationForUser = function(user) {
  if (!user) return Promise.resolve('guest');
  if (window.__guestMigrationPromise && window.__guestMigrationUid === user.uid) {
    return window.__guestMigrationPromise;
  }

  window.__guestMigrationUid = user.uid;

  if (shouldSkipGuestMigrationPrompt(user)) {
    window.__guestMigrationPromise = Promise.resolve('none');
    return window.__guestMigrationPromise;
  }

  const loot = getGuestLootSnapshot();
  const words = loot.words;
  const profile = loot.profile;
  const hasGuestData = hasMeaningfulGuestLoot(loot);
  const shouldPrompt = hasGuestData && (hasDirtyGuestData() || !hasHandledGuestMigrationForUser(user.uid));
  window.__guestMigrationSummary = { words, profile, user };

  if (!shouldPrompt) {
    if (hasMeaningfulGuestLoot(loot)) {
      window.__acceptedGuestProfileMigration = { uid: user.uid, profile };
    }
    if (hasGuestData) purgeStaleGuestLocalData();
    window.__guestMigrationPromise = Promise.resolve('none');
    return window.__guestMigrationPromise;
  }

  window.__guestMigrationPromise = new Promise((resolve) => {
    window.__resolveGuestMigration = resolve;
  });
  renderGuestMigrationModal(window.__guestMigrationSummary);
  return window.__guestMigrationPromise;
};

window.confirmGuestMigration = async function() {
  const summary = window.__guestMigrationSummary;
  const user = summary?.user || window.auth?.currentUser;
  if (!summary || !user) return;

  markGuestMigrationCompleteFlag(user, 'accepted');

  const accept = document.getElementById('guestMigrationAcceptBtn');
  const decline = document.getElementById('guestMigrationDeclineBtn');
  if (accept) {
    accept.disabled = true;
    accept.textContent = 'جاري نقل اللوت...';
  }
  if (decline) decline.disabled = true;

  try {
    const existing = new Set((window.words || []).map((word) => normalizeMigrationWordKey(word)).filter(Boolean));
    const toMove = summary.words.filter((word) => {
      const key = normalizeMigrationWordKey(word);
      if (!key || existing.has(key)) return false;
      existing.add(key);
      return true;
    });

    let uploaded = 0;
    for (const word of toMove) {
      const realId = window.saveWordToCloud
        ? await window.saveWordToCloud(word.word || word.text, word.category || 'عام', word.meaning || '', word.example || '')
        : null;
      if (!realId) throw new Error('cloud-upload-failed');
      window.words.unshift({
        ...word,
        id: realId,
        word: word.word || word.text || '',
        category: word.category || 'عام',
        userId: user.uid,
      });
      uploaded++;
    }

    writeWordsToStorage(window.words, 'normal', user.uid);
    purgeStaleGuestLocalData();
    window.__acceptedGuestProfileMigration = { uid: user.uid, profile: summary.profile };
    saveAndRender();
    hideModal('guestMigrationModal');
    showToast(uploaded > 0 ? `تم نقل ${uploaded} كلمات لحسابك` : 'ما في كلمات جديدة للنقل، وتم حفظ تقدمك', 'success', 4200);
    window.__resolveGuestMigration?.('accepted');
  } catch (err) {
    console.error('guestMigration:', err);
    if (accept) {
      accept.disabled = false;
      accept.textContent = 'نعم، انقل اللوت!';
    }
    if (decline) decline.disabled = false;
    showToast('ما قدرنا ننقل اللوت الآن. خليناه محفوظ على الجهاز.', 'danger', 4600);
  }
};

window.declineGuestMigration = function() {
  const decline = document.getElementById('guestMigrationDeclineBtn');
  const confirm = document.getElementById('guestMigrationConfirm');
  if (decline?.dataset.confirmed !== '1') {
    if (decline) {
      decline.dataset.confirmed = '1';
      decline.textContent = 'متأكد، احذف لوت الضيف';
    }
    if (confirm) confirm.style.display = 'block';
    showToast('اضغط تأكيد مرة ثانية إذا بدك تبدأ من جديد بدون نقل.', 'warning', 4200);
    return;
  }
  const user = window.auth?.currentUser;
  markGuestMigrationCompleteFlag(user, 'declined');
  purgeStaleGuestLocalData();
  resetGuestProgressState();
  hideModal('guestMigrationModal');
  showToast('تم تجاهل بيانات الضيف وبدينا صفحة جديدة.', 'info', 3600);
  window.__resolveGuestMigration?.('declined');
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
  {min:150, max:249,      label:'Pro',      iconClass:'fa-solid fa-award', color:'var(--success)'},
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
  const suppressUnlockNotice = shouldSuppressUnlockNotices();
  let activeThemeLocked = false;
  const activeTheme = localStorage.getItem('theme') || document.documentElement.getAttribute('data-theme') || 'lootlingua';

  document.querySelectorAll('.theme-option').forEach(opt => {
    const theme = opt.dataset.theme;
    const comingSoon = isThemeComingSoon(theme);
    const unlocked = isThemeUnlocked(theme);
    opt.classList.toggle('theme-coming-soon', comingSoon);
    opt.classList.toggle('theme-locked', !unlocked && !comingSoon);
    opt.classList.toggle('theme-locked-level', !unlocked && !comingSoon);
    opt.setAttribute('aria-disabled', unlocked && !comingSoon ? 'false' : 'true');
    updateThemeOptionLabels(opt, theme, comingSoon, unlocked);
    if (comingSoon) opt.classList.remove('active');
    else if (unlocked) opt.removeAttribute('title');
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
    if (!suppressUnlockNotice) {
      const noticeKey = `lootlingua:themeRelockNotice:${activeTheme}`;
      if (!sessionStorage.getItem(noticeKey)) {
        sessionStorage.setItem(noticeKey, '1');
        setTimeout(() => showToast('الثيم هذا رجع للخزنة مؤقتًا. ارجع ارفع مستواك وبتفتحه من جديد.', 'warning', 5600), 600);
      }
    }
  }
}

function updateXP(amount) {
  if (!amount) return;
  const prevXP = userXP;
  const oldRank = getRank(prevXP);
  userXP = Math.max(0, userXP + amount);
  saveInt('userXP', userXP);
  if (!hasSignedInUser()) markGuestDataDirty();
  if (window.saveProfileToCloud) window.saveProfileToCloud();
  checkThemeRelocksAfterXP(prevXP, userXP);
  checkThemeUnlocksAfterXP(prevXP, userXP);
  renderXPBar();
  if (isJsonImportBatchActive()) return;
  if (amount > 0 && getRank(userXP).label !== oldRank.label)
    setTimeout(()=>showRankUp(getRank(userXP)), 400);
  if (typeof evaluateTitleUnlocks === 'function') evaluateTitleUnlocks(false);
  refreshFeatureUnlockUI();
}

function renderXpRanksGuide() {
  const list = document.getElementById('xpRanksGuideList');
  const summary = document.getElementById('xpRanksGuideSummary');
  if (!list) return;
  const current = getRank(userXP);
  if (summary) summary.textContent = current.label;
  list.innerHTML = XP_RANKS.map((rank, index) => {
    const level = index + 1;
    const reached = userXP >= rank.min;
    const isCurrent = rank.label === current.label;
    const reqLabel = rank.min === 0 ? '0 XP' : `${rank.min} XP`;
    return `<li class="xp-rank-row${reached ? ' reached' : ''}${isCurrent ? ' current' : ''}">
      <span class="xp-rank-level">Level ${level}</span>
      <span class="xp-rank-name"><i class="${rank.iconClass}" aria-hidden="true"></i> ${rank.label}</span>
      <span class="xp-rank-req">${reqLabel}</span>
    </li>`;
  }).join('');
}

window.toggleXpRanksGuide = function(event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  const panel = document.getElementById('xpRanksGuidePanel');
  const btn = document.getElementById('xpRanksGuideToggle');
  const wrap = document.querySelector('.xp-ranks-setting');
  if (!panel || !btn) return;
  const open = panel.hidden;
  panel.hidden = !open;
  btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  wrap?.classList.toggle('open', open);
};

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
  renderXpRanksGuide();
  syncHeroAvatar();
}

function showXPBadge(amount, anchorId, isNeg) {
  if (isJsonImportBatchActive()) return;
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
    if (!isJsonImportBatchActive()) setTimeout(()=>showToast('Streak '+dailyStreak+' يوم!'), 1000);
  } else if (lastActivity !== '') {
    const freezes = typeof getStreakFreezeCount === 'function' ? getStreakFreezeCount() : loadInt('lootlinguaStreakFreezes', 0);
    if (freezes > 0) {
      if (typeof saveStreakFreezeCount === 'function') saveStreakFreezeCount(freezes - 1);
      else saveInt('lootlinguaStreakFreezes', freezes - 1);
      saveInt('lootlinguaFreezeSaves', loadInt('lootlinguaFreezeSaves', 0) + 1);
      dailyStreak = Math.max(1, dailyStreak);
      if (!isJsonImportBatchActive()) {
        setTimeout(() => showToast('Streak Freeze اشتغل وأنقذ السلسلة. رجعت قبل ما تنكسر!', 'success', 5600), 900);
      }
      if (typeof evaluateTitleUnlocks === 'function') evaluateTitleUnlocks(!isJsonImportBatchActive());
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
  incrementDailyCountBy(1);
}

function incrementDailyCountBy(amount = 1) {
  const n = Math.max(0, Number(amount) || 0);
  if (!n) return;
  const today = todayStr();
  const map   = loadJSON('activityMap', {});
  const before = map[today] || 0;
  map[today]  = before + n;
  saveJSON('activityMap', map);
  if (!hasSignedInUser()) markGuestDataDirty();
  if (window.saveProfileToCloud) window.saveProfileToCloud();
  if (typeof updateDailyQuestsBadge === 'function') updateDailyQuestsBadge();
  renderDailyGoal();
  const after = map[today];
  if (!isJsonImportBatchActive() && before < DAILY_GOAL && after >= DAILY_GOAL) {
    setTimeout(launchConfetti, 400);
  }
}

function decrementDailyCount() {
  const today = todayStr();
  const map   = loadJSON('activityMap', {});
  if (map[today] && map[today] > 0) {
    map[today]--;
    saveJSON('activityMap', map);
    if (!hasSignedInUser()) markGuestDataDirty();
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
  return getPersonalDictionaryWordsSnapshot().some(w=>normalizeWord(w.word)===k);
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
  lockBackgroundScroll('stats');
  p.style.display='flex'; setTimeout(()=>p.classList.add('show'),10);
  renderHeatmap(); renderStatsNumbers();
  setAppRoute('overlay', 'stats');
}
function closeStatsPanel() {
  closeRouteEntry('overlay', 'stats', () => {
    const p=document.getElementById('statsPanel'); if(!p)return;
    p.classList.remove('show');
    unlockBackgroundScroll('stats');
    setTimeout(()=>p.style.display='none',300);
  });
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
  if (dictionarySortMode === 'auto' && Array.isArray(window.words)) {
    reindexWordOrder(window.words);
  }
  writeWordsToStorage(window.words, 'normal');
  if (typeof evaluateTitleUnlocks === 'function') evaluateTitleUnlocks(false);
  refreshFeatureUnlockUI();
}

function saveAndRender() {
  persistDictionary();
  renderLimit = 20; // العودة للحد الأول عند الحفظ
  render();
  if (isJsonImportBatchActive()) return;
  if (typeof tryStartEmptyOnboarding === 'function') tryStartEmptyOnboarding();
  if (typeof notifyDictionaryWordAdded === 'function') notifyDictionaryWordAdded();
}
window.saveAndRender = saveAndRender;

function wordsSnapshotNeedsFullRender(prev, next) {
  if (!Array.isArray(prev) || !Array.isArray(next)) return true;
  if (prev.length !== next.length) return true;
  for (let i = 0; i < prev.length; i++) {
    const a = prev[i];
    const b = next[i];
    if (String(a?.id) !== String(b?.id)) return true;
    if ((a?.word || '') !== (b?.word || '')) return true;
    if ((a?.meaning || '') !== (b?.meaning || '')) return true;
    if ((a?.example || '') !== (b?.example || '')) return true;
    if ((a?.category || '') !== (b?.category || '')) return true;
    if ((a?.order ?? null) !== (b?.order ?? null)) return true;
    if ((a?.createdAt || '') !== (b?.createdAt || '')) return true;
  }
  return false;
}

function syncWordMetaInDom() {
  if (!Array.isArray(window.words)) return;
  window.words.forEach((word) => {
    const safeId = cssEscapeValue(String(word.id));
    const starBtn = document.querySelector(`[data-action="star"][data-id="${safeId}"]`);
    if (starBtn) starBtn.classList.toggle('active', !!word.starred);
  });
}

window.applyCloudWordsFromSnapshot = function(cloudWords) {
  loadDictionarySortPrefs();
  const prev = Array.isArray(window.words) ? window.words : [];
  const uid = window.auth?.currentUser?.uid;
  let normalized = applyStoredWordOrder(cloudWords);
  if (dictionarySortMode !== 'auto') {
    normalized = sortDictionaryWords(normalized);
  }
  window.words = normalized;
  if (typeof window.writeWordsToStorage === 'function') {
    window.writeWordsToStorage(normalized, 'normal', uid);
  }
  const needsFullRender =
    wordsSnapshotNeedsFullRender(prev, normalized) ||
    currentView !== 'personal' ||
    isReorderMode ||
    isBulkDeleteMode;
  if (needsFullRender) {
    saveAndRender();
    return;
  }
  persistDictionary();
  syncWordMetaInDom();
};

function clearInputs() {
  ['wordInput','meaningInput','exampleInput'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const cat = document.getElementById('categoryInput');
  if (cat) cat.value = 'عام';
  setCategoryDropdownValue('عام');
  const list = document.getElementById('suggestionsList');
  if (list) list.innerHTML = '';
  const box = document.getElementById('suggestionsBox');
  if (box) box.style.display = 'none';
}

let isExpanded = false;
window.isExpanded = isExpanded;

function syncAddFormExpanded() {
  const form = document.getElementById('personalControls');
  const advanced = document.getElementById('addFormAdvancedFields');
  const toggle = document.getElementById('addFormToggle');
  const searchBtn = document.getElementById('searchBtn');

  if (form) form.classList.toggle('is-expanded', isExpanded);
  if (advanced) {
    advanced.setAttribute('aria-hidden', String(!isExpanded));
    advanced.inert = !isExpanded;
  }
  if (toggle) {
    toggle.setAttribute('aria-expanded', String(isExpanded));
    const icon = toggle.querySelector('i[aria-hidden="true"]');
    const label = toggle.querySelector('.sr-only');
    if (icon) {
      icon.classList.toggle('fa-chevron-down', !isExpanded);
      icon.classList.toggle('fa-chevron-up', isExpanded);
    }
    if (label) label.textContent = isExpanded ? 'إخفاء الحقول الإضافية' : 'إظهار الحقول الإضافية';
  }
  if (searchBtn && !searchBtn.disabled) {
    searchBtn.textContent = 'ابحث عن معنى';
  }
}

function setAddFormExpanded(expanded) {
  isExpanded = Boolean(expanded);
  window.isExpanded = isExpanded;
  syncAddFormExpanded();
}

window.setAddFormExpanded = setAddFormExpanded;
window.toggleAddFormExpanded = function() {
  setAddFormExpanded(!isExpanded);
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setAddFormExpanded(false);
    initWordHunterUI();
  });
} else {
  setAddFormExpanded(false);
  initWordHunterUI();
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
    const newWord = { id:Date.now().toString(), word:w, meaning:m, example:ex, category:c, starred:false, forgetCount:0, xpValue:xpGain, order:0 };
    window.words.unshift(newWord);
    reindexWordOrder(window.words);
    if (window.saveWordToCloud) {
      const realId = await window.saveWordToCloud(w, c, m, ex, newWord.order ?? 0);
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
  setAddFormExpanded(false);
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
  setCategoryDropdownValue(item.category || 'عام');
  setAddFormExpanded(true);
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
      persistDictionary();
      if (typeof reconcileEmptyGuestSessionState === 'function') reconcileEmptyGuestSessionState();
      if (currentView === 'starred') renderStarredWords();
      else render();
    }, 300);
  };
  const cBtn = document.getElementById('deleteCancelBtn');
  if (cBtn) cBtn.onclick = () => { hideModal('deleteModal'); document.querySelector('#deleteModal .xp-delete-warn')?.remove(); };
  showModal('deleteModal');
};

// ═══════════════════════════════════════════════════════
function resetDeleteModalCopy() {
  const modal = document.querySelector('#deleteModal .modal-content');
  const title = modal?.querySelector('h2');
  const text = modal?.querySelector('p');
  if (title) title.textContent = 'حذف الكلمة؟';
  if (text) text.textContent = 'هذا الإجراء لا يمكن التراجع عنه';
}

function getDeleteXpLoss(wordsToDelete) {
  return wordsToDelete.reduce((sum, word) => sum + (Number(word?.xpValue) || 3), 0);
}

function configureDeleteModal(wordsToDelete) {
  const modal = document.querySelector('#deleteModal .modal-content');
  const title = modal?.querySelector('h2');
  const text = modal?.querySelector('p');
  if (wordsToDelete.length > 1) {
    if (title) title.textContent = `هل أنت متأكد من حذف ${wordsToDelete.length} من الكلمات؟`;
    if (text) text.textContent = 'هذا الإجراء لا يمكن التراجع عنه';
  } else {
    resetDeleteModalCopy();
  }

  const modalBody = document.querySelector('#deleteModal .modal-content');
  let warnEl = modalBody?.querySelector('.xp-delete-warn');
  const xpLoss = getDeleteXpLoss(wordsToDelete);
  if (xpLoss > 0 && modalBody) {
    if (!warnEl) {
      warnEl = document.createElement('div');
      warnEl.className = 'xp-delete-warn';
      modalBody.querySelector('p')?.after(warnEl);
    }
    warnEl.textContent = `⚠ ستخسر ${xpLoss} XP عند الحذف`;
  } else if (warnEl) warnEl.remove();
  return xpLoss;
}

function confirmDeleteWords(ids, { fromBulk = false } = {}) {
  const uniqueIds = [...new Set((Array.isArray(ids) ? ids : [ids]).map(String).filter(Boolean))];
  const wordsToDelete = uniqueIds
    .map(id => window.words.find(w => String(w.id) === id))
    .filter(Boolean);
  if (!wordsToDelete.length) return;

  pendingDeleteId = uniqueIds[0];
  const xpLoss = configureDeleteModal(wordsToDelete);

  document.getElementById('deleteConfirmBtn').onclick = async function() {
    hideModal('deleteModal');
    uniqueIds.forEach((id) => {
      const li = document.querySelector(`[data-id="${cssEscapeValue(id)}"]`)?.closest('.word-card');
      if (li) {
        li.style.transition = 'all 0.28s cubic-bezier(0.4, 0, 0.2, 1)';
        li.style.transform = 'scale(0.96) translateY(8px)';
        li.style.opacity = '0';
      }
    });

    setTimeout(async () => {
      if (xpLoss > 0) { updateXP(-xpLoss); showXPBadge(xpLoss, null, true); }
      wordsToDelete.forEach(() => decrementDailyCount());
      const deleteSet = new Set(uniqueIds);
      window.words = window.words.filter(w => !deleteSet.has(String(w.id)));
      if (window.deleteWordFromCloud) await Promise.all(uniqueIds.map(id => window.deleteWordFromCloud(id)));
      pendingDeleteId = null;
      document.querySelector('#deleteModal .xp-delete-warn')?.remove();
      resetDeleteModalCopy();
      if (fromBulk || isBulkDeleteMode) window.exitBulkDeleteMode();
      persistDictionary();
      if (typeof reconcileEmptyGuestSessionState === 'function') reconcileEmptyGuestSessionState();
      if (currentView === 'starred') renderStarredWords();
      else render();
    }, 300);
  };

  const cBtn = document.getElementById('deleteCancelBtn');
  if (cBtn) cBtn.onclick = () => {
    hideModal('deleteModal');
    document.querySelector('#deleteModal .xp-delete-warn')?.remove();
    resetDeleteModalCopy();
  };
  showModal('deleteModal');
}

window.confirmBulkDeleteSelection = function() {
  if (!bulkSelectedWordIds.size) return;
  confirmDeleteWords([...bulkSelectedWordIds], { fromBulk: true });
};

window.deleteWord = function(id, event) {
  if (event) event.stopPropagation();
  confirmDeleteWords([id]);
};

// Star Toggle
// ═══════════════════════════════════════════════════════
window.toggleStar = function(id, event) {
  if (event) event.stopPropagation();
  const word = window.words.find(w => w.id === id);
  if (!word) return;

  word.starred = !word.starred;

  // تحديث البيانات في الخلفية بصمت
  persistDictionary();
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
  const searchType = zoneEl.dataset.searchType || '';
  zoneEl.classList.toggle('search-locked', locked);
  zoneEl.querySelectorAll('input, button, textarea, select').forEach((el) => {
    if (el.classList.contains('search-lock-overlay')) return;
    if (searchType === 'normal' && el.matches('input, textarea, select')) {
      el.disabled = false;
      el.removeAttribute('aria-disabled');
      return;
    }
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
  pushNotification('عذراً يا بطل! ميزة البحث مخصصة للأساطير المسجلين فقط. سجل الآن مجاناً!', 'warning');
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
  const btn = ev?.target?.closest?.('[data-action="submit-suggestion"]') || ev?.currentTarget;
  if (btn?.classList) { btn.disabled = true; btn.classList.add('loading'); }
  const result = await window.submitWordSuggestion({ word, ar, game });
  if (btn?.classList) { btn.disabled = false; btn.classList.remove('loading'); }
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
    if (added && typeof notifyDictionaryWordAdded === 'function') notifyDictionaryWordAdded();
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
    showActions = false,
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
        ${showActions ? `<div class="sug-actions">
          <button type="button" class="sug-gamer-action-btn sug-add-personal-btn" data-action="add-ai-meaning"
            data-word="${wordEnc}" data-ar="${sugAttr(fields.ar)}" data-pos="${sugAttr(fields.pos)}" data-ex="${sugAttr(fields.ex)}" data-game="${itemGameEnc}">
            <i class="fa-solid fa-book" aria-hidden="true"></i>
            <span>إضافة لقاموسك الشخصي</span>
          </button>
          <button type="button" class="sug-gamer-action-btn sug-suggest-btn" data-action="submit-suggestion"
            title="اقترح إضافة هذه الكلمة للموقع"
            aria-label="اقترح إضافة للموقع"
            data-word="${wordEnc}" data-ar="${sugAttr(fields.ar)}" data-game="${itemGameEnc}">
            <i class="fa-solid fa-lightbulb" aria-hidden="true"></i>
          </button>
        </div>` : ''}
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
      showActions: true,
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
    btn.disabled  = false;
    syncAddFormExpanded();
    if (isIntroQuestMode()) {
      updateDailyQuestsBadge();
      if (document.getElementById('dailyQuestsSheet')?.classList.contains('open')) renderDailyQuests();
    }
  }
};

function selectSuggestion(ar, pos, ex) {
  document.getElementById('meaningInput').value  = ar;
  setCategoryDropdownValue(pos || 'عام');
  document.getElementById('exampleInput').value  = ex;
  setAddFormExpanded(true);
  const box = document.getElementById('suggestionsBox');
  if (box) box.style.display = 'none';
  clearGamerSuggestionsUI();
}

const WORD_HUNTER_MIN_CONFIDENCE = 45;
let wordHunterImageFile = null;
let wordHunterNatural = { width: 1, height: 1 };
let wordHunterActiveWord = null;
let wordHunterObjectUrl = '';

function cleanOcrWord(text) {
  return String(text || '').replace(/^[^A-Za-z0-9']+|[^A-Za-z0-9']+$/g, '').trim();
}

function setWordHunterStatus(message, loading = false) {
  const status = document.getElementById('wordHunterStatus');
  if (!status) return;
  status.innerHTML = message
    ? `${loading ? '<i class="fas fa-spinner fa-spin" aria-hidden="true"></i> ' : ''}${message}`
    : '';
}

window.openWordHunterModal = function() {
  const modal = document.getElementById('wordHunterModal');
  if (!modal) return;
  lockBackgroundScroll('wordHunter');
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('word-hunter-open');
  closeAppDropdowns();
  document.getElementById('dictionarySortMenu')?.classList.remove('open');
};

window.closeWordHunterModal = function() {
  const modal = document.getElementById('wordHunterModal');
  if (!modal) return;
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('word-hunter-open');
  unlockBackgroundScroll('wordHunter');
  resetWordHunterModal();
};

function resetWordHunterModal() {
  const dropzone = document.getElementById('wordHunterDropzone');
  const stage = document.getElementById('wordHunterStage');
  const image = document.getElementById('wordHunterImage');
  const overlay = document.getElementById('wordHunterOverlay');
  const popover = document.getElementById('wordHunterPopover');
  dropzone?.classList.remove('is-hidden', 'drag-over');
  if (stage) stage.hidden = true;
  if (overlay) overlay.innerHTML = '';
  if (popover) {
    popover.hidden = true;
    popover.innerHTML = '';
  }
  if (image) image.removeAttribute('src');
  if (wordHunterObjectUrl) {
    URL.revokeObjectURL(wordHunterObjectUrl);
    wordHunterObjectUrl = '';
  }
  wordHunterImageFile = null;
  wordHunterActiveWord = null;
  wordHunterNatural = { width: 1, height: 1 };
  setWordHunterStatus('');
}

function initWordHunterUI() {
  const dropzone = document.getElementById('wordHunterDropzone');
  const fileInput = document.getElementById('wordHunterFileInput');
  if (!dropzone || !fileInput || dropzone.dataset.ready === '1') return;
  dropzone.dataset.ready = '1';

  const pickFile = () => fileInput.click();
  dropzone.addEventListener('click', pickFile);
  dropzone.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      pickFile();
    }
  });
  ['dragenter', 'dragover'].forEach(type => {
    dropzone.addEventListener(type, (event) => {
      event.preventDefault();
      dropzone.classList.add('drag-over');
    });
  });
  ['dragleave', 'drop'].forEach(type => {
    dropzone.addEventListener(type, (event) => {
      event.preventDefault();
      dropzone.classList.remove('drag-over');
    });
  });
  dropzone.addEventListener('drop', (event) => {
    const file = event.dataTransfer?.files?.[0];
    if (file) handleWordHunterFile(file);
  });
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (file) handleWordHunterFile(file);
    fileInput.value = '';
  });
}

async function handleWordHunterFile(file) {
  if (!file.type.startsWith('image/')) {
    showToast('ارفع صورة فقط يا بطل.', 'warning');
    return;
  }
  if (!window.Tesseract?.recognize) {
    showToast('مكتبة قراءة الصور لم تجهز بعد. حدّث الصفحة أو جرّب بعد لحظة.', 'warning', 4200);
    return;
  }

  wordHunterImageFile = file;
  const dropzone = document.getElementById('wordHunterDropzone');
  const image = document.getElementById('wordHunterImage');
  const stage = document.getElementById('wordHunterStage');
  const overlay = document.getElementById('wordHunterOverlay');
  const popover = document.getElementById('wordHunterPopover');
  if (!image || !stage || !overlay) return;

  overlay.innerHTML = '';
  popover?.setAttribute('hidden', '');
  stage.hidden = false;
  dropzone?.classList.add('is-hidden');
  if (wordHunterObjectUrl) URL.revokeObjectURL(wordHunterObjectUrl);
  wordHunterObjectUrl = URL.createObjectURL(file);
  image.src = wordHunterObjectUrl;
  await new Promise(resolve => {
    image.onload = () => {
      wordHunterNatural = {
        width: image.naturalWidth || 1,
        height: image.naturalHeight || 1,
      };
      resolve();
    };
  });

  setWordHunterStatus('جاري استخراج الكلمات من الصورة محلياً...', true);
  try {
    const result = await window.Tesseract.recognize(wordHunterImageFile, 'eng', {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          const pct = Math.round((m.progress || 0) * 100);
          setWordHunterStatus(`جاري قراءة الصورة... ${pct}%`, true);
        }
      },
    });
    const words = Array.isArray(result?.data?.words) ? result.data.words : [];
    renderWordHunterWords(words);
  } catch (error) {
    console.error('word hunter OCR:', error);
    setWordHunterStatus('تعذر استخراج النص من الصورة. جرّب صورة أوضح.', false);
  }
}

function getOcrBox(word) {
  const box = word?.bbox || word;
  const x0 = Number(box?.x0 ?? box?.left ?? box?.x ?? 0);
  const y0 = Number(box?.y0 ?? box?.top ?? box?.y ?? 0);
  const x1 = Number(box?.x1 ?? (x0 + Number(box?.width || 0)));
  const y1 = Number(box?.y1 ?? (y0 + Number(box?.height || 0)));
  return { x0, y0, x1, y1 };
}

function renderWordHunterWords(ocrWords) {
  const overlay = document.getElementById('wordHunterOverlay');
  if (!overlay) return;
  const seen = [];
  overlay.innerHTML = '';
  const frag = document.createDocumentFragment();
  ocrWords.forEach((item, index) => {
    const text = cleanOcrWord(item.text);
    if (!text || text.length > 40) return;
    if (Number(item.confidence ?? 100) < WORD_HUNTER_MIN_CONFIDENCE) return;
    const box = getOcrBox(item);
    const width = Math.max(0, box.x1 - box.x0);
    const height = Math.max(0, box.y1 - box.y0);
    if (width < 4 || height < 4) return;
    seen.push(text);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'word-hunter-word';
    btn.textContent = text;
    btn.style.left = `${(box.x0 / wordHunterNatural.width) * 100}%`;
    btn.style.top = `${(box.y0 / wordHunterNatural.height) * 100}%`;
    btn.style.width = `${(width / wordHunterNatural.width) * 100}%`;
    btn.style.height = `${(height / wordHunterNatural.height) * 100}%`;
    btn.dataset.word = text;
    btn.dataset.index = String(index);
    btn.addEventListener('click', (event) => handleWordHunterWordClick(event, btn));
    frag.appendChild(btn);
  });
  overlay.appendChild(frag);
  setWordHunterStatus(
    seen.length
      ? `تم تجهيز ${seen.length} كلمة. اضغط على أي كلمة لمعناها.`
      : 'لم تظهر كلمات واضحة. جرّب صورة أوضح أو قصّ الجزء الذي يحتوي النص.',
    false
  );
}

async function handleWordHunterWordClick(event, btn) {
  event.preventDefault();
  event.stopPropagation();
  const word = cleanOcrWord(btn.dataset.word);
  if (!word) return;
  if (!rateLimit('wordHunterLookup', 12, 60000)) return;
  wordHunterActiveWord = word;
  document.querySelectorAll('.word-hunter-word.active').forEach(el => el.classList.remove('active'));
  btn.classList.add('active');
  showWordHunterPopover(btn, { word, loading: true });

  const local = (window.words || []).find(item => String(item.word || '').toLowerCase() === word.toLowerCase());
  if (local) {
    showWordHunterPopover(btn, {
      word,
      meaning: local.meaning || '',
      category: local.category || 'عام',
      example: local.example || '',
      local: true,
    });
    return;
  }

  try {
    const { data, fromCache } = await fetchAiMeaningsWithCache(word, 'normal');
    const fields = pickSuggestionFields(data?.[0] || {});
    showWordHunterPopover(btn, {
      word,
      meaning: fields.ar || 'لم نجد معنى واضح.',
      category: fields.pos || 'عام',
      example: fields.ex || '',
      fromCache,
      empty: !fields.ar,
    });
  } catch (error) {
    if (error.code === 403) {
      showWordHunterPopover(btn, { word, meaning: 'سجل دخولك لاستخدام البحث الذكي بعد التجربة.', empty: true });
      return;
    }
    showWordHunterPopover(btn, { word, meaning: 'تعذر جلب المعنى الآن.', empty: true });
  }
}

function showWordHunterPopover(anchor, data) {
  const popover = document.getElementById('wordHunterPopover');
  if (!popover || !anchor) return;
  const anchorRect = anchor.getBoundingClientRect();
  popover.hidden = false;
  const disabled = data.local || data.empty || wordExists(data.word);
  popover.innerHTML = data.loading
    ? `<div class="word-hunter-popover-loading"><i class="fas fa-spinner fa-spin" aria-hidden="true"></i><strong>${escapeHtml(data.word)}</strong></div>`
    : `
      <strong>${escapeHtml(data.word)}</strong>
      <p>${escapeHtml(data.meaning || '')}</p>
      ${data.example ? `<small>${escapeHtml(data.example)}</small>` : ''}
      <div class="word-hunter-popover-meta">${data.local ? 'موجودة في قاموسك' : (data.fromCache ? 'من الكاش المشترك' : 'فحص كلمة واحدة فقط')}</div>
      <button type="button" ${disabled ? 'disabled' : ''} onclick="addWordHunterResult(event)"
        data-word="${sugAttr(data.word)}" data-ar="${sugAttr(data.meaning || '')}" data-pos="${sugAttr(data.category || 'عام')}" data-ex="${sugAttr(data.example || '')}">
        <i class="fa-solid fa-plus" aria-hidden="true"></i>
        <span>${disabled ? 'مضافة مسبقاً' : 'إضافة للقاموس'}</span>
      </button>
    `;

  const margin = 12;
  const popoverWidth = popover.offsetWidth || Math.min(360, window.innerWidth - 24);
  const popoverHeight = popover.offsetHeight || 220;
  const anchorCenter = anchorRect.left + anchorRect.width / 2;
  const left = Math.max(
    margin + (popoverWidth / 2),
    Math.min(anchorCenter, window.innerWidth - margin - (popoverWidth / 2))
  );
  const belowTop = anchorRect.bottom + 10;
  const aboveTop = anchorRect.top - popoverHeight - 10;
  const canFitBelow = belowTop + popoverHeight <= window.innerHeight - margin;
  const canFitAbove = aboveTop >= margin;
  popover.style.left = `${left}px`;
  popover.style.top = `${canFitBelow ? belowTop : canFitAbove ? aboveTop : Math.max(margin, Math.min(belowTop, window.innerHeight - popoverHeight - margin))}px`;
  popover.style.transform = 'translateX(-50%)';
}

window.addWordHunterResult = async function(event) {
  event.preventDefault();
  event.stopPropagation();
  const btn = event.currentTarget;
  await addAiMeaningCore({
    word: decodeSugAttr(btn.dataset.word),
    ar: decodeSugAttr(btn.dataset.ar),
    pos: decodeSugAttr(btn.dataset.pos),
    ex: decodeSugAttr(btn.dataset.ex),
    game: '',
  }, btn);
};

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
      showActions: true,
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
  if (isReorderMode) {
    if (isBulkDeleteMode) window.exitBulkDeleteMode();
  } else {
    dictionarySortMode = 'auto';
    reindexWordOrder(window.words);
    saveDictionarySortPrefs();
    scheduleWordOrderCloudSync();
  }
  selectedIndices = [];
  const btn = document.getElementById('reorderBtn');
  btn.classList.toggle('active-tool', isReorderMode);
  btn.innerHTML = isReorderMode ? '💾 حفظ' : '<i class="fas fa-sort-amount-down"></i>';
  if (!isReorderMode) persistDictionary();
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
  reindexWordOrder(window.words);
  dictionarySortMode = 'auto';
  saveDictionarySortPrefs();
  persistDictionary();
  scheduleWordOrderCloudSync();
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
      persistDictionary();
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
const JSON_IMPORT_MAX_BYTES = 2 * 1024 * 1024;
const JSON_IMPORT_MAX_WORDS = 500;
const JSON_IMPORT_MAX_FIELD = 500;
const JSON_IMPORT_FEATURE_PRIORITY = ['quiz', 'pubg', 'minecraft', 'treasure', 'starred'];

function isJsonImportBatchActive() {
  return window.__jsonImportBatchActive === true;
}

function seedFeatureUnlockBaseline() {
  const unlocked = resolveUnlockedFeatures();
  const currentLocks = {};
  document.querySelectorAll('.nav-link[data-feature]').forEach((link) => {
    const id = link.getAttribute('data-feature');
    if (id) currentLocks[id] = !unlocked.has(id);
  });
  window.__navLockPrev = { ...currentLocks };
  window.__navLockAnimSeeded = true;
}

function getHighestNewlyUnlockedFeature(beforeSet, afterSet) {
  const newly = [...afterSet].filter((id) => !beforeSet.has(id));
  if (!newly.length) return null;
  for (const id of JSON_IMPORT_FEATURE_PRIORITY) {
    if (newly.includes(id)) return id;
  }
  return newly[newly.length - 1];
}

function sanitizeImportText(value, maxLen = JSON_IMPORT_MAX_FIELD) {
  if (value == null) return '';
  let text = String(value);
  if (text.length > maxLen) text = text.slice(0, maxLen);
  text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
  text = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  return text.trim();
}

function normalizeImportedWordEntry(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
  if (Object.prototype.hasOwnProperty.call(item, '__proto__') ||
      Object.prototype.hasOwnProperty.call(item, 'constructor') ||
      Object.prototype.hasOwnProperty.call(item, 'prototype')) {
    return null;
  }
  const word = sanitizeImportText(item.word || item.text);
  if (!word) return null;
  const forgetCount = Number.parseInt(item.forgetCount, 10);
  const xpValue = Number.parseInt(item.xpValue, 10);
  return {
    id: sanitizeImportText(item.id, 80) || `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    word,
    meaning: sanitizeImportText(item.meaning),
    example: sanitizeImportText(item.example, 1000),
    category: sanitizeImportText(item.category) || 'عام',
    starred: Boolean(item.starred),
    forgetCount: Number.isFinite(forgetCount) ? Math.max(0, Math.min(999, forgetCount)) : 0,
    xpValue: Number.isFinite(xpValue) ? Math.max(1, Math.min(50, xpValue)) : 3,
    createdAt: typeof item.createdAt === 'string' ? sanitizeImportText(item.createdAt, 40) : null,
  };
}

function parseImportJsonWords(rawText) {
  if (typeof rawText !== 'string' || rawText.length > JSON_IMPORT_MAX_BYTES) {
    throw new Error('size');
  }
  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error('parse');
  }
  let entries = parsed;
  if (!Array.isArray(entries) && parsed && typeof parsed === 'object') {
    if (parsed.format && parsed.format !== 'lootlingua-dictionary') throw new Error('shape');
    if (Array.isArray(parsed.words)) entries = parsed.words;
  }
  if (!Array.isArray(entries)) throw new Error('shape');
  if (entries.length > JSON_IMPORT_MAX_WORDS) throw new Error('limit');
  const words = [];
  for (const entry of entries) {
    const normalized = normalizeImportedWordEntry(entry);
    if (normalized) words.push(normalized);
  }
  if (!words.length) throw new Error('empty');
  return words;
}

function mergeImportedWords(importedWords) {
  const existing = new Set(window.words.map((w) => normalizeWord(w.word)));
  const batchSeen = new Set();
  const toAdd = [];
  for (const item of importedWords) {
    const key = normalizeWord(item.word);
    if (!key || existing.has(key) || batchSeen.has(key)) continue;
    batchSeen.add(key);
    existing.add(key);
    const uid = window.auth?.currentUser?.uid;
    toAdd.push({
      ...item,
      userId: uid || item.userId,
    });
  }
  return toAdd;
}

async function uploadImportedWordsToCloud(words) {
  const result = { uploaded: 0, failed: 0 };
  if (!window.auth?.currentUser || !window.saveWordToCloud || !words.length) return result;
  for (const item of words) {
    try {
      const realId = await window.saveWordToCloud(
        item.word,
        item.category || 'عام',
        item.meaning || '',
        item.example || ''
      );
      if (!realId) {
        result.failed++;
        continue;
      }
      item.id = realId;
      const idx = window.words.findIndex((w) => normalizeWord(w.word) === normalizeWord(item.word));
      if (idx >= 0) window.words[idx].id = realId;
      result.uploaded++;
    } catch (err) {
      console.warn('import upload:', err);
      result.failed++;
    }
  }
  return result;
}

function settleOnboardingAfterJsonImport(wordsBefore, addedCount) {
  if (wordsBefore > 0 || addedCount < 1 || hasCompletedEmptyOnboarding()) return;
  hideAllEmptyOnboardingTooltips();
  emptyOnboardingState.active = false;
  emptyOnboardingState.phase = 0;
  localStorage.setItem(EMPTY_ONBOARDING_STORAGE_KEY, 'true');
  updateDailyQuestsBadge();
  if (document.getElementById('dailyQuestsSheet')?.classList.contains('open')) renderDailyQuests();
}

function finalizeJsonImport(ctx, uploadResult) {
  const added = ctx.added || 0;
  const skipped = ctx.skipped || 0;
  const totalXp = ctx.totalXp || 0;
  const uploaded = uploadResult?.uploaded || 0;
  const failed = uploadResult?.failed || 0;

  evaluateTitleUnlocks(false);
  window.__suppressUnlockNotices = true;
  refreshFeatureUnlockUI();
  seedFeatureUnlockBaseline();
  window.__suppressUnlockNotices = false;

  const endUnlocked = resolveUnlockedFeatures();
  const endRank = getRank(userXP);
  const endTitles = new Set(getTitleState().unlocked || []);
  const newTitleDefs = TITLE_DEFS.filter((def) => endTitles.has(def.id) && !ctx.startTitles.has(def.id));

  let toastParts = [`تم استيراد ${added} كلمة`];
  if (skipped > 0) toastParts.push(`تجاوزنا ${skipped} مكررة`);
  if (totalXp > 0) toastParts.push(`+${totalXp} XP`);
  showToast(toastParts.join(' — '), 'success', 4800);

  const featureId = getHighestNewlyUnlockedFeature(ctx.startUnlocked, endUnlocked);
  if (featureId) {
    const featureTitle = UNLOCK_EXPLAIN[featureId]?.title || 'ميزة جديدة';
    setTimeout(() => {
      playUnlockSound();
      pushNotification(`🎉 انفتحت لك: ${featureTitle}`, 'success');
    }, 450);
  }

  if (endRank.label !== ctx.startRank.label) {
    setTimeout(() => showRankUp(endRank), 900);
  }

  if (newTitleDefs.length) {
    const latestTitle = newTitleDefs[newTitleDefs.length - 1];
    setTimeout(() => pushNotification(`🏅 لقب جديد: ${latestTitle.name}`, 'success'), 1300);
  }

  const dailyBefore = ctx.dailyCountBefore || 0;
  const dailyAfter = getDailyCount();
  if (dailyBefore < DAILY_GOAL && dailyAfter >= DAILY_GOAL) {
    setTimeout(launchConfetti, 1100);
  }

  if (window.auth?.currentUser) {
    setTimeout(() => {
      if (uploaded > 0) {
        pushNotification(
          failed > 0
            ? `☁️ رُفع ${uploaded} كلمة لحسابك (${failed} ما انرفعت)`
            : `☁️ رُفع ${uploaded} كلمة لحسابك بنجاح`,
          failed > 0 ? 'warning' : 'success'
        );
      } else if (failed > 0) {
        pushNotification('☁️ ما قدرنا نرفع الكلمات للسحابة. بياناتك محفوظة محلياً.', 'warning');
      }
    }, 1700);
  }

  settleOnboardingAfterJsonImport(ctx.wordsBefore, added);

  window.__suppressCloudWordsSnapshot = false;
  if (typeof window.writeWordsToStorage === 'function') {
    window.writeWordsToStorage(window.words, 'normal', window.auth?.currentUser?.uid);
  }
}

window.exportData = function() {
  const payload = {
    format: 'lootlingua-dictionary',
    version: 1,
    exportedAt: new Date().toISOString(),
    words: Array.isArray(window.words) ? window.words : [],
  };
  const a = document.createElement('a');
  a.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(payload, null, 2));
  a.download = 'lootlingua_dict.json';
  a.click();
};

window.importData = async function(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  event.target.value = '';

  if (!rateLimit('jsonImport', 5, 60000)) {
    showToast('استنى شوي قبل ما تستورد ملف ثاني.');
    return;
  }
  if (file.size > JSON_IMPORT_MAX_BYTES) {
    showToast('الملف كبير زيادة. الحد الأقصى 2 ميغابايت.');
    return;
  }

  let importedWords;
  try {
    importedWords = parseImportJsonWords(await file.text());
  } catch (err) {
    const code = err?.message || '';
    if (code === 'limit') showToast(`الملف فيه أكثر من ${JSON_IMPORT_MAX_WORDS} كلمة. قسّمه لملفات أصغر.`);
    else if (code === 'size') showToast('الملف كبير زيادة. الحد الأقصى 2 ميغابايت.');
    else if (code === 'empty') showToast('ما لقينا كلمات صالحة في الملف.');
    else showToast('خطأ في الملف. تأكد إنه JSON صحيح من LootLingua.');
    return;
  }

  const toAdd = mergeImportedWords(importedWords);
  if (!toAdd.length) {
    showToast('ما في كلمات جديدة — إما كلها موجودة عندك أو مكررة بالملف.');
    return;
  }

  const ctx = {
    startXp: userXP,
    startRank: getRank(userXP),
    startUnlocked: new Set(resolveUnlockedFeatures()),
    startTitles: new Set(getTitleState().unlocked || []),
    wordsBefore: window.words.length,
    dailyCountBefore: getDailyCount(),
    added: toAdd.length,
    skipped: importedWords.length - toAdd.length,
    totalXp: toAdd.reduce((sum, w) => sum + (w.xpValue || 3), 0),
  };

  window.__jsonImportBatchActive = true;
  window.__suppressUnlockNotices = true;
  window.__suppressCloudWordsSnapshot = Boolean(window.auth?.currentUser);

  try {
    window.words = [...toAdd, ...window.words];

    if (ctx.totalXp > 0) updateXP(ctx.totalXp);
    incrementDailyCountBy(toAdd.length);
    if (typeof checkAndUpdateStreak === 'function') checkAndUpdateStreak();

    const uploadResult = await uploadImportedWordsToCloud(toAdd);

    persistDictionary();
    renderLimit = 20;
    render();

    finalizeJsonImport(ctx, uploadResult);
  } catch (err) {
    console.error('importData:', err);
    showToast('صار خطأ أثناء الاستيراد. جرب مرة ثانية.');
    window.__suppressCloudWordsSnapshot = false;
  } finally {
    window.__jsonImportBatchActive = false;
    window.__suppressUnlockNotices = false;
  }
};


// ═══════════════════════════════════════════════════════
// Treasure Loot & Titles
// ═══════════════════════════════════════════════════════
const LOOT_BOX_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const LOOT_STATE_KEY = 'lootlinguaDailyLootState';
const TITLE_STATE_KEY = 'lootlinguaTitlesState';
const ACTIVE_TITLE_KEY = 'lootlinguaActiveTitleId';
const ACTIVE_TITLE_NONE = '__none';
const STREAK_FREEZE_KEY = 'lootlinguaStreakFreezes';
const FREEZE_SAVES_KEY = 'lootlinguaFreezeSaves';
const GAME_DICT_ADDS_KEY = 'lootlinguaGameDictAdds';
const EXTRA_CHESTS_KEY = 'lootlinguaExtraChests';

const TITLE_DEFS = [
  {
    id: 'first_spark',
    icon: 'fa-solid fa-bolt',
    color: '#facc15',
    name: 'أول شرارة',
    how: 'افتح أول صندوق يومي.',
    unlocked: () => getLootState().totalOpens >= 1,
  },
  {
    id: 'loot_hunter',
    icon: 'fa-solid fa-box-open',
    color: '#f59e0b',
    name: 'صياد اللوت',
    how: 'افتح 7 صناديق يومية متتالية.',
    unlocked: () => getLootState().streak >= 7,
  },
  {
    id: 'streak_savior',
    icon: 'fa-solid fa-shield-halved',
    color: '#38bdf8',
    name: 'درع الستريك',
    how: 'خلّي Streak Freeze ينقذ سلسلتك مرة واحدة.',
    unlocked: () => loadInt(FREEZE_SAVES_KEY, 0) >= 1,
  },
  {
    id: 'game_explorer',
    icon: 'fa-solid fa-dice-d20',
    color: '#a78bfa',
    name: 'رحّالة الألعاب',
    how: 'أضف كلمة من أي قاموس ألعاب إلى قاموسك.',
    unlocked: () => loadInt(GAME_DICT_ADDS_KEY, 0) >= 1,
  },
  {
    id: 'word_collector',
    icon: 'fa-solid fa-layer-group',
    color: '#22c55e',
    name: 'جامع الكلمات',
    how: 'اجمع 25 كلمة في قاموسك.',
    unlocked: () => getDictionaryWordCount() >= 25,
  },
  {
    id: 'dictionary_keeper',
    icon: 'fa-solid fa-book-bookmark',
    color: '#06b6d4',
    name: 'أمين القاموس',
    how: 'وصل قاموسك إلى 50 كلمة.',
    unlocked: () => getDictionaryWordCount() >= 50,
  },
  {
    id: 'star_chaser',
    icon: 'fa-solid fa-star',
    color: '#fbbf24',
    name: 'صائد الصعب',
    how: 'علّم 10 كلمات ككلمات صعبة.',
    unlocked: () => getPersonalDictionaryWordsSnapshot().filter(w => w.starred).length >= 10,
  },
  {
    id: 'strategist',
    icon: 'fa-solid fa-chess-knight',
    color: '#f472b6',
    name: 'الخبير الاستراتيجي',
    how: 'أنهِ 10 اختبارات كاملة بدون ولا غلطة.',
    unlocked: () => loadInt('lootlinguaPerfectQuizzes', 0) >= 10,
  },
  {
    id: 'streak_guard',
    icon: 'fa-solid fa-fire-flame-curved',
    color: '#fb7185',
    name: 'لهيب الأسبوع',
    how: 'حافظ على Streak لمدة 7 أيام.',
    unlocked: () => loadInt('dailyStreak', 0) >= 7,
  },
  {
    id: 'level_climber',
    icon: 'fa-solid fa-mountain-sun',
    color: '#84cc16',
    name: 'متسلّق المستويات',
    how: 'وصل إلى Level 5.',
    unlocked: () => getLevelFromXP(loadInt('userXP', 0)) >= 5,
  },
];

const TITLE_CUSTOM_ICON_URLS = {
  first_spark: 'https://raw.githubusercontent.com/twitter/twemoji/master/assets/svg/26a1.svg',
  loot_hunter: 'https://raw.githubusercontent.com/twitter/twemoji/master/assets/svg/1f4e6.svg',
  streak_savior: 'https://raw.githubusercontent.com/twitter/twemoji/master/assets/svg/1f6e1.svg',
  game_explorer: 'https://raw.githubusercontent.com/twitter/twemoji/master/assets/svg/1f3b2.svg',
  word_collector: 'https://raw.githubusercontent.com/twitter/twemoji/master/assets/svg/1f5c2.svg',
  dictionary_keeper: 'https://raw.githubusercontent.com/twitter/twemoji/master/assets/svg/1f4d6.svg',
  star_chaser: 'https://raw.githubusercontent.com/twitter/twemoji/master/assets/svg/2b50.svg',
  strategist: 'https://raw.githubusercontent.com/twitter/twemoji/master/assets/svg/265f.svg',
  streak_guard: 'https://raw.githubusercontent.com/twitter/twemoji/master/assets/svg/1f525.svg',
  level_climber: 'https://raw.githubusercontent.com/twitter/twemoji/master/assets/svg/26f0.svg',
};

function getTitleIconUrl(def) {
  return def?.iconUrl || TITLE_CUSTOM_ICON_URLS[def?.id] || '';
}

function renderTitleIcon(def, className = 'title-custom-icon') {
  const color = escapeHtml(def?.color || 'var(--accent)');
  return `<i class="${escapeHtml(className)} ${escapeHtml(def?.icon || 'fa-solid fa-medal')}" style="--title-color:${color};" aria-hidden="true"></i>`;
}

function getUnlockedTitleDefs() {
  const unlocked = new Set(getTitleState().unlocked || []);
  return TITLE_DEFS.filter(def => unlocked.has(def.id));
}

function getActiveTitleId() {
  const unlocked = new Set(getTitleState().unlocked || []);
  const saved = localStorage.getItem(ACTIVE_TITLE_KEY) || '';
  if (saved === ACTIVE_TITLE_NONE) return '';
  if (saved && unlocked.has(saved)) return saved;
  return [...unlocked][0] || '';
}

function getActiveTitleDef() {
  const id = getActiveTitleId();
  return id ? TITLE_DEFS.find(def => def.id === id) || null : null;
}

window.setActiveLootlinguaTitle = function(titleId) {
  const unlocked = new Set(getTitleState().unlocked || []);
  const next = unlocked.has(titleId) ? titleId : '';
  if (next) localStorage.setItem(ACTIVE_TITLE_KEY, next);
  else localStorage.setItem(ACTIVE_TITLE_KEY, ACTIVE_TITLE_NONE);
  markGuestProfileDataDirty(ACTIVE_TITLE_KEY);
  if (window.saveProfileToCloud) window.saveProfileToCloud();
  syncHeroAvatar();
};

function renderProfileTitlePicker() {
  const picker = document.getElementById('profileTitlePicker');
  if (!picker) return;
  const unlocked = getUnlockedTitleDefs();
  if (!unlocked.length) {
    picker.innerHTML = '<p class="profile-title-empty">افتح أول لقب من صفحة الكنز حتى يظهر هنا.</p>';
    return;
  }
  picker.innerHTML = `
    <button type="button" class="profile-title-choice ${!activeId ? 'active' : ''}" onclick="setActiveLootlinguaTitle('')" aria-pressed="${!activeId}">
      <span class="profile-title-choice-icon"><i class="fa-solid fa-eye-slash" aria-hidden="true"></i></span>
      <span>بدون لقب</span>
    </button>
    ${unlocked.map(def => `
      <button type="button" class="profile-title-choice ${activeId === def.id ? 'active' : ''}" onclick="setActiveLootlinguaTitle('${escapeHtml(def.id)}')" aria-pressed="${activeId === def.id}">
        <span class="profile-title-choice-icon">${renderTitleIcon(def, 'profile-title-choice-img')}</span>
        <span>${escapeHtml(def.name)}</span>
      </button>
    `).join('')}
  `;
}

function getLootState() {
  return loadJSON(LOOT_STATE_KEY, { lastOpenAt: 0, streak: 0, totalOpens: 0, lastOpenDay: '', rewards: [], freezesEarned: 0 });
}

function renderProfileTitlePicker() {
  const picker = document.getElementById('profileTitlePicker');
  if (!picker) return;
  const unlocked = getUnlockedTitleDefs();
  if (!unlocked.length) {
    picker.innerHTML = '<p class="profile-title-empty">افتح أول لقب من صفحة الكنز حتى يظهر هنا.</p>';
    return;
  }
  picker.innerHTML = unlocked.map(def => `
    <span class="profile-title-chip" title="${escapeHtml(def.name)}">
      ${renderTitleIcon(def, 'profile-title-choice-img')}
      <span>${escapeHtml(def.name)}</span>
    </span>
  `).join('');
}

function saveLootState(state) {
  saveJSON(LOOT_STATE_KEY, state);
  if (!hasSignedInUser()) markGuestDataDirty();
  if (window.saveProfileToCloud) window.saveProfileToCloud();
}

function getTitleState() {
  return loadJSON(TITLE_STATE_KEY, { unlocked: [], lastUnlockedAt: {} });
}

function saveTitleState(state) {
  saveJSON(TITLE_STATE_KEY, state);
  if (!hasSignedInUser()) markGuestDataDirty();
  if (window.saveProfileToCloud) window.saveProfileToCloud();
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
  if (!hasSignedInUser()) markGuestDataDirty();
  if (window.saveProfileToCloud) window.saveProfileToCloud();
}

function recordGameDictionaryAdd() {
  saveInt(GAME_DICT_ADDS_KEY, loadInt(GAME_DICT_ADDS_KEY, 0) + 1);
  if (!hasSignedInUser()) markGuestDataDirty();
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
  if (event?.pointerType !== 'touch') event?.preventDefault();
  window.__lootPointerStart = event ? { x: event.clientX, y: event.clientY } : null;
  const chest = document.getElementById('dailyLootChest');
  const preview = document.getElementById('lootRewardPreview');
  const availability = getLootAvailability();
  if (!availability.ready) {
    window.__lootPointerStart = null;
    window.openDailyLootBox();
    return;
  }
  if (window.__lootOpening || window.__lootHoldTimer) {
    window.__lootPointerStart = null;
    return;
  }
  chest?.classList.add('is-charging');
  if (preview) preview.textContent = 'ثبّت ضغطتك شوي... الصندوق بدأ يتشقق.';
  window.__lootHoldTimer = setTimeout(() => {
    window.__lootHoldTimer = null;
    window.openDailyLootBox();
  }, 820);
};

window.moveLootChestCharge = function(event) {
  if (!window.__lootHoldTimer || !window.__lootPointerStart || !event) return;
  const dx = event.clientX - window.__lootPointerStart.x;
  const dy = event.clientY - window.__lootPointerStart.y;
  if (Math.hypot(dx, dy) > 14) {
    window.cancelLootChestCharge();
  }
};

window.releaseLootChestCharge = function(event) {
  if (event?.pointerType !== 'touch') event?.preventDefault();
  window.__lootPointerStart = null;
  if (!window.__lootHoldTimer) return;
  clearTimeout(window.__lootHoldTimer);
  window.__lootHoldTimer = null;
  document.getElementById('dailyLootChest')?.classList.remove('is-charging');
  const preview = document.getElementById('lootRewardPreview');
  if (preview) preview.textContent = 'ثبّت الضغط شوي عشان الصندوق يفقع.';
};

window.cancelLootChestCharge = function(event) {
  window.__lootPointerStart = null;
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
  const words = getPersonalDictionaryWordsSnapshot();
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
  if (localStorage.getItem(ACTIVE_TITLE_KEY) &&
      localStorage.getItem(ACTIVE_TITLE_KEY) !== ACTIVE_TITLE_NONE &&
      !unlocked.has(localStorage.getItem(ACTIVE_TITLE_KEY))) {
    localStorage.removeItem(ACTIVE_TITLE_KEY);
  }
  saveTitleState(state);
  if (newly.length && window.saveProfileToCloud) window.saveProfileToCloud();
  if (newly.length && celebrate && !isJsonImportBatchActive()) {
    const first = newly[0];
    launchConfetti();
    showToast(`لقب جديد: ${first.name}`, 'success', 5200);
  }
  renderTitlesGrid();
  syncHeroAvatar();
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
        <div class="title-icon">${renderTitleIcon(def)}</div>
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
        icon: "fa-solid fa-parachute-box"
      },
      {
        text: "Flank",
        meaning: "الالتفاف حول العدو من الجانب أو الخلف",
        example: "Let's flank them from the left side.",
        icon: "fa-solid fa-route"
      },
      {
        text: "Loot",
        meaning: "جمع الغنائم والأسلحة والمعدات من الخريطة",
        example: "Good loot spawns in military compounds.",
        icon: "fa-solid fa-box-open"
      },
      {
        text: "Snipe",
        meaning: "القنص والاستهداف من مسافة بعيدة جداً",
        example: "He sniped me from 400 meters away.",
        icon: "fa-solid fa-crosshairs"
      },
      {
        text: "Revive",
        meaning: "إنقاذ زميلك الساقط وإعادته للمعركة",
        example: "Quick, revive me before they push!",
        icon: "fa-solid fa-kit-medical"
      },
      {
        text: "Zone",
        meaning: "الدائرة الآمنة — يجب البقاء داخلها أو تضرر من السم",
        example: "The zone is closing in, move now!",
        icon: "fa-solid fa-circle-dot"
      },
      {
        text: "Prone",
        meaning: "الاستلقاء على الأرض للاختباء أو تفادي الرصاص",
        example: "Go prone in the grass to stay hidden.",
        icon: "fa-solid fa-person-rifle"
      },
      {
        text: "Push",
        meaning: "الهجوم على العدو والتقدم نحوه بقوة",
        example: "They're reloading — push them now!",
        icon: "fa-solid fa-forward-fast"
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
  const buttons = document.querySelectorAll('#legendDock .treasure-dock-btn, #treasureDock .treasure-dock-btn');
  buttons.forEach(btn => {
    btn.classList.remove('active', 'dock-tip-show');
    btn.removeAttribute('aria-current');
  });
  buttons.forEach(btn => {
    if (btn.dataset.dockView === dockKey) {
      btn.classList.add('active');
      btn.setAttribute('aria-current', 'page');
    }
  });
  if (document.activeElement?.classList?.contains('treasure-dock-btn')) {
    document.activeElement.blur();
  }
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

let appSwipeStartX = null;
let appSwipeStartY = null;
let appSwipeTracking = false;
let appSwipeHorizontal = false;
let appSwipeTargetView = null;

function isMobileSwipeDevice() {
  return window.matchMedia('(max-width: 768px)').matches;
}

function isAppSwipeNavigationAvailable() {
  const dock = document.getElementById('legendDock');
  if (!dock || getComputedStyle(dock).display === 'none') return false;
  return document.body.classList.contains('legend-dock-visible') ||
    document.body.classList.contains('treasure-dock-visible');
}

function isSwipeBlockedTarget(target) {
  if (!target?.closest) return false;
  return Boolean(target.closest([
    'input',
    'textarea',
    'select',
    '.legend-dock',
    '.legend-top-bar',
    '.custom-modal',
    '.profile-modal.open',
    '.sidebar.open',
    '.onboarding-box',
    '.onboarding-tooltip',
    '.notif-hub',
    '.daily-quests-sheet.open',
    '.sound-btn',
    '.edit-btn',
    '.del-btn',
    '.star-btn',
    '.btn-add-mine',
    '.performance-level-slider'
  ].join(', ')));
}

function getSwipeTargetView(direction) {
  const view = currentView;
  const rightToLeftTargets = {
    personal: 'treasure',
    worlds: 'personal',
    minecraft: 'worlds',
    pubg: 'worlds',
    starred: 'worlds',
    quiz: 'worlds'
  };
  const leftToRightTargets = {
    treasure: 'personal',
    personal: 'worlds',
    worlds: 'quiz',
    minecraft: 'quiz',
    pubg: 'quiz',
    starred: 'quiz'
  };
  return direction === 'right-to-left' ? rightToLeftTargets[view] : leftToRightTargets[view];
}

function goToSwipeTarget(viewKey) {
  if (!viewKey || viewKey === currentView) return;
  if (viewKey === 'treasure') loadTreasureView();
  else if (viewKey === 'personal') loadPersonalDictionary();
  else if (viewKey === 'worlds') loadWorldsView();
  else if (viewKey === 'quiz') loadQuizView();
}

function resetAppSwipeState() {
  appSwipeStartX = null;
  appSwipeStartY = null;
  appSwipeTracking = false;
  appSwipeHorizontal = false;
  appSwipeTargetView = null;
}

function initTreasureSwipeNavigation() {
  if (window.__treasureSwipeReady) return;
  window.__treasureSwipeReady = true;
  document.addEventListener('touchstart', (event) => {
    if (!isMobileSwipeDevice()) return;
    if (event.touches?.length !== 1) return;
    if (!isAppSwipeNavigationAvailable()) return;
    if (isSwipeBlockedTarget(event.target)) return;
    const t = event.touches && event.touches[0];
    if (!t) return;
    appSwipeStartX = t.clientX;
    appSwipeStartY = t.clientY;
    appSwipeTracking = true;
    appSwipeHorizontal = false;
    appSwipeTargetView = null;
  }, { passive: true });
  document.addEventListener('touchmove', (event) => {
    if (!appSwipeTracking || appSwipeStartX == null || appSwipeStartY == null) return;
    const t = event.touches && event.touches[0];
    if (!t) return;
    const dx = t.clientX - appSwipeStartX;
    const dy = t.clientY - appSwipeStartY;
    if (!appSwipeHorizontal && Math.abs(dy) > 14 && Math.abs(dy) > Math.abs(dx) * 1.15) {
      resetAppSwipeState();
      return;
    }
    if (!appSwipeHorizontal && Math.abs(dx) > 18 && Math.abs(dx) > Math.abs(dy) * 1.25) {
      appSwipeHorizontal = true;
      appSwipeTargetView = getSwipeTargetView(dx < 0 ? 'right-to-left' : 'left-to-right');
    }
    if (appSwipeHorizontal) {
      const direction = dx < 0 ? 'right-to-left' : 'left-to-right';
      appSwipeTargetView = getSwipeTargetView(direction);
      if (appSwipeTargetView) event.preventDefault();
    }
  }, { passive: false });
  document.addEventListener('touchend', (event) => {
    if (!appSwipeTracking || appSwipeStartX == null || appSwipeStartY == null) return;
    const t = event.changedTouches && event.changedTouches[0];
    if (!t) {
      resetAppSwipeState();
      return;
    }
    const dx = t.clientX - appSwipeStartX;
    const dy = t.clientY - appSwipeStartY;
    const wasHorizontal = appSwipeHorizontal;
    const targetView = appSwipeTargetView || getSwipeTargetView(dx < 0 ? 'right-to-left' : 'left-to-right');
    resetAppSwipeState();
    if (!wasHorizontal || Math.abs(dx) < 46 || Math.abs(dx) < Math.abs(dy) * 1.15) return;
    goToSwipeTarget(targetView);
  }, { passive: true });
  document.addEventListener('touchcancel', resetAppSwipeState, { passive: true });
}

initTreasureSwipeNavigation();

window.loadGameDictionary = function(gameKey) {
  cleanupQuizSessionIfActive();
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
  setAppViewRoute(gameKey);
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
        const media = w.icon
          ? `<span class="game-icon game-icon-symbol" aria-hidden="true"><i class="${escapeHtml(w.icon)}"></i></span>`
          : `<img src="${escapeHtml(w.img)}" class="game-icon" alt="${escapeHtml(w.text)}"
                   onerror="this.src='https://cdn-icons-png.flaticon.com/512/686/686589.png'">`;
        return `
          <li class="game-card">
            <div class="game-info">
              ${media}
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
  document.getElementById('bulkDeleteBar').style.display    = 'none';
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
  cleanupQuizSessionIfActive();
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
  setAppViewRoute('worlds');
};

// ── Treasure Full-Page View ──
window.loadTreasureView = function() {
  cleanupQuizSessionIfActive();
  if (!isFeatureUnlocked('treasure')) {
    openUnlockExplainModal('treasure');
    refreshFeatureUnlockUI();
    return;
  }
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
  setAppViewRoute('treasure');
};

// ── Starred Words View ──
window.loadStarredView = function() {
  cleanupQuizSessionIfActive();
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
  document.getElementById('bulkDeleteBar').style.display = '';
  document.getElementById('list').style.display = '';

  document.querySelector('.page-header h1').innerHTML = '<i class="fas fa-star" aria-hidden="true"></i> الكلمات الصعبة';

  renderStarredWords();
  restoreViewScroll('starred');
  refreshFeatureUnlockUI();
  setAppViewRoute('starred');
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
    const cls = ['word-card',
      isBulkDeleteMode && bulkSelectedWordIds.has(String(w.id)) ? 'bulk-selected' : '',
      w.expanded ? 'show-example' : ''
    ].filter(Boolean).join(' ');
    return `
      <li class="${cls}" data-action="toggle-expand" data-index="${ri}" data-id="${safeId}">
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
  showQuizModes();

  document.querySelector('.page-header h1').innerHTML = '<i class="fas fa-gamepad" aria-hidden="true"></i> الاختبار';

  // Update available words count
  refreshQuizAvailableCount();

  restoreViewScroll('quiz');
  refreshFeatureUnlockUI();
  setAppViewRoute('quiz');
};

window.loadPersonalDictionary = function() {
  cleanupQuizSessionIfActive();
  if (isBulkDeleteMode) window.exitBulkDeleteMode();
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
  document.getElementById('bulkDeleteBar').style.display    = '';
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
  setAppViewRoute('personal');
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

  const canUseCloud = Boolean(window.auth?.currentUser && window.saveWordToCloud);
  const refreshAfterGameDictionaryAdd = () => {
    if (currentView === 'personal') render();
    else if (currentView === 'minecraft' || currentView === 'pubg') renderGameWords(currentGameWords);
    refreshFeatureUnlockUI();
  };
  if (canUseCloud) {
    const realId = await window.saveWordToCloud(text, 'لعبة', meaning, example||'');
    if (realId) {
      window.words.unshift({id:realId,word:text,meaning,example:example||'',category:'لعبة',starred:false,forgetCount:0,xpValue:xpGain});
      persistDictionary();
      showToast('تمت الإضافة لقاموسك');
      updateXP(xpGain); showXPBadge(xpGain,null,false);
      checkAndUpdateStreak(); incrementDailyCount(); recordGameDictionaryAdd();
      refreshAfterGameDictionaryAdd();
      if (btnEl) { btnEl.textContent='✓'; btnEl.classList.add('btn-already-added'); }
    } else {
      const nw={id:Date.now().toString(),word:text,meaning,example:example||'',category:'لعبة',starred:false,forgetCount:0,xpValue:xpGain};
      window.words.unshift(nw);
      persistDictionary();
      showToast('تمت الإضافة محلياً');
      updateXP(xpGain); showXPBadge(xpGain,null,false);
      checkAndUpdateStreak(); incrementDailyCount(); recordGameDictionaryAdd();
      refreshAfterGameDictionaryAdd();
      if (btnEl) { btnEl.textContent='✓'; btnEl.classList.add('btn-already-added'); }
    }
  } else {
    const nw={id:Date.now().toString(),word:text,meaning,example:example||'',category:'لعبة',starred:false,forgetCount:0,xpValue:xpGain};
    window.words.unshift(nw);
    persistDictionary();
    showToast('تمت الإضافة للقاموس المحلي');
    updateXP(xpGain); showXPBadge(xpGain,null,false);
    checkAndUpdateStreak(); incrementDailyCount(); recordGameDictionaryAdd();
    refreshAfterGameDictionaryAdd();
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

function getWordRenderKey(query, searchType, filtered) {
  return [
    query,
    searchType,
    currentFilter,
    dictionarySortMode,
    dictionarySortCategory,
    isBulkDeleteMode ? 'bulk' : 'normal',
    [...bulkSelectedWordIds].join(','),
    window.words.length,
    filtered.length,
    filtered[0]?.id || '',
    filtered[filtered.length - 1]?.id || ''
  ].join('|');
}

function getCenteredWordWindowStart(firstVisible, viewportRows, total) {
  const maxStart = Math.max(0, total - WORD_DOM_WINDOW_SIZE);
  const sideBuffer = Math.max(WORD_DOM_BUFFER, Math.floor((WORD_DOM_WINDOW_SIZE - viewportRows) / 2));
  return Math.max(0, Math.min(maxStart, firstVisible - sideBuffer));
}

function getWordWindowRange(total, listEl, resetWindow, scrollYOverride) {
  if (resetWindow) {
    wordVirtualState.start = 0;
    wordVirtualState.end = 0;
    wordVirtualState.listTop = 0;
    wordVirtualState.lastHtmlKey = '';
    wordVirtualState.total = total;
  }
  if (!WORD_RENDER_FAST_MODE || total <= WORD_DOM_WINDOW_SIZE || isReorderMode) {
    wordVirtualState.total = total;
    return { start: 0, end: total, topSpacer: 0, bottomSpacer: 0 };
  }

  const rect = listEl.getBoundingClientRect();
  const listTop = wordVirtualState.listTop || (rect.top + window.scrollY);
  wordVirtualState.listTop = listTop;

  const rowH = Math.max(86, wordVirtualState.rowHeight || 126);
  const scrollY = typeof scrollYOverride === 'number' ? scrollYOverride : window.scrollY;
  const viewportStart = Math.max(0, scrollY - listTop);
  const viewportRows = Math.ceil(window.innerHeight / rowH);
  const firstVisible = Math.max(0, Math.floor(viewportStart / rowH));
  const lastVisible = Math.min(total - 1, firstVisible + viewportRows);
  let start = wordVirtualState.start || 0;
  const canReuseWindow =
    !resetWindow &&
    wordVirtualState.total === total &&
    wordVirtualState.end > wordVirtualState.start &&
    firstVisible >= wordVirtualState.start + WORD_DOM_BUFFER &&
    lastVisible <= wordVirtualState.end - WORD_DOM_EDGE_BUFFER;

  if (!canReuseWindow) {
    start = getCenteredWordWindowStart(firstVisible, viewportRows, total);
  }
  const end = Math.min(total, start + WORD_DOM_WINDOW_SIZE);
  wordVirtualState.total = total;

  return {
    start,
    end,
    topSpacer: start * rowH,
    bottomSpacer: Math.max(0, (total - end) * rowH)
  };
}

function renderWordCard(w, query, indexMap) {
  const ri   = indexMap?.get(String(w.id)) ?? window.words.findIndex(x => x.id === w.id);
  const drag = isReorderMode
    ? `draggable="true" ondragstart="drag(event,${ri})" ondragover="allowDrop(event)" ondrop="drop(event,${ri})"`
    : '';
  const cls = ['word-card', isReorderMode ? 'reorder-mode-li' : '',
               selectedIndices.includes(ri) ? 'selected-for-move' : '',
               isBulkDeleteMode && bulkSelectedWordIds.has(String(w.id)) ? 'bulk-selected' : '',
               w.expanded ? 'show-example' : '']
    .filter(Boolean).join(' ');
  const safeId = w.id.replace(/'/g, "\\'");

  return `
    <li ${drag} class="${cls}" data-action="toggle-expand" data-index="${ri}" data-id="${safeId}">
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
}

function updateWordRowHeight(listEl) {
  requestAnimationFrame(() => {
    const card = listEl.querySelector('.word-card');
    if (!card) return;
    const rect = card.getBoundingClientRect();
    if (rect.height > 40) {
      wordVirtualState.rowHeight = Math.round(rect.height + 12);
    }
  });
}

function getWordRenderMetrics(listEl) {
  if (!listEl || !wordVirtualState.total) return null;
  const rowH = Math.max(86, wordVirtualState.rowHeight || 126);
  const listTop = wordVirtualState.listTop || (listEl.getBoundingClientRect().top + window.scrollY);
  const visibleRows = Math.ceil(window.innerHeight / rowH);
  return { rowH, listTop, visibleRows };
}

function getWordScrollWindowState(listEl, scrollY = window.scrollY) {
  const metrics = getWordRenderMetrics(listEl);
  if (!metrics) return null;
  const firstVisible = Math.max(0, Math.floor(Math.max(0, scrollY - metrics.listTop) / metrics.rowH));
  const lastVisible = firstVisible + metrics.visibleRows;
  return { ...metrics, firstVisible, lastVisible };
}

function showWordRenderLoading(show) {
  let loader = document.getElementById('wordRenderLoading');
  if (!loader && show) {
    loader = document.createElement('div');
    loader.id = 'wordRenderLoading';
    loader.className = 'word-render-loading';
    loader.setAttribute('role', 'status');
    loader.setAttribute('aria-live', 'polite');
    loader.innerHTML = '<i class="fas fa-spinner fa-spin" aria-hidden="true"></i><span>جاري تجهيز الكلمات...</span>';
    document.body.appendChild(loader);
  }
  if (loader) loader.classList.toggle('show', !!show);
}

function cancelWordWindowTransition() {
  clearTimeout(wordVirtualState.transitionTimer);
  clearTimeout(wordVirtualState.loadingTimer);
  wordVirtualState.isTransitioning = false;
  wordVirtualState.transitionTargetY = null;
  wordVirtualState.transitionPinnedY = null;
  showWordRenderLoading(false);
}

function setWordProgrammaticScroll(top) {
  wordVirtualState.programmaticScroll = true;
  window.scrollTo({ top: Math.max(0, top), behavior: 'auto' });
  requestAnimationFrame(() => {
    wordVirtualState.programmaticScroll = false;
  });
}

function finishWordWindowTransition(targetY) {
  clearTimeout(wordVirtualState.transitionTimer);
  wordVirtualState.transitionTimer = setTimeout(() => {
    clearTimeout(wordVirtualState.loadingTimer);
    setWordProgrammaticScroll(targetY);
    wordVirtualState.isTransitioning = false;
    wordVirtualState.transitionTargetY = null;
    wordVirtualState.transitionPinnedY = null;
    showWordRenderLoading(false);
  }, WORD_RENDER_TRANSITION_MS);
}

function requestWordWindowTransition(targetY, pinnedY) {
  if (wordVirtualState.isTransitioning) return true;
  wordVirtualState.isTransitioning = true;
  wordVirtualState.transitionTargetY = Math.max(0, targetY);
  wordVirtualState.transitionPinnedY = Math.max(0, pinnedY);
  clearTimeout(wordVirtualState.loadingTimer);
  wordVirtualState.loadingTimer = setTimeout(() => showWordRenderLoading(true), 90);
  setWordProgrammaticScroll(wordVirtualState.transitionPinnedY);
  requestAnimationFrame(() => {
    render({
      scrollYOverride: wordVirtualState.transitionTargetY,
      forceWindowRefresh: true
    });
    requestAnimationFrame(() => finishWordWindowTransition(wordVirtualState.transitionTargetY || 0));
  });
  return true;
}

function prepareWordWindowForTopJump() {
  if (currentView !== 'personal' || isReorderMode) return;
  const listEl = document.getElementById('list');
  if (!listEl || !WORD_RENDER_FAST_MODE) return;
  showWordRenderLoading(true);
  render({ scrollYOverride: 0, forceWindowRefresh: true });
  requestAnimationFrame(() => {
    setWordProgrammaticScroll(0);
    setTimeout(() => showWordRenderLoading(false), WORD_RENDER_TRANSITION_MS);
  });
}

function render(options = {}) {
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
  } else if (!isReorderMode) {
    filtered = sortDictionaryWords(filtered);
  }

  const listEl = document.getElementById('list');
  if (!listEl) return;
  const listWasCleared =
    !listEl.querySelector('.word-card') &&
    !listEl.querySelector('.virtual-list-spacer');

  const renderKey = getWordRenderKey(query, searchType, filtered);
  const resetWindow = renderKey !== wordVirtualState.key || renderLimit <= 20 || listWasCleared;
  if (resetWindow) {
    if (!options.forceWindowRefresh) cancelWordWindowTransition();
    wordVirtualState.key = renderKey;
    wordVirtualState.listTop = 0;
    wordVirtualState.start = 0;
    wordVirtualState.end = 0;
    wordVirtualState.lastHtmlKey = '';
    renderLimit = WORD_DOM_WINDOW_SIZE;
  }

  if (filtered.length === 0) {
    cancelWordWindowTransition();
    wordVirtualState.lastHtmlKey = '';
    listEl.innerHTML = `
      <li style="list-style:none;text-align:center;padding:40px 20px;color:var(--text-gray);">
        <div style="font-size:32px;margin-bottom:10px;"><i class="fa-solid fa-book-open" aria-hidden="true"></i></div>
        ${query ? 'ما في نتائج للبحث' : 'قاموسك فاضي، ابدأ بإضافة كلمة!'}
      </li>`;
    refreshFeatureUnlockUI();
    return;
  }

  const restoredPersonalScroll =
    listWasCleared && viewScrollY && typeof viewScrollY.personal === 'number'
      ? viewScrollY.personal
      : undefined;
  const scrollYOverride =
    typeof options.scrollYOverride === 'number'
      ? options.scrollYOverride
      : restoredPersonalScroll;
  const range = getWordWindowRange(filtered.length, listEl, resetWindow, scrollYOverride);
  const displayWords = filtered.slice(range.start, range.end);
  const wordIndexMap = new Map(window.words.map((item, index) => [String(item.id), index]));
  const htmlKey = [
    renderKey,
    range.start,
    range.end,
    Math.round(range.topSpacer),
    Math.round(range.bottomSpacer),
    isReorderMode ? 'reorder' : 'normal',
    selectedIndices.join(',')
  ].join('|');

  let didRenderWindow = false;
  if (options.forceWindowRefresh || htmlKey !== wordVirtualState.lastHtmlKey || listWasCleared) {
    const topSpacer = range.topSpacer
      ? `<li class="virtual-list-spacer" aria-hidden="true" style="height:${Math.round(range.topSpacer)}px"></li>`
      : '';
    const bottomSpacer = range.bottomSpacer
      ? `<li class="virtual-list-spacer" aria-hidden="true" style="height:${Math.round(range.bottomSpacer)}px"></li>`
      : '';
    listEl.innerHTML = topSpacer + displayWords.map(w => renderWordCard(w, query, wordIndexMap)).join('') + bottomSpacer;
    wordVirtualState.start = range.start;
    wordVirtualState.end = range.end;
    wordVirtualState.lastHtmlKey = htmlKey;
    updateWordRowHeight(listEl);
    didRenderWindow = true;
  }
  if (didRenderWindow || resetWindow) refreshFeatureUnlockUI();
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
  initEmptyOnboardingInputWatcher();
  initAppDropdowns();
  syncAppDropdownLabels();
  bindSearchLockOverlays();
  refreshGuestSearchLocks();
  syncDictionarySortUI();
  updateBulkDeleteBar();

  const list = document.getElementById('list');
  if (!list) return;

  let deleteLongPressTimer = null;

  const clearDeleteLongPress = () => {
    clearTimeout(deleteLongPressTimer);
    deleteLongPressTimer = null;
  };

  list.addEventListener('pointerdown', (e) => {
    const btn = e.target.closest('[data-action="delete"]');
    if (!btn || isBulkDeleteMode) return;
    clearDeleteLongPress();
    deleteLongPressTimer = setTimeout(() => {
      suppressDeleteClickOnce = true;
      enterBulkDeleteMode(btn.dataset.id);
    }, 700);
  });

  ['pointerup', 'pointercancel', 'pointerleave'].forEach((type) => {
    list.addEventListener(type, clearDeleteLongPress);
  });

  list.addEventListener('click', (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;

    const action = target.dataset.action;
    const id     = target.dataset.id;
    const index  = target.dataset.index;

    // Stop propagation if it's a button action to prevent li toggle
    if (action !== 'toggle-expand') e.stopPropagation();

    if (isBulkDeleteMode) {
      e.preventDefault();
      if (suppressDeleteClickOnce) {
        suppressDeleteClickOnce = false;
        return;
      }
      const row = target.closest('.word-card');
      const selectedId = id || row?.dataset.id;
      if (selectedId) toggleBulkWordSelection(selectedId);
      return;
    }

    switch (action) {
      case 'star':   window.toggleStar(id, e); break;
      case 'sound':  window.playSound(id, e);  break;
      case 'edit':   window.editWord(id, e);   break;
      case 'delete':
        if (suppressDeleteClickOnce) {
          suppressDeleteClickOnce = false;
          return;
        }
        window.deleteWord(id, e);
        break;
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

// ── Virtualized Scroll Logic ─────────────────────────────
let wordRenderScrollRaf = null;
let wordRenderScrollTimer = null;
let wordRenderLastScrollCheck = 0;
function shouldRenderWordWindowForScroll() {
  const listEl = document.getElementById('list');
  if (!listEl) return false;
  if (!listEl.querySelector('.word-card')) return true;
  if (!WORD_RENDER_FAST_MODE || !wordVirtualState.total || wordVirtualState.total <= WORD_DOM_WINDOW_SIZE) return false;

  const state = getWordScrollWindowState(listEl);
  if (!state) return false;
  const { firstVisible, lastVisible } = state;

  return (
    (wordVirtualState.start > 0 && firstVisible < wordVirtualState.start + WORD_DOM_BUFFER) ||
    (wordVirtualState.end < wordVirtualState.total && lastVisible > wordVirtualState.end - WORD_DOM_EDGE_BUFFER)
  );
}

function getWordWindowBoundaryState(listEl) {
  const state = getWordScrollWindowState(listEl);
  if (!state || wordVirtualState.end <= wordVirtualState.start) return null;
  const aboveWindow = wordVirtualState.start > 0 && state.firstVisible < wordVirtualState.start;
  const belowWindow = wordVirtualState.end < wordVirtualState.total && state.lastVisible > wordVirtualState.end;
  const nearTop = wordVirtualState.start > 0 && state.firstVisible < wordVirtualState.start + WORD_DOM_BUFFER;
  const nearBottom = wordVirtualState.end < wordVirtualState.total && state.lastVisible > wordVirtualState.end - WORD_DOM_EDGE_BUFFER;
  return { ...state, aboveWindow, belowWindow, nearTop, nearBottom };
}

function runWordScrollWindowCheck() {
  wordRenderScrollRaf = null;
  wordRenderScrollTimer = null;
  wordRenderLastScrollCheck = performance.now();

  if (currentView !== 'personal' || isReorderMode) return;
  if (wordVirtualState.programmaticScroll || wordVirtualState.isTransitioning) return;
  if (!shouldRenderWordWindowForScroll()) return;

  const listEl = document.getElementById('list');
  const state = getWordWindowBoundaryState(listEl);
  if (state && (state.aboveWindow || state.belowWindow)) {
    const goingUp = state.aboveWindow;
    const safeFirst = goingUp
      ? Math.max(0, wordVirtualState.start)
      : Math.max(0, wordVirtualState.end - state.visibleRows);
    const pinnedY = state.listTop + (safeFirst * state.rowH);
    if (requestWordWindowTransition(window.scrollY, pinnedY)) return;
  }
  render();
}

function scheduleWordScrollWindowCheck() {
  if (wordRenderScrollRaf || wordRenderScrollTimer) return;
  const elapsed = performance.now() - wordRenderLastScrollCheck;
  const delay = Math.max(0, WORD_RENDER_SCROLL_THROTTLE_MS - elapsed);
  const scheduleFrame = () => {
    wordRenderScrollTimer = null;
    wordRenderScrollRaf = requestAnimationFrame(runWordScrollWindowCheck);
  };
  if (delay > 0) wordRenderScrollTimer = setTimeout(scheduleFrame, delay);
  else scheduleFrame();
}

window.addEventListener('scroll', () => {
  if (currentView !== 'personal' || isReorderMode) return;
  if (wordVirtualState.programmaticScroll) return;
  if (wordVirtualState.isTransitioning) {
    const pinnedY = wordVirtualState.transitionPinnedY ?? window.scrollY;
    if (Math.abs(window.scrollY - pinnedY) > 4) {
      wordVirtualState.transitionTargetY = window.scrollY;
    }
    setWordProgrammaticScroll(pinnedY);
    return;
  }
  scheduleWordScrollWindowCheck();
}, { passive: true });

// ═══════════════════════════════════════════════════════
// QUIZ — Modes + Settings
// ═══════════════════════════════════════════════════════
let selectedQuizMode = 'flashcards';
let quizQuestionCount = '10';
let currentQuizSource = 'general';
let currentQuizPool = [];
let timeAttackHp = 3;
let timeAttackSeconds = 15;
let timeAttackTimer = null;
let timeAttackDirection = 'ar-to-en';
let scrambleDirection = 'ar-to-en';

const QUIZ_MODE_META = {
  flashcards: {
    title: 'بطاقات الذاكرة',
    desc: 'اختبار هادئ: اقلب البطاقة وحدد إذا تذكرت الكلمة أو نسيتها.'
  },
  timeAttack: {
    title: 'الهروب من النسيان',
    desc: 'اختيار من متعدد بسرعة. الوقت ضدك والـ HP معك.'
  },
  scramble: {
    title: 'الصندوق المشفر',
    desc: 'رتب حروف الكلمة الإنجليزية اعتماداً على معناها العربي.'
  }
};

function openQuizSetup() {
  loadQuizView();
}

function hideQuizPlayPanels() {
  ['quizViewCard', 'quizTimeAttackView', 'quizScrambleView', 'quizSettingsPanel'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
}

function stopTimeAttackTimer() {
  if (timeAttackTimer) {
    clearInterval(timeAttackTimer);
    timeAttackTimer = null;
  }
}

function cleanupQuizSessionIfActive() {
  if (currentView !== 'quiz') return;
  stopTimeAttackTimer();
  quizIndex = 0;
  currentQuizWords = [];
  currentStreak = 0;
  currentQuizMistakes = 0;
  timeAttackHp = 0;
  hideQuizPlayPanels();
  const setup = document.getElementById('quizViewSetup');
  if (setup) setup.style.display = 'block';
  const exitBtn = document.querySelector('#quizView .quiz-exit-btn');
  if (exitBtn) exitBtn.style.display = 'flex';
}

function showQuizModes() {
  stopTimeAttackTimer();
  hideQuizPlayPanels();
  const setup = document.getElementById('quizViewSetup');
  if (setup) setup.style.display = 'block';
  const exitBtn = document.querySelector('#quizView .quiz-exit-btn');
  if (exitBtn) exitBtn.style.display = 'flex';
  refreshQuizAvailableCount();
}

function closeQuizSetup() {
  showQuizModes();
}

function openQuizModeSettings(mode) {
  selectedQuizMode = QUIZ_MODE_META[mode] ? mode : 'flashcards';
  const exitBtn = document.querySelector('#quizView .quiz-exit-btn');
  if (exitBtn) exitBtn.style.display = 'none';
  document.getElementById('quizViewSetup').style.display = 'none';
  document.getElementById('quizSettingsPanel').style.display = 'block';
  document.getElementById('quizSettingsTitle').textContent = QUIZ_MODE_META[selectedQuizMode].title;
  document.getElementById('quizSettingsDesc').textContent = QUIZ_MODE_META[selectedQuizMode].desc;
  const isFlashcards = selectedQuizMode === 'flashcards';
  document.getElementById('flashcardPresetOptions').style.display = isFlashcards ? 'block' : 'none';
  document.getElementById('quizSharedSettings').style.display = isFlashcards ? 'none' : 'block';
  document.getElementById('timeAttackDirectionGroup').style.display = selectedQuizMode === 'timeAttack' ? 'block' : 'none';
  document.getElementById('scrambleDirectionGroup').style.display = selectedQuizMode === 'scramble' ? 'block' : 'none';
  refreshQuizSettingsSummary();
}

function setQuizQuestionCount(count, btn) {
  quizQuestionCount = count;
  document.querySelectorAll('[data-quiz-count]').forEach(el => {
    el.classList.toggle('active', el === btn);
  });
  refreshQuizSettingsSummary();
}

function setTimeAttackDirection(direction, btn) {
  timeAttackDirection = direction === 'en-to-ar' ? 'en-to-ar' : 'ar-to-en';
  document.querySelectorAll('[data-time-direction]').forEach(el => {
    el.classList.toggle('active', el === btn);
  });
  refreshQuizSettingsSummary();
}

function setScrambleDirection(direction, btn) {
  scrambleDirection = direction === 'en-to-ar' ? 'en-to-ar' : 'ar-to-en';
  document.querySelectorAll('[data-scramble-direction]').forEach(el => {
    el.classList.toggle('active', el === btn);
  });
  refreshQuizSettingsSummary();
}

function normalizeQuizWord(item, source, index) {
  if (!item) return null;
  return {
    id: String(item.id || `${source}-${item.text || item.word || index}`),
    word: item.word || item.text || '',
    meaning: item.meaning || '',
    example: item.example || '',
    forgetCount: item.forgetCount || 0,
    isGameQuizWord: false
  };
}

function getQuizSourceWords() {
  return (window.words || []).map((w, i) => normalizeQuizWord(w, 'general', i)).filter(w => w.word && w.meaning);
}

function shuffleQuizWords(words) {
  return [...words].sort(() => Math.random() - 0.5);
}

function getConfiguredQuizWords() {
  currentQuizSource = 'general';
  const sourceWords = getQuizSourceWords();
  const count = quizQuestionCount === 'all' ? sourceWords.length : parseInt(quizQuestionCount, 10);
  currentQuizPool = sourceWords;
  return shuffleQuizWords(sourceWords).slice(0, Math.max(1, Math.min(count, sourceWords.length)));
}

function refreshQuizAvailableCount() {
  const quizCountEl = document.getElementById('quizAvailableCount');
  if (!quizCountEl) return;
  quizCountEl.textContent = window.words.length > 0
    ? `الكلمات المتاحة: ${window.words.length}`
    : 'قاموسك الشخصي فاضي.';
}

function refreshQuizSettingsSummary() {
  const total = getQuizSourceWords().length;
  const countText = quizQuestionCount === 'all' ? 'كل الكلمات' : `${quizQuestionCount} أسئلة`;
  const summary = document.getElementById('quizSettingsSummary');
  if (summary) summary.textContent = `قاموسك الشخصي: ${total} كلمة متاحة، الاختبار: ${countText}.`;
}

function startConfiguredQuiz() {
  startActualQuiz(selectedQuizMode, { configured: true });
}

function startActualQuiz(mode, options = {}) {
  stopTimeAttackTimer();
  let words = options.configured ? getConfiguredQuizWords() : [...window.words];

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
  } else if (!options.configured && mode !== 'flashcards' && mode !== 'timeAttack' && mode !== 'scramble') {
    words.sort(() => Math.random()-0.5);
  }

  if (!words.length) {
    showToast('ما في كلمات كافية لهذا الاختبار.');
    openQuizModeSettings(options.configured ? selectedQuizMode : 'flashcards');
    return;
  }

  currentQuizWords = words;
  quizIndex = 0;
  currentStreak = 0;
  currentQuizMistakes = 0;

  document.getElementById('quizViewSetup').style.display = 'none';
  hideQuizPlayPanels();
  const exitBtn = document.querySelector('#quizView .quiz-exit-btn');
  if (exitBtn) exitBtn.style.display = 'none';

  if (mode === 'timeAttack') {
    document.getElementById('quizTimeAttackView').style.display = 'block';
    startTimeAttackQuiz();
  } else if (mode === 'scramble') {
    document.getElementById('quizScrambleView').style.display = 'block';
    updateScrambleCard();
  } else {
    document.getElementById('quizViewCard').style.display = 'block';
    updateCard();
  }
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
  showQuizModes();
}

function showStreakMsg(streak) {
  const msgs = { 3: "3 صح ورا بعض!", 5: "5 صح! أسطورة!", 7: "7 ورا بعض!", 10: "10! أنت الأفضل!" };
  if (msgs[streak]) showToast(msgs[streak]);
}

function updateQuizForgetState(w, nextForget) {
  const prevForget = w.forgetCount || 0;
  if (!w.isGameQuizWord) {
    window.words = window.words.map(x =>
      x.id === w.id ? { ...x, forgetCount: nextForget } : x
    );
  }
  const updatedWord = { ...w, forgetCount: nextForget };
  currentQuizWords[quizIndex] = updatedWord;
  if (!w.isGameQuizWord) {
    persistDictionary();
    if (window.updateWordInCloud) window.updateWordInCloud(w.id, { forgetCount: nextForget });
  }
  return { updatedWord, prevForget };
}

function rememberQuizWord(w) {
  const nextForget = Math.max((w.forgetCount || 0) - 1, 0);
  return updateQuizForgetState(w, nextForget);
}

function forgetQuizWord(w) {
  const nextForget = (w.forgetCount || 0) + 1;
  return updateQuizForgetState(w, nextForget);
}

function requeueForgotQuizWord(updatedWord, fromIndex) {
  const gap = Math.max(2, Math.min(5 - (updatedWord.forgetCount || 0), 4));
  const insertAt = Math.min(fromIndex + gap, currentQuizWords.length);
  currentQuizWords.splice(insertAt, 0, { ...updatedWord });
}

function markRemember() {
  const w = currentQuizWords[quizIndex];
  if (!w) return;
  const { prevForget } = rememberQuizWord(w);
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
  stopTimeAttackTimer();
  if (currentQuizMistakes === 0 && currentQuizWords.length > 0) {
    saveInt('lootlinguaPerfectQuizzes', loadInt('lootlinguaPerfectQuizzes', 0) + 1);
    if (!hasSignedInUser()) markGuestDataDirty();
    markDailyQuestFlag('perfectQuiz');
    if (typeof evaluateTitleUnlocks === 'function') evaluateTitleUnlocks(true);
    if (window.saveProfileToCloud) window.saveProfileToCloud();
  }
  showToast(currentQuizMistakes === 0 ? 'اختبار كامل بدون ولا غلطة!' : 'أبدعت! 👏', 'success', 3200);
  setTimeout(closeQuiz, 600);
}

function markForgot() {
  currentStreak = 0;
  currentQuizMistakes++;
  triggerShakeEffect(document.getElementById('quizViewCard'));
  safeVibrate(100);
  const w = currentQuizWords[quizIndex];
  if (!w) return;
  const { updatedWord } = forgetQuizWord(w);
  requeueForgotQuizWord(updatedWord, quizIndex);

  // حدّث عداد البطاقات في الواجهة
  quizIndex++;
  updateCard();
}

function playQuizSound(event) {
  if (currentQuizWords[quizIndex]) playSound(currentQuizWords[quizIndex].word, event);
}

function startTimeAttackQuiz() {
  timeAttackHp = 3;
  renderTimeAttackHearts(timeAttackHp);
  renderTimeAttackQuestion();
}

function renderTimeAttackHearts(hp, options = {}) {
  const host = document.getElementById('timeAttackHp');
  if (!host) return;
  const maxHp = 3;
  if (!host.querySelector('.hp-hearts')) {
    host.innerHTML = `<span class="hp-hearts" aria-label="نقاط الصحة ${hp}">${Array.from({ length: maxHp }, (_, index) =>
      `<span class="hp-heart" data-heart-index="${index}"><i class="fa-solid fa-heart" aria-hidden="true"></i><span class="hp-heart-shard shard-1" aria-hidden="true"></span><span class="hp-heart-shard shard-2" aria-hidden="true"></span></span>`
    ).join('')}</span>`;
  }
  const heartsWrap = host.querySelector('.hp-hearts');
  if (heartsWrap) heartsWrap.setAttribute('aria-label', `نقاط الصحة ${Math.max(0, hp)}`);
  const hearts = host.querySelectorAll('.hp-heart');
  hearts.forEach((heart, index) => {
    const alive = index < hp;
    if (options.breakIndex === index) {
      heart.classList.add('breaking');
      heart.classList.remove('alive');
      return;
    }
    heart.classList.toggle('alive', alive);
    if (!options.keepBreaking) heart.classList.remove('breaking');
  });
}

function renderTimeAttackQuestion() {
  stopTimeAttackTimer();
  if (quizIndex >= currentQuizWords.length || timeAttackHp <= 0) {
    finishQuizRun();
    return;
  }

  const w = currentQuizWords[quizIndex];
  document.getElementById('timeAttackCounter').textContent = `${quizIndex + 1} / ${currentQuizWords.length}`;
  renderTimeAttackHearts(timeAttackHp);
  document.querySelector('#quizTimeAttackView .quiz-mini-label').textContent =
    timeAttackDirection === 'en-to-ar' ? 'اختر المعنى العربي' : 'اختر الكلمة الإنجليزية';
  document.getElementById('timeAttackPrompt').textContent =
    timeAttackDirection === 'en-to-ar' ? w.word : w.meaning;
  document.getElementById('timeAttackProgress').style.width = `${(quizIndex / currentQuizWords.length) * 100}%`;

  const distractors = shuffleQuizWords(currentQuizPool.filter(x => x.id !== w.id)).slice(0, 3);
  const choices = shuffleQuizWords([w, ...distractors]);
  document.getElementById('timeAttackChoices').innerHTML = choices.map(choice =>
    `<button type="button" onclick="answerTimeAttack('${choice.id.replace(/'/g, "\\'")}')">${escapeHtml(timeAttackDirection === 'en-to-ar' ? choice.meaning : choice.word)}</button>`
  ).join('');

  timeAttackSeconds = 15;
  const timerStartEl = document.getElementById('timeAttackTimer');
  if (timerStartEl) {
    timerStartEl.textContent = `${timeAttackSeconds}s`;
    timerStartEl.classList.remove('timer-danger');
  }
  timeAttackTimer = setInterval(() => {
    if (currentView !== 'quiz') {
      stopTimeAttackTimer();
      return;
    }
    timeAttackSeconds--;
    const timerEl = document.getElementById('timeAttackTimer');
    if (timerEl) {
      timerEl.textContent = `${timeAttackSeconds}s`;
      timerEl.classList.toggle('timer-danger', timeAttackSeconds <= 3);
    }
    if (timeAttackSeconds <= 0) answerTimeAttack('', { timedOut: true });
  }, 1000);
}

function answerTimeAttack(answerId, options = {}) {
  stopTimeAttackTimer();
  const w = currentQuizWords[quizIndex];
  if (!w) return;
  if (answerId === w.id) {
    rememberQuizWord(w);
    currentStreak++;
    showStreakMsg(currentStreak);
  } else {
    currentStreak = 0;
    currentQuizMistakes++;
    const prevHp = timeAttackHp;
    timeAttackHp--;
    renderTimeAttackHearts(timeAttackHp, { breakIndex: prevHp - 1, keepBreaking: true });
    triggerShakeEffect(document.getElementById('quizTimeAttackView'));
    safeVibrate(100);
    const { updatedWord } = forgetQuizWord(w);
    if (timeAttackHp > 0) requeueForgotQuizWord(updatedWord, quizIndex);
    showToast(options.timedOut ? 'انتهى الوقت!' : (timeAttackHp > 0 ? 'غلط، جرّب تكمل!' : 'خلصت نقاط الصحة.'));
    setTimeout(() => renderTimeAttackHearts(timeAttackHp), 680);
  }
  quizIndex++;
  renderTimeAttackQuestion();
}

function scrambleWord(word) {
  const chars = String(word || '').replace(/\s+/g, '').split('');
  if (chars.length <= 2) return chars.join('');
  let mixed = chars;
  for (let i = 0; i < 4 && mixed.join('').toLowerCase() === chars.join('').toLowerCase(); i++) {
    mixed = shuffleQuizWords(chars);
  }
  return mixed.join('');
}

function updateScrambleCard() {
  if (quizIndex >= currentQuizWords.length) {
    finishQuizRun();
    return;
  }
  const w = currentQuizWords[quizIndex];
  document.getElementById('scrambleCounter').textContent = `${quizIndex + 1} / ${currentQuizWords.length}`;
  document.getElementById('scrambleProgress').style.width = `${(quizIndex / currentQuizWords.length) * 100}%`;
  document.querySelector('#quizScrambleView .quiz-mini-label').textContent =
    scrambleDirection === 'en-to-ar' ? 'اكتب المعنى العربي' : 'رتب الحروف حسب المعنى';
  document.getElementById('scrambleMeaning').textContent =
    scrambleDirection === 'en-to-ar' ? w.word : w.meaning;
  document.getElementById('scrambleLetters').innerHTML = scrambleDirection === 'en-to-ar'
    ? ''
    : scrambleWord(w.word)
      .split('')
      .map(ch => `<span>${escapeHtml(ch)}</span>`)
      .join('');
  const input = document.getElementById('scrambleInput');
  input.value = '';
  input.dir = scrambleDirection === 'en-to-ar' ? 'rtl' : 'ltr';
  input.placeholder = scrambleDirection === 'en-to-ar' ? 'اكتب المعنى بالعربي...' : 'اكتب الكلمة هنا...';
  setTimeout(() => input.focus(), 40);
}

function submitScrambleAnswer() {
  const w = currentQuizWords[quizIndex];
  if (!w) return;
  const input = document.getElementById('scrambleInput');
  const normalize = s => String(s || '').toLowerCase().replace(/[\s_-]+/g, '');
  const expected = scrambleDirection === 'en-to-ar' ? w.meaning : w.word;
  if (normalize(input.value) === normalize(expected)) {
    rememberQuizWord(w);
    currentStreak++;
    showStreakMsg(currentStreak);
  } else {
    currentStreak = 0;
    currentQuizMistakes++;
    triggerShakeEffect(document.getElementById('quizScrambleView'));
    safeVibrate(100);
    const { updatedWord } = forgetQuizWord(w);
    requeueForgotQuizWord(updatedWord, quizIndex);
    showToast(`الإجابة: ${expected}`);
  }
  quizIndex++;
  updateScrambleCard();
}

// ═══════════════════════════════════════════════════════
// Keyboard shortcuts
// ═══════════════════════════════════════════════════════
const DOCK_SHORTCUT_VIEWS = ['treasure', 'personal', 'worlds', 'quiz'];

window.showKeyboardShortcutsModal = function() {
  showModal('keyboardShortcutsModal');
};

function isEditableTarget(el) {
  if (!el) return false;
  const tag = el.tagName;
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag);
}

function isElementVisible(el) {
  if (!el) return false;
  return Boolean(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
}

function getActiveDockView() {
  const activeDockBtn = document.querySelector('#legendDock .treasure-dock-btn.active');
  return activeDockBtn?.dataset?.dockView || currentView || 'personal';
}

function navigateDockByKeyboard(direction) {
  const currentDockView = getActiveDockView();
  const currentIndex = Math.max(0, DOCK_SHORTCUT_VIEWS.indexOf(currentDockView));
  const nextIndex = (currentIndex + direction + DOCK_SHORTCUT_VIEWS.length) % DOCK_SHORTCUT_VIEWS.length;
  const nextView = DOCK_SHORTCUT_VIEWS[nextIndex];
  const nextBtn = document.querySelector(`#legendDock [data-dock-view="${nextView}"]`);
  if (nextBtn) {
    nextBtn.click();
    nextBtn.focus({ preventScroll: true });
  }
}

function getVisibleSearchInput() {
  const preferredByView = {
    personal: 'searchInput',
    minecraft: 'gameSearchInput',
    pubg: 'gameSearchInput',
    starred: 'starredSearchInput'
  };
  const preferred = document.getElementById(preferredByView[currentView]);
  if (isElementVisible(preferred)) return preferred;
  return ['searchInput', 'gameSearchInput', 'starredSearchInput']
    .map(id => document.getElementById(id))
    .find(isElementVisible);
}

function clearSearchInput(input) {
  if (!input) return;
  input.value = '';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  if (input.id === 'searchInput' && typeof render === 'function') render();
  else if (input.id === 'gameSearchInput' && typeof searchGameWords === 'function') searchGameWords();
  else if (input.id === 'starredSearchInput' && typeof renderStarredWords === 'function') renderStarredWords();
}

function closeOpenModalByShortcut() {
  const visibleCustomModal = Array.from(document.querySelectorAll('.custom-modal'))
    .reverse()
    .find(modal => getComputedStyle(modal).display !== 'none');
  if (visibleCustomModal) {
    if (visibleCustomModal.id === 'welcomeModal' && typeof dismissWelcomeModal === 'function') {
      dismissWelcomeModal();
    } else {
      hideModal(visibleCustomModal.id);
      if (visibleCustomModal.id === 'deleteModal') {
        document.querySelector('#deleteModal .xp-delete-warn')?.remove();
      }
    }
    return true;
  }
  const profileModal = document.getElementById('profileModal');
  if (profileModal?.classList.contains('open')) {
    closeProfileModal();
    return true;
  }
  const dailyQuestsSheet = document.getElementById('dailyQuestsSheet');
  if (dailyQuestsSheet?.classList.contains('open')) {
    closeDailyQuestsSheet();
    return true;
  }
  const statsPanel = document.getElementById('statsPanel');
  if (statsPanel && getComputedStyle(statsPanel).display !== 'none') {
    closeStatsPanel();
    return true;
  }
  return false;
}

function handleEscapeShortcut(e) {
  const active = document.activeElement;
  if (active && ['searchInput', 'gameSearchInput', 'starredSearchInput'].includes(active.id)) {
    if (active.value) {
      e.preventDefault();
      clearSearchInput(active);
      return true;
    }
  }
  if (closeOpenModalByShortcut()) {
    e.preventDefault();
    return true;
  }
  return false;
}

document.addEventListener('keydown', function(e) {
  if (e.altKey && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
    e.preventDefault();
    navigateDockByKeyboard(e.key === 'ArrowRight' ? -1 : 1);
    return;
  }

  if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey && !isEditableTarget(e.target)) {
    const searchInput = getVisibleSearchInput();
    if (searchInput) {
      e.preventDefault();
      searchInput.focus();
      searchInput.select?.();
    }
    return;
  }

  if (e.key === 'Escape' && handleEscapeShortcut(e)) return;

  if (e.key !== 'Enter') return;
  const active = document.activeElement;
  if (active.id === 'wordInput') { e.preventDefault(); window.fetchSuggestions(); }
  else if (active.id === 'scrambleInput') { e.preventDefault(); submitScrambleAnswer(); }
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
  bootstrapThemeNotificationKeysOnce();
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
  handleInitialRouting();
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
  btn.onclick = () => {
    prepareWordWindowForTopJump();
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  // مراقبة التمرير لإظهار/إخفاء الزر
  window.addEventListener('scroll', () => {
    if (window.scrollY > 400) btn.classList.add('show');
    else btn.classList.remove('show');
  }, { passive: true });
})();
