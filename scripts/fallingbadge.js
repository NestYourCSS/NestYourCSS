function initializeFallingBadgeManager() {
  // Variable to keep track of the timer
  let scrollTimer, hovered = false;

  // Event listener for scroll events
  window.updateLogoState = (scrollTop, scrollHeight, clientHeight) => {
    if (window.prefersReducedMotion) return;
    if (scrollTimer) clearTimeout(scrollTimer);

    if (scrollTop === undefined) {
      scrollTop = window.scrollWrapper.scrollTop;
      scrollHeight = window.scrollWrapper.scrollHeight;
      clientHeight = window.scrollWrapper.clientHeight;
    }

    // Check if user is at the bottom
    if ((scrollTop / scrollHeight) < 0.01) {
      window.cssBadge.className = '';
    } else if (((scrollTop + clientHeight) / scrollHeight) >= 0.9995) {
      window.cssBadge.className = 'hover-animation';
      if (!hovered) hovered ^= 1;
    } else if (window.cssBadge.className != 'main-animation') {
      window.cssBadge.className = 'main-animation';
      if (hovered) hovered ^= 1;
    } else {
      scrollTimer = setTimeout(() => {
        if (window.cssBadge.className == 'main-animation') window.cssBadge.className = 'idle-animation';
      }, 1000);
    }
  };
  window.updateLogoState();
};

window.initializeFallingBadgeManager = initializeFallingBadgeManager;