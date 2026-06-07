// Smart Loading Overlay - Handles authentication and data-fetching delay
// This module provides a full-screen blurred overlay that appears on page refresh
// and disappears the EXACT millisecond user data arrives.

(function() {
  'use strict';

  // ============================================
  // CONFIGURATION
  // ============================================
  // Guest storage key matches script.js: WORDS_NORMAL_PREFIX + 'guest' = 'words_normal_guest'
  const GUEST_STORAGE_KEY = 'words_normal_guest';
  const LEGACY_DICTIONARY_KEY = 'lootlinguaDict';
  const LOADING_TEXT = 'جارٍ التحميل...';
  const OVERLAY_ID = 'smartLoadingOverlay';

  // ============================================
  // STATE
  // ============================================
  let overlayElement = null;
  let isOverlayVisible = false;
  let hasCheckedGuest = false;
  let authResolved = false;
  let userDataLoaded = false;

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
      </div>
    `;

    document.body.appendChild(overlay);
    overlayElement = overlay;
    
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
  }

  // ============================================
  // HIDE OVERLAY (with smooth fade out)
  // ============================================
  function hideOverlay() {
    if (!isOverlayVisible || !overlayElement) return;
    
    isOverlayVisible = false;
    overlayElement.classList.remove('visible');
    document.body.classList.remove('smart-loading-active');
    document.body.style.overflow = '';
    
    // Remove from DOM after transition
    setTimeout(() => {
      if (overlayElement && !isOverlayVisible) {
        overlayElement.remove();
        overlayElement = null;
      }
    }, 400); // Match CSS transition duration
  }

  // ============================================
  // SMART DETECTION LOGIC
  // ============================================
  function runSmartDetection() {
    // IMMEDIATELY check for guest data (synchronous, no await)
    const isGuest = checkGuestDataExists();
    hasCheckedGuest = true;
    
    if (isGuest) {
      // GUEST: Bypass loading screen entirely - hide immediately
      console.log('SmartLoadingOverlay: Guest detected, bypassing loading screen');
      hideOverlay();
      return true; // Indicates bypass happened
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
      showOverlay();
      const bypassed = runSmartDetection();
      return bypassed;
    },

    // Call this when Firebase Auth state is resolved (user or null)
    onAuthResolved: function(user) {
      authResolved = true;
      
      if (!user) {
        // No user signed in - dismiss immediately
        console.log('SmartLoadingOverlay: Auth resolved - no user, dismissing');
        hideOverlay();
        return;
      }
      
      // User exists - wait for data to load
      console.log('SmartLoadingOverlay: Auth resolved - user found, waiting for data...');
      // Don't hide yet - wait for onUserDataLoaded
    },

    // Call this when user profile/words data is fully loaded from Firebase
    onUserDataLoaded: function() {
      userDataLoaded = true;
      console.log('SmartLoadingOverlay: User data loaded, dismissing overlay');
      hideOverlay();
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