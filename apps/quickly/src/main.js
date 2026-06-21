import { createStore } from '@nycss/state';
import { configureEngine } from '@nycss/engine/config';
import '@nycss/ui';
import { registerSW } from '@nycss/pwa';

console.log('[QUICKLY MAIN] Starting entry point');

// Initialize Proxy Store
const store = createStore({
  typefaces: "Fira Code",
  fontsizes: "1.25rem",
  indentationType: true,
  indentationSize: 4,
  wordWrap: false,
  coordinates: 2,
  mode: 3,
  auto: true,
  preserveComments: false,
  showFileSize: true,
  nestingDepth: 3,
  nestingDepthInfinite: true,
  nestingStrategy: 'balanced',
  deduplicate: false,
  showMinimap: false,
}, {
  key: 'nycss-settings',
  onSet: {
    preserveComments: (value) => {
      window.preserveComments = !value;
      configureEngine({ preserveComments: !value });
    },
    mode: (value) => { window.processMode = value; },
    auto: (value) => { window.processAuto = value; window.autoProcess = value; },
    deduplicate: (value) => {
      console.log('[QUICKLY_MAIN_ONSET] deduplicate handler called with value:', value);
      console.log('[QUICKLY_MAIN_ONSET] Setting window.deduplicate =', value);
      window.deduplicate = value;
      console.log('[QUICKLY_MAIN_ONSET] Calling configureEngine({ deduplicate:', value, '})');
      configureEngine({ deduplicate: value });
    },
  },
});

// Configure engine
configureEngine({ preserveComments: true, indentChar: '\t' });

window.configureEngine = configureEngine;

// Lazy engine preloader - only loads @nycss/engine when first needed
window.preloadEngine = (() => {
  let engineLoadPromise = null;
  return function preloadEngine() {
    if (!engineLoadPromise) {
      engineLoadPromise = import('@nycss/engine').then(mod => {
        window.parseCSS = mod.parseCSS;
        window.minifyCSS = mod.minifyCSS;
        window.beautifyCSS = mod.beautifyCSS;
        window.denestCSS = mod.denestCSS;
        window.renestCSS = mod.renestCSS;
        return mod;
      });
    }
    return engineLoadPromise;
  };
})();

// Initialize window globals for legacy scripts
window.processMode = store.mode;
window.processAuto = store.auto;
window.autoProcess = store.auto;
window.preserveComments = !store.preserveComments;
window.editorIndentChar = '\t';
window.deduplicate = store.deduplicate;

// Export store
window.__store = store;

// Register PWA
registerSW('./sw.js');

console.log('[QuicklyNYCSS] Monorepo entry point loaded');
