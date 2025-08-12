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
 * Generates a string of 10 cryptographically secure random numbers.
 * 
 * This function creates a Uint8Array of length 10, fills it with cryptographically
 * secure random values using window.crypto.getRandomValues(), and returns them
 * joined as a string.
 * 
 * @function getRandomNumbers
 * @returns {string} A string containing 10 random numbers (0-255) joined together.
 * @throws {Error} If the crypto API is not available in the current environment.
 */
window.getRandomNumbers = () => {
  const typedArray = new Uint8Array(10);
  const randomValues = window.crypto.getRandomValues(typedArray);
  return randomValues.join('');
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