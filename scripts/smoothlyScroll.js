function initializeSmoothScrollAndNestingController() {
  // --- State Tracking ---
  let transitionId = 0; // The "Sequence Counter" to prevent race conditions
  window.isNesting = mainElement.classList.contains('nesting');
  window.currentLenis = null;

  // Helper to check if we should skip animations
  const shouldSkipMotion = () => {
    const result = window.prefersReducedMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    console.log('[NEST] shouldSkipMotion:', result, '| window.prefersReducedMotion:', window.prefersReducedMotion);
    return result;
  };

  // --- Methods ---
  window.switchToNestingMode = () => {
    console.log('[NEST] switchToNestingMode called | DOM has nesting:', mainElement.classList.contains('nesting'));
    if (mainElement.classList.contains('nesting')) {
      console.log('[NEST] switchToNestingMode: already nesting, returning');
      return;
    }
    mainElement.classList.add('nesting');
    console.log('[NEST] switchToNestingMode: added nesting class');
  };

  window.switchToHomepage = () => {
    console.log('[NEST] switchToHomepage called | DOM has nesting:', mainElement.classList.contains('nesting'));
    if (!mainElement.classList.contains('nesting')) {
      console.log('[NEST] switchToHomepage: already homepage, returning');
      return;
    }
    mainElement.classList.remove('nesting');
    console.log('[NEST] switchToHomepage: removed nesting class');
  };

  window.lockToNestingMode = () => {
    console.log('[NEST] lockToNestingMode called');
    window._nestingLocked = true;
    window.switchToNestingMode();
    if (nestBtn) nestBtn.style.display = 'none';
  };

  window.unlockNestingMode = () => {
    console.log('[NEST] unlockNestingMode called');
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
    console.log('[NEST] handleNestingChange ENTER | currentCallId:', currentCallId, '| isCurrentlyNesting:', isCurrentlyNesting, '| transitionId:', transitionId);
    console.log('[NEST] handleNestingChange | window.isNesting BEFORE:', window.isNesting, '| btn disabled:', nestBtn?.disabled);
    
    window.isNesting = isCurrentlyNesting;
    console.log('[NEST] handleNestingChange | window.isNesting SET to:', window.isNesting);

    // 2. Immediate UI Feedback (Disable both buttons)
    if (nestBtn) {
      console.log('[NEST] handleNestingChange | disabling nestBtn');
      nestBtn.disabled = true;
    }
    if (window.toggleBtn) {
      console.log('[NEST] handleNestingChange | disabling toggleBtn pointer-events');
      window.toggleBtn.style.pointerEvents = 'none'; // Guard the skip link
    }

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

      console.log('[NEST] handleNestingChange | waiting for transition. target:', target?.id, '| eventType:', eventType);
      if (target) {
        await waitElementTransitionEnd(target, 2000, eventType);
        console.log('[NEST] handleNestingChange | transition ended');
      }
    } else {
      console.log('[NEST] handleNestingChange | SKIPPING transition wait (reduced motion)');
    }

    // 4. THE GUARD: If a newer click happened, stop here and let that call finish.
    if (currentCallId !== transitionId) {
      console.log('[NEST] handleNestingChange | GUARD TRIGGERED: currentCallId', currentCallId, '!== transitionId', transitionId, '→ returning early');
      return;
    }
    console.log('[NEST] handleNestingChange | GUARD PASSED: currentCallId', currentCallId, '=== transitionId', transitionId);

    // 5. Finalize UI
    if (nestBtn) {
      console.log('[NEST] handleNestingChange | re-enabling nestBtn, aria-label:', window.isNesting ? 'viewHomepage' : 'startNesting');
      nestBtn.disabled = false;
      nestBtn.setAttribute('aria-label', window.isNesting ? window.i18n.viewHomepage : window.i18n.startNesting);
    }
    
    if (window.toggleBtn) {
      console.log('[NEST] handleNestingChange | re-enabling toggleBtn, text:', window.isNesting ? window.i18n.visitHomepage : window.i18n.startNesting);
      window.toggleBtn.style.pointerEvents = ''; // Re-enable skip link
      window.toggleBtn.textContent = window.isNesting ? window.i18n.visitHomepage : window.i18n.startNesting;
    }

    const newTitle = window.isNesting ? window.i18n.pageTitleEditor : window.i18n.pageTitleHomepage;
    console.log('[NEST] handleNestingChange | setting document.title:', newTitle);
    document.title = newTitle;
    console.log('[NEST] handleNestingChange EXIT');
  }

  // --- Observer ---
  const observer = new MutationObserver(() => {
    const isCurrentlyNesting = mainElement.classList.contains('nesting');
    console.log('[NEST] MutationObserver fired | DOM has nesting:', isCurrentlyNesting, '| window.isNesting:', window.isNesting, '| btn disabled:', nestBtn?.disabled, '| _nestingLocked:', window._nestingLocked);
    if (isCurrentlyNesting !== window.isNesting) {
      console.log('[NEST] MutationObserver: state DIFFERS, will handle');
      if (window._nestingLocked && !isCurrentlyNesting) {
        console.log('[NEST] MutationObserver: _nestingLocked true AND class removed → calling switchToNestingMode');
        window.switchToNestingMode();
        return;
      }
      handleNestingChange(isCurrentlyNesting);
    } else {
      console.log('[NEST] MutationObserver: state MATCHES, no action taken');
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