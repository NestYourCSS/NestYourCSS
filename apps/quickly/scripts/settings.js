(function() {
  const toggleBtn = document.getElementById('settings-toggle');
  const popover = document.getElementById('mainSettings');

  function closeDropdowns() {
    document.querySelectorAll('nycss-dropdown .dropdown-toggle').forEach(cb => {
      cb.checked = false;
      const output = cb.nextElementSibling;
      if (output && output.tagName === 'OUTPUT') output.setAttribute('aria-expanded', 'false');
      const host = cb.closest('nycss-dropdown');
      if (host) {
        host.setAttribute('aria-expanded', 'false');
        const list = host.querySelector('[role="listbox"]');
        if (list) list.hidden = true;
      }
    });
  }

  function openSettings() {
    popover.removeAttribute('hidden');
    closeDropdowns();
    // Focus the first focusable element in the panel
    const focusable = popover.querySelectorAll(':is(button, [href], input, select, textarea, nycss-dropdown output, nycss-combobox output, nycss-toggle, nycss-stepper, nycss-radio-group label):not([tabindex="-1"])');
    if (focusable.length) focusable[0].focus();
  }

  function closeSettings() {
    popover.setAttribute('hidden', '');
    toggleBtn.focus();
  }

  toggleBtn.addEventListener('click', (e) => {
    if (popover.hasAttribute('hidden')) {
      openSettings();
    } else {
      closeSettings();
    }
    closeDropdowns();
    e.stopPropagation();
  });

  popover.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeSettings();
    }
  });

  document.addEventListener('mousedown', (e) => {
    if (!popover.contains(e.target) && e.target !== toggleBtn) {
      closeSettings();
    }
    if (!e.target.closest('nycss-dropdown')) {
      closeDropdowns();
    }
  });

  function initQuicklySettings(store) {
    const nestBtn = document.getElementById('nest-btn');
    const settingsBtn = document.getElementById('settings-toggle');

    function updateNestButton() {
      if (!nestBtn || !settingsBtn) return;
      nestBtn.classList.remove('vibrant');
      if (window.processAuto) {
        nestBtn.innerText = i18n.auto;
        nestBtn.disabled = true;
      } else {
        const labels = { 0: i18n.minify, 1: i18n.beautify, 2: i18n.denest, 3: i18n.nest };
        nestBtn.innerText = labels[window.processMode] || i18n.nest;
        nestBtn.disabled = false;
        nestBtn.classList.add('vibrant');
      }
    }

    let coordAnnounceTimeout = null;

    function updateCoordDisplay() {
      const editors = [window.inputEditor, window.outputEditor];
      const mode = store.coordinates;
      editors.forEach(editor => {
        if (!editor) return;
        const tab = editor.container.parentElement.querySelector('.editorTab');
        const fileNameEl = tab?.querySelector('.fileName');
        if (!fileNameEl) return;
        if (mode === 0) { fileNameEl.removeAttribute('caret-pos'); return; }
        const pos = editor.getCursorPosition();
        const line = pos.row + 1;
        const col = pos.column + 1;
        let text = '';
        if (mode === 1) text = ` | Ln ${line}`;
        else if (mode === 2) text = ` | Col ${col}`;
        else text = ` | Ln ${line}, Col ${col}`;
        fileNameEl.setAttribute('caret-pos', text);
      });
      clearTimeout(coordAnnounceTimeout);
      coordAnnounceTimeout = setTimeout(() => {
        if (mode === 0) return;
        const editor = window.inputEditor;
        if (!editor) return;
        const pos = editor.getCursorPosition();
        const line = pos.row + 1;
        const col = pos.column + 1;
        let text = '';
        if (mode === 1) text = `Line ${line}`;
        else if (mode === 2) text = `Column ${col}`;
        else text = `Line ${line}, Column ${col}`;
        if (typeof announce === 'function') announce(text);
      }, 1000);
    }

    /* Subscribe to store changes */
    store._subscribe({
      typefaces: (value) => {
        const fontMap = { "DejaVu Mono": "monospace", "Fira Code": "'Fira Code', monospace", "Jetbrains Mono": "'JetBrains Mono', monospace", "PT Mono": "'PT Mono', monospace" };
        const val = fontMap[value] || "'Fira Code', monospace";
        [window.inputEditor, window.outputEditor].forEach(ed => {
          if (ed) ed.setOptions({ fontFamily: val, fontSize: parseFloat(store.fontsizes) * 16 + "px" });
        });
        const out = document.querySelector('#typefaces output');
        if (out) out.textContent = value;
      },
      fontsizes: (value) => {
        [window.inputEditor, window.outputEditor].forEach(ed => {
          if (ed) ed.setOptions({ fontSize: parseFloat(value) * 16 + "px" });
        });
        const out = document.querySelector('#fontsizes output');
        if (out) out.textContent = value;
      },
      indentationType: (value) => {
        const isTab = value;
        [window.inputEditor, window.outputEditor].forEach(ed => {
          if (ed) ed.getSession().setUseSoftTabs(!isTab);
        });
        window.editorIndentChar = isTab ? '\t' : ' '.repeat(store.indentationSize);
        configureEngine({ indentChar: window.editorIndentChar });
        if (window.processAuto && typeof nestCode === 'function') nestCode();
      },
      indentationSize: (value) => {
        const size = +value;
        [window.inputEditor, window.outputEditor].forEach(ed => {
          if (ed) ed.getSession().setTabSize(size);
        });
        if (window.editorIndentChar?.startsWith(' ')) {
          window.editorIndentChar = ' '.repeat(size);
          configureEngine({ indentChar: window.editorIndentChar });
          if (window.processAuto && typeof nestCode === 'function') nestCode();
        }
      },
      wordWrap: (value) => {
        [window.inputEditor, window.outputEditor].forEach(ed => {
          if (ed) ed.getSession().setUseWrapMode(value);
        });
      },
      coordinates: () => updateCoordDisplay(),
      mode: (value) => {
        window.processMode = value;
        updateNestButton();
        if (window.processAuto && typeof nestCode === 'function') nestCode();
        const modeLabels = { 0: i18n.minify, 1: i18n.beautify, 2: i18n.denest, 3: i18n.nest };
        document.title = `Quickly '${modeLabels[value] || 'Nest'}' Your CSS - Editor`;
      },
      auto: (value) => {
        window.processAuto = value;
        window.autoProcess = value;
        updateNestButton();
        if (value && typeof nestCode === 'function') nestCode();
      },
      preserveComments: (value) => {
        window.preserveComments = !value;
        configureEngine({ preserveComments: !value, indentChar: window.editorIndentChar || '\t' });
        if (window.processAuto && typeof nestCode === 'function') nestCode();
      },
      nestingDepth: (value) => {
        const infinite = store.nestingDepthInfinite;
        const stepper = document.getElementById('nestingDepth');
        if (stepper) stepper.disabled = infinite;
        configureEngine({ maxDepth: infinite ? Infinity : value, indentChar: window.editorIndentChar || '\t' });
        if (window.processAuto && typeof nestCode === 'function') nestCode();
      },
      nestingDepthInfinite: (value) => {
        const stepper = document.getElementById('nestingDepth');
        if (stepper) stepper.disabled = value;
        configureEngine({ maxDepth: value ? Infinity : store.nestingDepth, indentChar: window.editorIndentChar || '\t' });
        if (window.processAuto && typeof nestCode === 'function') nestCode();
      }
    });

    /* Attach DOM event listeners */

    // Font & Font Size
    document.querySelectorAll('nycss-dropdown').forEach(el => {
      el.addEventListener('change', (e) => {
        store[el.id] = e.detail;
      });
    });

    // Indentation Type
    document.getElementById('indentationType').addEventListener('change', (e) => {
      store.indentationType = e.detail;
    });

    // Indentation Size
    document.getElementById('indentationSize').addEventListener('change', (e) => {
      store.indentationSize = e.detail;
    });

    // Word Wrap
    document.getElementById('wordWrap').addEventListener('change', (e) => {
      store.wordWrap = e.detail;
    });

    // Coordinates
    document.getElementById('coordinates').addEventListener('change', (e) => {
      store.coordinates = e.detail;
    });

    // Comments
    document.getElementById('preserveComments').addEventListener('change', (e) => {
      store.preserveComments = e.detail;
    });

    // Mode
    document.getElementById('mode').addEventListener('change', (e) => {
      store.mode = e.detail;
    });

    // Auto
    document.getElementById('auto').addEventListener('change', (e) => {
      store.auto = e.detail;
    });

    // Max Depth
    document.getElementById('nestingDepth').addEventListener('change', (e) => {
      store.nestingDepth = e.detail;
    });

    // Max Depth Infinite
    document.getElementById('nestingDepthInfinite').addEventListener('change', (e) => {
      store.nestingDepthInfinite = e.detail;
    });

    // Apply initial state to components (DOM only, not editors)
    const snapshot = store._snapshot();
    for (const id in snapshot) {
      const elem = document.getElementById(id);
      if (!elem) continue;
      const tag = elem.tagName.toLowerCase();
      switch (tag) {
        case 'nycss-dropdown': elem.value = snapshot[id]; break;
        case 'nycss-toggle': elem.checked = snapshot[id]; break;
        case 'nycss-stepper': elem.value = snapshot[id]; break;
        case 'nycss-radio-group': elem.value = snapshot[id]; break;
      }
    }

    // Nest button click
    document.getElementById('nest-btn').addEventListener('click', () => {
      if (typeof nestCode === 'function' && !window.processAuto) nestCode();
    });

    updateNestButton();

    // Wait for editors to be ready before firing initial onSet callbacks and attaching cursor tracking
    const initCheck = setInterval(() => {
      if (window.inputEditor && window.outputEditor) {
        clearInterval(initCheck);
        store._init(Object.keys(snapshot));

        // Cursor tracking for coordinates
        [window.inputEditor, window.outputEditor].forEach(editor => {
          editor.selection.on('changeCursor', () => {
            if (store.coordinates !== 0) updateCoordDisplay();
          });
        });
      }
    }, 100);
  }

  document.addEventListener('DOMContentLoaded', () => {
    initQuicklySettings(window.__store);
    const settingsToggle = document.getElementById('settings-toggle');
    if (settingsToggle) settingsToggle.setAttribute('aria-label', i18n.settings);
    const mainSettings = document.getElementById('mainSettings');
    if (mainSettings) mainSettings.setAttribute('aria-label', i18n.editorSettings);
    const headerControls = document.querySelector('.header-controls');
    if (headerControls) headerControls.setAttribute('aria-label', i18n.headerControls);
  });
})();
