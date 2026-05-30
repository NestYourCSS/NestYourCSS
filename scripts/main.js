const i18n = {
    settings: 'Settings',
    editorSettings: 'Editor settings',
    copyAll: 'Copy all input code',
    insertCSSFile: 'Insert sample CSS into input',
    openRawOutput: 'Open CSS as Raw',
    deleteAll: 'Delete all input code',
    copiedToClipboard: 'Copied to clipboard',
    fileImported: 'File imported',
    textInsertedDragDrop: 'Text inserted from drag and drop',
    onlyCSSFilesAllowed: 'Only .css files or text are allowed!',
    conversionComplete: 'Conversion complete',
    cssContainsErrors: '/* Your input CSS contains errors. See table below. */',
    outputPlaceholder: '/* Your output CSS will appear here. */',
    inputPlaceholder: '/* Your input CSS should go here. */',
    cssIsValid: '/* CSS is valid! */',
    noErrorsFound: 'No errors found.',
    processing: 'Processing...',
    mode: 'Mode',
    auto: 'Auto',
    minify: 'Minify',
    beautify: 'Beautify',
    denest: 'Denest',
    nest: 'Nest',
    startNesting: 'Start Nesting',
    viewHomepage: 'View Homepage',
    visitHomepage: 'Visit Homepage',
    backToStart: 'Back to start of page',
    goToTop: 'Go to top of page',
    pageTitleEditor: 'Nest Your CSS - Editor',
    pageTitleHomepage: 'Nest Your CSS - Homepage',
    contribute: 'Contribute',
    nestingHistory: 'Nesting History',
    userSettings: 'User Settings',
    reportBug: 'Report a Bug',
    shareYourMind: 'Share Your Mind',
    nestQuicker: 'Nest Quicker',
    githubLabel: 'View on GitHub (opens in new tab)',
    historyLabel: 'View Nesting History (opens in new tab)',
    userSettingsLabel: 'User Settings (opens in new tab)',
    reportBugLabel: 'Report a Bug (opens in new tab)',
    feedbackLabel: 'Share Your Mind (opens in new tab)',
    quicklyLabel: 'Nest Quicker (opens in current tab)',
    logoAlt: 'The official logo for NestYourCSS.',
    cssBadgeAlt: 'The official CSS badge.',
    cursorAlt: 'An animated cursor showing three curved \'NEST YOUR CSS\' on the edge of a translucent circle, spinning endlessly, and constantly follows the user\'s cursor',
    nestAlt: 'A bird\'s nest...',
    inputEditorLabel: 'The editor to input CSS code that will be minified/nested/denested.',
    outputEditorLabel: 'The editor that outputs the CSS code that will be minified/nested/denested.',
    codeExampleLabel: 'Code example explaining CSS nesting',
    editorControls: '{name}.css editor controls',
    adAlt: 'Advertisement',
    samples: 'Samples',
    openingNewWindow: 'Opening raw output in a new window',
    confirmDeleteAll: 'Delete all content? This can only be undone using CTRL+Z.',
    contentDeleted: 'Content deleted',
};

window.i18n = i18n;

