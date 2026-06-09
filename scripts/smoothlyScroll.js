function initializeSmoothScrollAndNestingController() {
  // --- State Tracking ---
  let transitionId = 0; // The "Sequence Counter" to prevent race conditions
  window.isNesting = mainElement.classList.contains('nesting');
  window.currentLenis = null;

  // Helper to check if we should skip animations
  const shouldSkipMotion = () => window.prefersReducedMotion || 
                               window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // --- Methods ---
  window.switchToNestingMode = () => {
    if (mainElement.classList.contains('nesting')) return;
    mainElement.classList.add('nesting');
  };

  window.switchToHomepage = () => {
    if (!mainElement.classList.contains('nesting')) return;
    mainElement.classList.remove('nesting');
  };

  window.lockToNestingMode = () => {
    window._nestingLocked = true;
    window.switchToNestingMode();
    if (nestBtn) nestBtn.style.display = 'none';
  };

  window.unlockNestingMode = () => {
    window._nestingLocked = false;
    if (nestBtn) nestBtn.style.display = '';
  };

  const updateLenisTarget = async () => {
    const target = window.isNesting ? mainSettings : scrollWrapper;
    if (window.currentLenis) window.currentLenis.destroy();

    await waitForVar('Lenis');
    const lenisOpts = { wrapper: target, autoResize: true };
    if (shouldSkipMotion()) lenisOpts.lerp = 1;
    
    const newLenis = new Lenis(lenisOpts);

    // Clamping logic for homepage
    if (newLenis.dimensions.wrapper == scrollWrapper) {
      newLenis.on('scroll', (e) => {
        const maxScrollTop = mainElement.nextElementSibling?.offsetHeight || 0;
        if (e.scroll > maxScrollTop) {
          newLenis.scrollTo(maxScrollTop, { immediate: true, force: true });
        }
      });
    }
    window.currentLenis = newLenis;
  };

  // --- The Core Logic (Race-Condition Proof) ---
  async function handleNestingChange(isCurrentlyNesting) {
    // 1. Increment sequence ID so older "ghost" calls know to stop
    const currentCallId = ++transitionId;
    
    window.isNesting = isCurrentlyNesting;

    // 2. Immediate UI Feedback (Disable both buttons)
    if (nestBtn) nestBtn.disabled = true;
    if (window.toggleBtn) window.toggleBtn.style.pointerEvents = 'none'; // Guard the skip link

    // Update 'inert' immediately for accessibility
    [mainSettings, mainElement.nextElementSibling, textSideElem].forEach((elem, i) => {
      if (elem) elem.toggleAttribute('inert', i ? window.isNesting : !window.isNesting);
    });

    // Start updating Lenis in parallel
    updateLenisTarget();

    // 3. Wait for Transition (Smart Guard)
    if (!shouldSkipMotion()) {
      const animatingElem = window.isNesting ? codeEditorElem : editorSideElem;
      const isSmallScreen = window.matchMedia('(max-aspect-ratio: 1.097 / 1)').matches;
      
      const target = isSmallScreen ? document.querySelector('#outputEditorWrapper') : animatingElem;
      const eventType = isSmallScreen ? 'transitionend' : 'animationend';

      if (target) {
        await waitElementTransitionEnd(target, 2000, eventType);
      }
    }
    // In reduced motion mode, skip the wait entirely (no yield needed)

    // 4. THE GUARD: If a newer click happened, stop here and let that call finish.
    if (currentCallId !== transitionId) return;

    // 5. Finalize UI
    if (nestBtn) {
      nestBtn.disabled = false;
      nestBtn.setAttribute('aria-label', window.isNesting ? window.i18n.viewHomepage : window.i18n.startNesting);
    }
    
    if (window.toggleBtn) {
      window.toggleBtn.style.pointerEvents = ''; // Re-enable skip link
      window.toggleBtn.textContent = window.isNesting ? window.i18n.visitHomepage : window.i18n.startNesting;
    }

    document.title = window.isNesting ? window.i18n.pageTitleEditor : window.i18n.pageTitleHomepage;
  }

  // --- Observer ---
  const observer = new MutationObserver(() => {
    const isCurrentlyNesting = mainElement.classList.contains('nesting');
    if (isCurrentlyNesting !== window.isNesting) {
      if (window._nestingLocked && !isCurrentlyNesting) {
        window.switchToNestingMode();
        return;
      }
      handleNestingChange(isCurrentlyNesting);
    }
  });

  updateLenisTarget();
  observer.observe(mainElement, { attributes: true, attributeFilter: ['class'] });

  // --- RAF & Events ---
  function raf(time) {
    window.currentLenis?.raf(time);
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);

  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
  
      const targetSelector = this.getAttribute('href');
      let targetElement;
  
      if (targetSelector == '#') targetElement = scrollWrapper.firstElementChild;
      else targetElement = document.getElementById(targetSelector.slice(1));
      
      if (window.prefersReducedMotion) {
        if (window.currentLenis) window.currentLenis.scrollTo(targetElement, { immediate: true, force: true });
        else scrollWrapper.scrollTo({ top: targetElement.offsetTop });
      } else if (window.currentLenis) {
        window.currentLenis.scrollTo(targetElement, { duration: 1.5, lock: true });
      } else {
        scrollWrapper.scrollTo({ top: targetElement.offsetTop, behavior: 'smooth' });
      }
    });
  });

  window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', () => {
    if (window.currentLenis) {
      window.currentLenis.destroy();
      window.currentLenis = null;
    }
    updateLenisTarget();
  });
};