import { createStore } from '@nycss/state';
import { configureEngine, parseCSS, minifyCSS, beautifyCSS, denestCSS, renestCSS } from '@nycss/engine';
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
  coordinates: 3,
  mode: 3,
  auto: true,
  preserveComments: false,
  showFileSize: false,
  nestingDepth: 3,
  nestingDepthInfinite: true,
}, {
  key: 'nycss-settings',
  onSet: {
    preserveComments: (value) => {
      window.preserveComments = !value;
      configureEngine({ preserveComments: !value });
    },
    mode: (value) => { window.processMode = value; },
    auto: (value) => { window.processAuto = value; window.autoProcess = value; },
  },
});

// Configure engine
configureEngine({ preserveComments: true, indentChar: '\t' });

// Make converter functions available as window globals for legacy scripts
window.parseCSS = parseCSS;
window.minifyCSS = minifyCSS;
window.beautifyCSS = beautifyCSS;
window.denestCSS = denestCSS;
window.renestCSS = renestCSS;
window.configureEngine = configureEngine;

// Initialize window globals for legacy scripts
window.processMode = store.mode;
window.processAuto = store.auto;
window.autoProcess = store.auto;
window.preserveComments = !store.preserveComments;
window.editorIndentChar = '\t';

// Export store
window.__store = store;

// Register PWA
registerSW('./sw.js');

console.log('[QuicklyNYCSS] Monorepo entry point loaded');
