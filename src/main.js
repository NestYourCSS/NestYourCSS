import { createStore } from '@nycss/state';
import { configureEngine } from '@nycss/engine/config';
import '@nycss/ui';
import { registerSW } from '@nycss/pwa';

// Initialize Proxy Store
const settingsConfig = {
  samples: { defaultValue: 'denestedShowcase' },
  externalCss: { defaultValue: '' },
  typefaces: { defaultValue: 'Fira Code' },
  fontsizes: { defaultValue: '1.25rem' },
  indentationType: { defaultValue: true },
  indentationSize: { defaultValue: 4 },
  wordWrap: { defaultValue: false },
  coordinates: { defaultValue: 2 },
  mode: { defaultValue: 3 },
  auto: { defaultValue: true },
  preserveComments: { defaultValue: false },
  showFileSize: { defaultValue: true },
  nestingDepth: { defaultValue: 3 },
  nestingDepthInfinite: { defaultValue: true },
  nestingStrategy: { defaultValue: 'balanced' },
  deduplicate: { defaultValue: false },
  valueFormat: { defaultValue: 'preserve' },
  selectorStrategy: { defaultValue: false },
  scopeStrategy: { defaultValue: 'native' },
  selectorWidth: { defaultValue: 80 },
  selectorSingleLine: { defaultValue: false },
  showMinimap: { defaultValue: false },
};

const defaults = {};
for (const key in settingsConfig) {
  defaults[key] = settingsConfig[key].defaultValue;
}

const store = createStore(defaults, {
  key: 'nycss-settings',
  onSet: {
    preserveComments: (value) => {
      window.preserveComments = !value;
      configureEngine({ preserveComments: !value });
    },
    mode: (value) => { window.processMode = value; },
    auto: (value) => { window.processAuto = value; },
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
    indentationSize: () => {
      if (window.editorIndentChar?.startsWith(' ') || window.editorIndentChar === '') {
        window.editorIndentChar = ' '.repeat(store.indentationSize);
      }
    },
  },
});

// Configure engine with initial defaults
configureEngine({
  preserveComments: !store.preserveComments,
  indentChar: '\t',
  valueFormat: store.valueFormat,
  selectorStrategy: store.selectorStrategy ? 'multiply' : 'is',
  scopeStrategy: store.scopeStrategy,
  selectorWidth: store.selectorWidth,
  selectorSingleLine: store.selectorSingleLine,
});

window.configureEngine = configureEngine;

// Initialize window globals used by legacy scripts
window.processMode ??= store.mode;
window.processAuto ??= store.auto;
window.preserveComments ??= !store.preserveComments;
window.editorIndentChar ??= '\t';
window.coordDisplayMode ??= store.coordinates;
window.deduplicate ??= store.deduplicate;
// Migrate discarded 'auto-wrap' valueFormat to 'preserve'
if (store.valueFormat === 'auto-wrap') store.valueFormat = 'preserve';
window.valueFormat ??= store.valueFormat;
window.selectorStrategy ??= store.selectorStrategy ? 'multiply' : 'is';
window.selectorWidth ??= store.selectorWidth;
window.selectorSingleLine ??= store.selectorSingleLine;
window.scopeStrategy ??= store.scopeStrategy;

// Register PWA
registerSW();

// Export for use in legacy scripts
window.__store = store;

// Legacy scripts - imported sequentially to preserve dependency order
import '../scripts/var.js';
import '../scripts/main.js';
import '../scripts/setup.js';
import '../scripts/sample.js';
import '../scripts/nesting.js';
import '../scripts/debugging.js';
import '../scripts/nestingSettings.js';
import '../scripts/minieditor.js';
import '../scripts/splashtexts.js';
import '../scripts/fallingbadge.js';
import '../scripts/animateCursor.js';
import '../scripts/smoothlyScroll.js';
import '../scripts/handlers.js';
