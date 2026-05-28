(function() {
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

  document.addEventListener('click', (e) => {
    if (!e.target.closest('nycss-dropdown')) closeDropdowns();
  });

  function initSettings(store) {
    function runNestCode() {
      if (typeof nestCode === 'function' && (window.processAuto ?? true)) nestCode();
    }

    /* Subscribe to store changes */
    store._subscribe({
      samples: (value) => {
        if (typeof cssSamples === 'undefined' || typeof window.inputEditorInstance === 'undefined') return;
        window.cssSample = value;
        window.inputEditorInstance.setValue(cssSamples[window.cssSample] || '', -1);
      },
      externalCss: (value) => {
        if (!value || window.appIsInitializing) return;
        fetch(value).then(r => {
          if (!r.ok) throw new Error(`HTTP error! Status: ${r.status}`);
          const ct = r.headers.get('Content-Type');
          if (!ct || !ct.includes('text/css')) throw new Error('Fetched a non-CSS file');
          return r.text();
        }).then(cssContent => {
          if (typeof window.inputEditorInstance !== 'undefined') window.inputEditorInstance.setValue(cssContent, -1);
          const combo = document.getElementById('externalCss');
          if (combo && combo.addRecent) combo.addRecent(value);
        }).catch(error => {
          window.currentError = error;
          const msgs = {
            'Failed to fetch': "Couldn't fetch the file. Please check the URL, and ensure it's accessible via your CORS proxy.",
            'Fetched a non-CSS file': 'Successfully fetched the file, but it was not a CSS file.'
          };
          alert(msgs[error.message] || 'An error occurred while fetching the external CSS file - please see the console.');
          if (!msgs[error.message]) console.error('Error fetching external CSS:', error);
        });
      },
      typefaces: (value) => {
        if (typeof window.outputEditorInstance === 'undefined') return;
        const ff = `${value}, monospace`;
        [window.outputEditorInstance, window.inputEditorInstance].forEach(ed => {
          if (ed) ed.container.style.fontFamily = ff;
        });
      },
      fontsizes: (value) => {
        if (typeof window.outputEditorInstance === 'undefined') return;
        [window.outputEditorInstance, window.inputEditorInstance].forEach(ed => {
          if (ed) ed.container.style.fontSize = value;
        });
        document.querySelectorAll('.ace_tooltip').forEach(el => {
          el.style.fontSize = `${parseFloat(value) * 0.8}rem`;
        });
      },
      indentationType: (value) => {
        if (typeof window.inputEditorInstance === 'undefined') return;
        const useSoft = !value;
        [window.inputEditorInstance, window.outputEditorInstance].forEach(ed => {
          if (ed) ed.getSession().setUseSoftTabs(useSoft);
        });
        window.editorIndentChar = useSoft ? ' '.repeat(window.inputEditorInstance.getSession().getTabSize()) : '\t';
        configureEngine({ indentChar: window.editorIndentChar });
        if (window.processAuto && typeof nestCode === 'function') nestCode();
      },
      indentationSize: (value) => {
        if (typeof window.inputEditorInstance === 'undefined') return;
        const size = +value;
        [window.inputEditorInstance, window.outputEditorInstance].forEach(ed => {
          if (ed) ed.getSession().setTabSize(size);
        });
        if ((window.editorIndentChar?.startsWith(' ') || window.editorIndentChar === '')) {
          window.editorIndentChar = ' '.repeat(size);
          configureEngine({ indentChar: window.editorIndentChar });
          if (window.processAuto && typeof nestCode === 'function') nestCode();
        }
      },
      wordWrap: (value) => {
        if (typeof window.inputEditorInstance === 'undefined') return;
        [window.inputEditorInstance, window.outputEditorInstance].forEach(ed => {
          if (ed) ed.getSession().setUseWrapMode(value);
        });
      },
      coordinates: (value) => {
        if (typeof window.updateCoordinateDisplay === 'undefined') return;
        window.coordDisplayMode = value;
        [window.inputEditorInstance, window.outputEditorInstance].forEach(ed => {
          if (ed) window.updateCoordinateDisplay(ed);
        });
      },
      mode: (value) => {
        window.processMode = value;
        if (typeof nestCode === 'function') nestCode();
      },
      auto: (value) => {
        window.processAuto = value;
        const modeLabel = document.querySelector('#mode');
        if (modeLabel) modeLabel.classList.toggle('button', !value);
        if (value && typeof nestCode === 'function') nestCode();
      },
      preserveComments: (value) => {
        window.preserveComments = !value;
        configureEngine({ preserveComments: !value, indentChar: window.editorIndentChar || '\t' });
        const label = document.querySelector('#preserveComments');
        if (label) label.classList.toggle('button', !window.preserveComments);
        if (window.processAuto && typeof nestCode === 'function') nestCode();
      }
    });

    /* Attach DOM event listeners */
    document.querySelectorAll('nycss-dropdown').forEach(el => {
      el.addEventListener('change', (e) => {
        store[el.id] = e.detail;
      });
    });

    document.querySelectorAll('nycss-combobox').forEach(el => {
      el.addEventListener('change', (e) => {
        store[el.id] = e.detail;
      });
    });

    document.querySelectorAll('nycss-stepper').forEach(el => {
      el.addEventListener('change', (e) => {
        store[el.id] = e.detail;
      });
    });

    document.querySelectorAll('nycss-toggle').forEach(el => {
      el.addEventListener('change', (e) => {
        store[el.id] = e.detail;
      });
    });

    document.querySelectorAll('nycss-radio-group').forEach(el => {
      el.addEventListener('change', (e) => {
        store[el.id] = e.detail;
      });
    });

    /* Apply initial state to components */
    window.appIsInitializing = true;
    const snapshot = store._snapshot();
    for (const id in snapshot) {
      const elem = document.getElementById(id);
      if (!elem) continue;
      const tag = elem.tagName.toLowerCase();
      const val = snapshot[id];
      switch (tag) {
        case 'nycss-dropdown': elem.value = val; break;
        case 'nycss-toggle': elem.checked = val; break;
        case 'nycss-stepper': elem.value = val; break;
        case 'nycss-radio-group': elem.value = val; break;
        case 'nycss-combobox': elem.value = val; break;
      }
    }

    /* Wait for editors to be ready */
    const initCheck = setInterval(() => {
      if (window.inputEditorInstance && window.outputEditorInstance) {
        clearInterval(initCheck);
        store._init(Object.keys(snapshot));
        window.appIsInitializing = false;
      }
    }, 100);
  }

  document.addEventListener('DOMContentLoaded', () => {
    initSettings(window.__store);
  });
})();
