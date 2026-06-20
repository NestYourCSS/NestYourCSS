function initializeFallingBadgeManager() {
  // Variable to keep track of the timer
  let scrollTimer, hovered = false;

  // Event listener for scroll events
  window.updateLogoState = (scrollTop, scrollHeight, clientHeight) => {
    if (window.prefersReducedMotion) return;
    if (scrollTimer) clearTimeout(scrollTimer);

    if (scrollTop === undefined) {
      scrollTop = scrollWrapper.scrollTop;
      scrollHeight = scrollWrapper.scrollHeight;
      clientHeight = scrollWrapper.clientHeight;
    }

    // Check if user is at the bottom
    if ((scrollTop / scrollHeight) < 0.01) {
      cssBadge.className = '';
    } else if (((scrollTop + clientHeight) / scrollHeight) >= 0.9995) {
      cssBadge.className = 'hover-animation';
      if (!hovered) hovered ^= 1;
    } else if (cssBadge.className != 'main-animation') {
      cssBadge.className = 'main-animation';
      if (hovered) hovered ^= 1;
    } else {
      scrollTimer = setTimeout(() => {
        if (cssBadge.className == 'main-animation') cssBadge.className = 'idle-animation';
      }, 1000);
    }
  };
  window.updateLogoState();
};