function applyI18n() {
    document.getElementById('settingsBtn')?.setAttribute('title', i18n.settings);
    document.getElementById('settingsBtn')?.setAttribute('aria-label', i18n.settings);
    document.getElementById('mainSettings')?.setAttribute('aria-label', i18n.editorSettings);
    document.getElementById('nestingToggleBtn') && (document.getElementById('nestingToggleBtn').textContent = i18n.startNesting);
    document.getElementById('nestBtn')?.setAttribute('aria-label', i18n.startNesting);
    document.getElementById('backToStart')?.setAttribute('aria-label', i18n.backToStart);
    document.getElementById('nycssLogoGroup')?.setAttribute('aria-label', i18n.goToTop);

    const navIds = ['githubHomeBtn', 'historyHomeBtn', 'userSettingsHomeBtn', 'reportBugHomeBtn', 'feedbackHomeBtn', 'quicklyHomeBtn'];
    const navTextKeys = ['contribute', 'nestingHistory', 'userSettings', 'reportBug', 'shareYourMind', 'nestQuicker'];
    const navLabelKeys = ['githubLabel', 'historyLabel', 'userSettingsLabel', 'reportBugLabel', 'feedbackLabel', 'quicklyLabel'];
    navIds.forEach((id, i) => {
        const el = document.getElementById(id);
        if (el) {
            const span = el.querySelector('span');
            if (span) span.textContent = i18n[navTextKeys[i]];
            el.setAttribute('aria-label', i18n[navLabelKeys[i]]);
        }
    });

    document.getElementById('nycssLogo')?.setAttribute('alt', i18n.logoAlt);
    document.getElementById('nycssBadge')?.setAttribute('alt', i18n.cssBadgeAlt);
    document.getElementById('nycssCursor')?.setAttribute('alt', i18n.cursorAlt);
    document.getElementById('nycssNest')?.setAttribute('alt', i18n.nestAlt);
    document.querySelectorAll('img[alt="Advertisement"]').forEach(img => img.setAttribute('alt', i18n.adAlt));
    document.getElementById('miniEditor')?.setAttribute('aria-label', i18n.codeExampleLabel);
    document.getElementById('samples-label') && (document.getElementById('samples-label').textContent = i18n.samples);
    document.getElementById('auto-label') && (document.getElementById('auto-label').textContent = i18n.auto);
    document.getElementById('mode-group-label') && (document.getElementById('mode-group-label').textContent = i18n.mode);

    const modeGroup = document.getElementById('mode');
    if (modeGroup) {
        const modeTexts = { 0: i18n.minify, 1: i18n.beautify, 2: i18n.denest, 3: i18n.nest };
        modeGroup.querySelectorAll('label').forEach((label, i) => {
            if (modeTexts[i]) {
                const input = label.querySelector('input[type="radio"]');
                label.textContent = '';
                label.appendChild(document.createTextNode(modeTexts[i]));
                if (input) label.appendChild(input);
            }
        });
    }
}

applyI18n();

window.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const reducedMotionMql = window.matchMedia('(prefers-reduced-motion: reduce)');
reducedMotionMql.addEventListener('change', (e) => { window.prefersReducedMotion = e.matches; });

const cssLogo = document.getElementById('nycssLogo');
const cssNest = document.getElementById('nycssNest');

function updateLogoVisibility() {
  cssBadge?.toggleAttribute('hidden', window.prefersReducedMotion);
  cssNest?.toggleAttribute('hidden', window.prefersReducedMotion);
  cssLogo?.toggleAttribute('hidden', !window.prefersReducedMotion);
  cursor?.toggleAttribute('hidden', window.prefersReducedMotion);

  if (cursor) {
    cursor.style.opacity = window.prefersReducedMotion ? '0' : '';
    cursor.style.pointerEvents = window.prefersReducedMotion ? 'none' : '';
  }
}

updateLogoVisibility();
reducedMotionMql.addEventListener('change', updateLogoVisibility);

/**
 * Creates a debounced function that delays invoking `func` until after `wait`
 * milliseconds have elapsed since the last time the debounced function was
 * invoked.
*
* @param {Function} func The function to debounce.
* @param {number} wait The number of milliseconds to delay.
* @returns {Function} Returns the new debounced function.
*/
window.debounce = (func, wait) => {
  let timeoutId = null;
  let lastArgs;

  const runTrailing = () => {
    // Only run if there was a follow-up call. `lastArgs` is cleared after the leading call runs.
    if (lastArgs) {
      func.apply(this, lastArgs);
      lastArgs = null;
    }
    timeoutId = null;
  };

  return function(...args) {
    lastArgs = args;
    // Clear any pending trailing call.
    clearTimeout(timeoutId);
    // Schedule the next trailing call.
    timeoutId = setTimeout(runTrailing, wait);

    // If no timer was active, it's a leading call.
    if (!timeoutId) {
      runTrailing();
    }
  };
};

/**
 * Creates a throttled function that only invokes `func` at most once per
 * every `limit` milliseconds.
 *
 * @param {Function} func The function to throttle.
 * @param {number} limit The number of milliseconds to throttle invocations to.
 * @returns {Function} Returns the new throttled function.
 */
