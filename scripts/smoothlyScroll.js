function initializeSmoothScrollAndNestingController() {
  window.isNesting = mainElement.classList.contains('nesting');
  window.currentLenis = null;

  window.switchToNestingMode = () => mainElement.classList.add('nesting');

  window.switchToHomepage = () => mainElement.classList.remove('nesting');

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
    if (window.prefersReducedMotion) lenisOpts.lerp = 1;
    const newLenis = new Lenis(lenisOpts);

    if (window.currentLenis == null && newLenis.dimensions.wrapper == siteWrapper) {
      // 3. Use the 'scroll' event to check the position
      newLenis.on('scroll', (e) => {
        const maxScrollTop = mainElement.nextElementSibling.offsetHeight;

        // e.scroll contains the current scroll value
        if (e.scroll > maxScrollTop) {
          // 4. If it exceeds the max, clamp it immediately
          newLenis.scrollTo(maxScrollTop, { immediate: true, force: true });
        }
      });
    }

    window.currentLenis = newLenis;
  };
  
  async function handleNestingChange(isCurrentlyNesting) {
    window.isNesting = isCurrentlyNesting;
  
    // Disable the button immediately to prevent spam-clicking during the transition
    if (nestBtn) nestBtn.disabled = true;
  
    // Update the 'inert' attribute on the views for accessibility
    [mainSettings, mainElement.nextElementSibling, textSideElem].forEach((elem, i) => {
      elem.toggleAttribute('inert', i ? window.isNesting : !window.isNesting);
    });
    
    // Update the Lenis scroller target (whole to page => nesting settings section)
    updateLenisTarget();
  
    // Re-enable the button after transition has finished
    let animatingElem = window.isNesting ? codeEditorElem : editorSideElem;
    
    if (window.matchMedia('(max-aspect-ratio: 1.097 / 1)').matches) {
      await waitElementTransitionEnd(codeEditor.querySelector('#outputEditorWrapper'), 5000, 'transitionend');
    } else {
      await waitElementTransitionEnd(animatingElem, 5000, 'animationend');
    }
  
    if (nestBtn) nestBtn.disabled = false;
  
    // Update UI state (Editor <-> Homepage)
    document.title = window.isNesting ? i18n.pageTitleEditor : i18n.pageTitleHomepage;
    if (nestBtn) nestBtn.setAttribute('aria-label', window.isNesting ? i18n.viewHomepage : i18n.startNesting);
    toggleBtn.textContent = window.isNesting ? i18n.startNesting : i18n.visitHomepage;
  };
  
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
  
  function raf(time) {
    window.currentLenis?.raf(time)
    requestAnimationFrame(raf)
  };
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