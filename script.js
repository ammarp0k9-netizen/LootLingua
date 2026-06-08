// ═══════════════════════════════════════════════════════
// Smart Loading Overlay - Handles authentication and data-fetching delay
// Full-screen blurred overlay that appears on page refresh
// and disappears after UI stabilization (min 1000ms + 500ms settling delay).
// Includes slow connection/offline detection (4s warning).
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
  const SLOW_CONNECTION_TEXT = 'يبدو أن التحميل يستغرق وقتاً أطول من المعتاد. يرجى التحقق من اتصالك بالإنترنت.';
  const OVERLAY_ID = 'smartLoadingOverlay';
  const SLOW_WARNING_ID = 'smartLoadingSlowWarning';

  // Timing constants
  const MIN_VISIBILITY_MS = 1000;      // Minimum time overlay must stay visible from page load
  const SETTLING_DELAY_MS = 500;       // Delay after data loaded before starting fade-out
  const SLOW_CONNECTION_THRESHOLD_MS = 4000; // Time before showing slow connection warning
  const FADE_OUT_DURATION_MS = 400;    // CSS transition duration (must match CSS)

  // ============================================
  // STATE
  // ============================================
  let overlayElement = null;
  let slowWarningElement = null;
  let isOverlayVisible = false;
  let hasCheckedGuest = false;
  let authResolved = false;
  let userDataLoaded = false;
  let pageLoadTime = Date.now();
  let slowWarningTimer = null;
  let minVisibilityTimer = null;
  let settlingTimer = null;
  let dismissalScheduled = false;

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
    
    // Force reflow to enable transition
    overlay.offsetHeight;
    
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
    overlayElement.classList.add('visible');
    document.body.classList.add('smart-loading-active');
    
    // Prevent scrolling while loading
    document.body.style.overflow = 'hidden';
    
    // Start the slow connection warning timer
    startSlowConnectionTimer();
    
    // Start the minimum visibility timer
    startMinVisibilityTimer();
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
  // MINIMUM VISIBILITY TIMER
  // ============================================
  function startMinVisibilityTimer() {
    const elapsed = Date.now() - pageLoadTime;
    const remaining = Math.max(0, MIN_VISIBILITY_MS - elapsed);
    
    if (minVisibilityTimer) {
      clearTimeout(minVisibilityTimer);
    }
    
    minVisibilityTimer = setTimeout(() => {
      minVisibilityTimer = null;
      checkAndScheduleDismissal();
    }, remaining);
  }

  // ============================================
  // SETTLING DELAY (after data loaded)
  // ============================================
  function startSettlingDelay() {
    if (settlingTimer) {
      clearTimeout(settlingTimer);
    }
    
    settlingTimer = setTimeout(() => {
      settlingTimer = null;
      checkAndScheduleDismissal();
    }, SETTLING_DELAY_MS);
  }

  // ============================================
  // CHECK CONDITIONS AND SCHEDULE DISMISSAL
  // ============================================
  function checkAndScheduleDismissal() {
    // Can dismiss if:
    // 1. Minimum visibility time has passed (minVisibilityTimer is null)
    // 2. Data has settled (settlingTimer is null or not needed)
    // 3. Either guest was confirmed OR user data loaded
    const minVisibilityPassed = minVisibilityTimer === null;
    const settlingPassed = settlingTimer === null;
    const dataReady = hasCheckedGuest || userDataLoaded;
    
    if (minVisibilityPassed && settlingPassed && dataReady && !dismissalScheduled) {
      dismissalScheduled = true;
      hideOverlay();
    }
  }

  // ============================================
  // HIDE OVERLAY (with smooth fade out)
  // ============================================
  function hideOverlay() {
    if (!isOverlayVisible || !overlayElement) return;
    
    // Clear all timers
    if (minVisibilityTimer) {
      clearTimeout(minVisibilityTimer);
      minVisibilityTimer = null;
    }
    if (settlingTimer) {
      clearTimeout(settlingTimer);
      settlingTimer = null;
    }
    clearSlowConnectionTimer();
    
    isOverlayVisible = false;
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
      dismissalScheduled = false;
    }, FADE_OUT_DURATION_MS); // Match CSS transition duration
  }

  // ============================================
  // SMART DETECTION LOGIC
  // ============================================
  function runSmartDetection() {
    // IMMEDIATELY check for guest data (synchronous, no await)
    const isGuest = checkGuestDataExists();
    hasCheckedGuest = true;
    
    if (isGuest) {
      // GUEST: Don't hide immediately - wait for min visibility + settling delay
      console.log('SmartLoadingOverlay: Guest detected, will dismiss after stabilization');
      // Start settling delay for guest (data is already "loaded" locally)
      startSettlingDelay();
      return true; // Indicates guest was detected
    }
    
    // NOT A GUEST (or no guest data): Keep overlay, wait for Firebase
    console.log('SmartLoadingOverlay: No guest data, waiting for Firebase Auth...');
    return false; // Indicates we need to wait for auth
  }

  // ============================================
  // PUBLIC API
  // ============================================
  window.SmartLoadingOverlay = {
    // Call this ASAP on page load (before Firebase initializes)
    init: function() {
      pageLoadTime = Date.now(); // Reset page load time on init
      showOverlay();
      const bypassed = runSmartDetection();
      return bypassed;
    },

    // Call this when Firebase Auth state is resolved (user or null)
    onAuthResolved: function(user) {
      authResolved = true;
      
      if (!user) {
        // No user signed in - treat as guest, wait for settling
        console.log('SmartLoadingOverlay: Auth resolved - no user, will dismiss after stabilization');
        hasCheckedGuest = true; // Mark as checked so we can dismiss
        startSettlingDelay();
        return;
      }
      
      // User exists - wait for data to load
      console.log('SmartLoadingOverlay: Auth resolved - user found, waiting for data...');
      // Don't hide yet - wait for onUserDataLoaded
    },

    // Call this when user profile/words data is fully loaded from Firebase
    onUserDataLoaded: function() {
      userDataLoaded = true;
      console.log('SmartLoadingOverlay: User data loaded, will dismiss after stabilization');
      startSettlingDelay();
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
