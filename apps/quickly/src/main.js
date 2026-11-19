import { createStore } from '@nycss/state';
import { configureEngine } from '@nycss/engine/config';
import '@nycss/ui';
import { registerSW } from '@nycss/pwa';

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
  valueFormat: 'preserve',
  selectorStrategy: false,
  scopeStrategy: 'native',
  selectorWidth: 80,
  selectorSingleLine: false,
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
      window.deduplicate = value;
      configureEngine({ deduplicate: value });
    },
    valueFormat: (value) => {
      window.valueFormat = value;
      configureEngine({ valueFormat: value });
    },
    selectorStrategy: (value) => {
      window.selectorStrategy = value ? 'multiply' : 'is';
      configureEngine({ selectorStrategy: value ? 'multiply' : 'is' });
    },
    scopeStrategy: (value) => {
      window.scopeStrategy = value;
      configureEngine({ scopeStrategy: value });
    },
    selectorWidth: (value) => {
      window.selectorWidth = value;
      configureEngine({ selectorWidth: value });
    },
    selectorSingleLine: (value) => {
      window.selectorSingleLine = value;
      configureEngine({ selectorSingleLine: value });
    },
  },
});

// Configure engine
configureEngine({ preserveComments: true, indentChar: '\t', valueFormat: 'preserve', selectorStrategy: 'is', scopeStrategy: 'native', selectorWidth: 80, selectorSingleLine: false });

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
window.valueFormat = store.valueFormat;
window.selectorStrategy = store.selectorStrategy ? 'multiply' : 'is';
window.selectorWidth = store.selectorWidth;
window.selectorSingleLine = store.selectorSingleLine;
window.scopeStrategy = store.scopeStrategy;

// Export store
window.__store = store;

// Register PWA
registerSW('./sw.js');