window.throttle = (func, limit) => {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

/**
 * This function will round a number to a certain decimal point.
 * 
 * @param {number} num The number being rounded.
 * @param {number} [dp=2] The number of decimal points being rounded to.
 * @returns {number} The rounded number.
 */
window.roundNumber = (num, dp = 2) => {
  let multiplier = Math.pow(10, dp);
  return Math.floor(num * multiplier) / multiplier;
};

/**
 * Creates a deep clone of an object.
 *
 * @param {any} obj The object to clone.
 * @returns {any} Returns the deep cloned object.
 */
window.clone = (obj) => JSON.parse(JSON.stringify(obj));

/**
 * Converts a JavaScript value to a JSON string, but also avoids circular references.
 *
 * @param {any} obj The value to convert.
 * @returns {string} Returns the JSON string.
 */
window.safeStringify = (obj) => {
    const seen = new WeakSet();
    return JSON.stringify(obj, (key, value) => {
        if (typeof value === "object" && value !== null) {
            if (seen.has(value)) {
                return;
            }
            seen.add(value);
        }
        return value;
    });
};

/**
 * Prevents chrome's console for logging references of arrays.
 *
 * @param {...any} args The arguments to log.
 */
console.logNow = ((logFunc) => (...args) => logFunc(...args.map(arg => JSON.parse(safeStringify(arg)))))(console.log);

/**
 * Checks if an element is in the viewport.
 *
 * @param {Element} el The element to check.
 * @returns {boolean} Returns `true` if the element is in the viewport, else `false`.
 */
window.isElementInViewport = (el) => {
    if (!el) return false;
  
    const rect = el.getBoundingClientRect();
    return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
};

/**
 * Waits for a global variable to be defined.
 * @param {string} varName The name of the variable on the window object.
 * @returns {Promise<void>}
 */
window.waitForVar = (varName) => {
    return new Promise(resolve => {
      const checkInterval = setInterval(() => {
        if (typeof window[varName] !== 'undefined') {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
    });
};

/**
 * Waits for a CSS animation or transition to end, with a failsafe timeout.
 * Returns a promise that resolves when either the event fires or the timeout is reached.
 *
 * @param {HTMLElement} element The element that is animating or transitioning.
 * @param {number} fallbackDurationMs The duration of the animation/transition for the failsafe timeout.
 * @returns {Promise<void>} A promise that resolves when the process is complete.
 */
window.waitElementTransitionEnd = (element, fallbackDurationMs, event = 'animationend') => {
  return new Promise(resolve => {
    let failsafeTimeoutId;

    // A single cleanup function that resolves the promise and clears the timeout.
    const finalize = () => {
      clearTimeout(failsafeTimeoutId);
      resolve();
    };

    element.addEventListener(event, finalize, { once: true }); // 'once' cleans up

    failsafeTimeoutId = setTimeout(finalize, fallbackDurationMs + 50);
  });
};

/**
 * Checks if the browser's CSS engine supports the `@scope` at-rule.
 *
 * @returns {boolean} `true` if the `@scope` at-rule is supported, otherwise `false`.
 */
function supportsScope() {
  // Create a temporary <style> element
  const style = document.createElement('style');
  
  // A flag to store the result
  let isSupported = false;

  // We must wrap this in a try...catch block
  try {
    // Append the element to the head to get a valid CSSStyleSheet object
    document.head.appendChild(style);
    
    // Try to insert a valid @scope rule. If the browser doesn't
    // understand "@scope", this line will throw a syntax error.
    style.sheet.insertRule('@scope (html) { .test {} }', 0);
    
    // If we reach this line, it means no error was thrown, so @scope is supported.
    isSupported = true;
    
  } catch (e) {
    // An error was caught, so @scope is not supported.
    isSupported = false;
    
  } finally {
    // Clean up by removing the temporary <style> element from the head
    if (style.parentNode) {
      style.parentNode.removeChild(style);
    }
  }

  return isSupported;
}