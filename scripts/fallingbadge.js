function initializeFallingBadgeManager() {
  var idleTimer;

  window.updateLogoState = function (_, __, ___, isAtBottom, isAtTop) {
    if (window.prefersReducedMotion) return;
    clearTimeout(idleTimer);

    if (isAtTop) {
      window.cssBadge.className = '';
    } else if (isAtBottom) {
      window.cssBadge.className = 'hover-animation';
    } else {
      if (window.cssBadge.className !== 'main-animation') {
        window.cssBadge.className = 'main-animation';
      }
      idleTimer = setTimeout(function () {
        if (window.cssBadge.className === 'main-animation') window.cssBadge.className = 'idle-animation';
      }, 1000);
    }
  };
  window.updateLogoState(null, null, null, false, true);

  window.scrollWrapper.addEventListener('scroll', function () {
    if (window.prefersReducedMotion) return;
    clearTimeout(idleTimer);

    if (window.cssBadge && window.cssBadge.className === 'idle-animation') {
      window.cssBadge.className = 'main-animation';
    }

    idleTimer = setTimeout(function () {
      if (window.cssBadge && window.cssBadge.className === 'main-animation') {
        window.cssBadge.className = 'idle-animation';
      }
    }, 1000);
  }, { passive: true });
};

window.initializeFallingBadgeManager = initializeFallingBadgeManager;