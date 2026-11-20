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
        const stepper = document.getElementById('nestingDepth');
        if (stepper) stepper.disabled = value !== 3 || store.nestingDepthInfinite;
        const infiniteToggle = document.getElementById('nestingDepthInfinite');
        if (infiniteToggle) infiniteToggle.disabled = value !== 3;
        document.getElementById('nestingStrategy').disabled = value !== 3;

        const isMinify = value === 0;

        const indentationTypeEl = document.getElementById('indentationType');
        if (indentationTypeEl) indentationTypeEl.disabled = isMinify;
        const indentationSizeEl = document.getElementById('indentationSize');
        if (indentationSizeEl) {
            indentationSizeEl.disabled = isMinify;
            indentationSizeEl.querySelector('input')?.toggleAttribute('disabled', isMinify);
        }

        const valueFormatEl = document.getElementById('valueFormat');
        if (valueFormatEl) valueFormatEl.disabled = isMinify;
        const selectorWidthEl = document.getElementById('selectorWidth');
        if (selectorWidthEl) {
            selectorWidthEl.disabled = isMinify || !!store.selectorSingleLine;
            selectorWidthEl.querySelector('input')?.toggleAttribute('disabled', isMinify || !!store.selectorSingleLine);
        }
        const selectorSingleLineEl = document.getElementById('selectorSingleLine');
        if (selectorSingleLineEl) selectorSingleLineEl.disabled = isMinify;

        const isDenestMode = value === 2 || value === 3;
        const selectorStrategyEl = document.getElementById('selectorStrategy');
        if (selectorStrategyEl) selectorStrategyEl.disabled = !isDenestMode;
        const scopeStrategyEl = document.getElementById('scopeStrategy');
        if (scopeStrategyEl) scopeStrategyEl.disabled = !isDenestMode;

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
      nestingStrategy: (value) => {
        configureEngine({ strategy: value });
        if (window.processAuto && typeof nestCode === 'function') nestCode();
      },
      deduplicate: (value) => {
        configureEngine({ deduplicate: value });
        if (window.processAuto && typeof nestCode === 'function') {
          nestCode();
        }
      },
      valueFormat: (value) => {
        configureEngine({ valueFormat: value });
        if (window.processAuto && typeof nestCode === 'function') nestCode();
      },
      selectorStrategy: (value) => {
        configureEngine({ selectorStrategy: value ? 'multiply' : 'is' });
        if (window.processAuto && typeof nestCode === 'function') nestCode();
      },
      selectorWidth: (value) => {
        configureEngine({ selectorWidth: value });
        if (window.processAuto && typeof nestCode === 'function') nestCode();
      },
      selectorSingleLine: (value) => {
        const stepper = document.getElementById('selectorWidth');
        const disabled = !!value || window.processMode === 0;
        if (stepper) {
          stepper.toggleAttribute('disabled', disabled);
          stepper.querySelector('input')?.toggleAttribute('disabled', disabled);
        }
        configureEngine({ selectorSingleLine: value });
        if (window.processAuto && typeof nestCode === 'function') nestCode();
      },
      scopeStrategy: (value) => {
        configureEngine({ scopeStrategy: value });
        if (window.processAuto && typeof nestCode === 'function') nestCode();
      },
      nestingDepth: (value) => {
        const infinite = store.nestingDepthInfinite;
        const stepper = document.getElementById('nestingDepth');
        if (stepper) stepper.disabled = infinite || window.processMode !== 3;
        configureEngine({ maxDepth: infinite ? Infinity : value, indentChar: window.editorIndentChar || '\t' });
        if (window.processAuto && typeof nestCode === 'function') nestCode();
      },
      nestingDepthInfinite: (value) => {
        const stepper = document.getElementById('nestingDepth');
        if (stepper) stepper.disabled = value || window.processMode !== 3;
        configureEngine({ maxDepth: value ? Infinity : store.nestingDepth, indentChar: window.editorIndentChar || '\t' });
        if (window.processAuto && typeof nestCode === 'function') nestCode();
      },
      showMinimap: (value) => {
        [window.inputEditor, window.outputEditor].filter(Boolean).forEach(ed => {
          if (ed._minimap) ed._minimap.el.style.display = value ? '' : 'none';
        });
      },
      showFileSize: (value) => {
        const editors = [window.inputEditor, window.outputEditor].filter(Boolean);
        editors.forEach(editor => {
          const fileNameEl = editor.container.parentElement?.querySelector('.fileName');
          if (!fileNameEl) return;
          if (value) {
            fileNameEl.removeAttribute('file-size');
            if (fileNameEl.__fsUpdate) {
              editor.session.off('change', fileNameEl.__fsUpdate);
              delete fileNameEl.__fsUpdate;
            }
          } else {
            const update = () => {
              const bytes = new Blob([editor.getValue()]).size;
              const kb = (bytes / 1024).toFixed(1);
              const text = bytes >= 1024 ? ` | ${kb} KB` : ` | ${bytes} B`;
              fileNameEl.setAttribute('file-size', text);
            };
            fileNameEl.__fsUpdate = update;
            editor.session.on('change', update);
            update();
          }
        });
      }
    });

    /* Attach DOM event listeners */

    // Font & Font Size
    document.querySelectorAll('nycss-dropdown').forEach(el => {
      el.addEventListener('change', (e) => {
        store[el.id] = e.detail;
      });
    });

    // All steppers, radio groups, and toggles wire generically by id
    document.querySelectorAll('nycss-stepper').forEach(el => {
      el.addEventListener('change', (e) => {
        store[el.id] = e.detail;
      });
    });

    document.querySelectorAll('nycss-radio-group').forEach(el => {
      el.addEventListener('change', (e) => {
        store[el.id] = e.detail;
      });
    });

    document.querySelectorAll('nycss-toggle').forEach(el => {
      el.addEventListener('change', (e) => {
        store[el.id] = e.detail;
      });
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
      const editors = [window.inputEditor, window.outputEditor];
      // Elements with these ids are exposed as globals before Ace replaces them,
      // so wait until both are actual editor instances with a container/session.
      if (!editors.every(editor => editor?.container && editor?.session)) return;

      clearInterval(initCheck);
      // Ensure file-size is cleared on all tab buttons
      editors.forEach(editor => {
        const fileNameEl = editor.container.parentElement?.querySelector('.fileName');
        if (fileNameEl) fileNameEl.removeAttribute('file-size');
      });
      store._init(Object.keys(snapshot));

      // Cursor tracking for coordinates
      editors.forEach(editor => {
        editor.selection.on('changeCursor', () => {
          if (store.coordinates !== 0) updateCoordDisplay();
        });
      });
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
