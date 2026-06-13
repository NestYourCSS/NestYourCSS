async function setupEditors() {
  await waitForVar('LanguageProvider');
  let provider = LanguageProvider.fromCdn("https://www.unpkg.com/ace-linters@1.2.3/build/");
      
  function initializeEditor(editorId, value) {
    const editor = ace.edit(editorId, {
      mode: "ace/mode/css",
      theme: "ace/theme/nycss",
      showPrintMargin: false
    });

    editor.commands.addCommand({
      name: "tabOutForward",
      bindKey: { win: "Tab", mac: "Tab" },
      exec: () => false,
    });

    editor.commands.addCommand({
      name: "tabOutBack",
      bindKey: { win: "Shift-Tab", mac: "Shift-Tab" },
      exec: () => false,
    });

    editor.commands.addCommand({
      name: "blurEditor",
      bindKey: { win: "Esc", mac: "Esc" },
      exec: (editor) => editor.blur(),
    });

    const textarea = editor.textInput.getElement();
    textarea.setAttribute("aria-label", editorId === "inputEditor" ? i18n.inputEditorLabel : i18n.outputEditorLabel);

    editor.setValue(value, -1);
    provider.registerEditor(editor);

    return editor;
  }

  let sample;
  sample = `
/* Selectors */
h1 {
    color: red /* test */ blue;
}
  `;
  sample = Object.values(cssSamples)[0]; // First one
  // sample = Object.values(cssSamples)[0]; // Specific one
  // sample = cssSamples["hopefullyTheEnd"]; // Specific one
  // sample = Object.values(cssSamples).slice(0, 2).join(''); // Range
  // sample = Object.values(cssSamples).join(''); // All - It would be stupid to do this

  window.inputEditor = initializeEditor("inputEditor", sample || i18n.inputPlaceholder);
  window.outputEditor = initializeEditor("outputEditor", i18n.outputPlaceholder);

  let editors = [inputEditor, outputEditor];

  // Auto Nest
  let codeChanged = false;
  let isProcessing = false;

  inputEditor.getSession().on('change', () => {
    codeChanged = true;
  });

  inputEditor.getSession().on('changeAnnotation', () => {
    if (!isProcessing) {
      isProcessing = true;

      setTimeout(() => {
        if (codeChanged && window.autoProcess !== false) {
          nestCode();
          codeChanged = false;
        }

        isProcessing = false;
      }, 0);
    }
  });

  // Initial Nest
  inputEditor.getSession()._emit('change', {
    start: { row: 0, column: 0 },
    end: { row: 0, column: 0 },
    action: 'insert',
    lines: []
  });

  // Add tab buttons
  editors.forEach(editor => {
    const isInputEditor = editor.container.id === inputEditor.container.id;
    const editorTab = createEditorTab(editor.container, isInputEditor, false);
    wrapEditorWithGroup(editor.container, editorTab);
  });

  // Setup minimap on both editors
  [window.inputEditor, window.outputEditor].forEach(ed => {
    if (ed) setupMinimap(ed);
  });

  function setupMinimap(editor) {
    const container = editor.container;
    container.style.position = 'relative';

    const minimapEl = document.createElement('div');
    minimapEl.id = editor.container.id + 'Minimap';
    minimapEl.className = 'ace-minimap';
    container.appendChild(minimapEl);

    const minimap = ace.edit(minimapEl);
    minimap.session.setMode('ace/mode/css');
    minimap.setFontSize(2.5);
    minimap.setShowPrintMargin(false);
    minimap.renderer.setShowGutter(false);
    minimap.renderer.setOption('showLineNumbers', false);
    minimap.setReadOnly(true);
    minimap.setTheme('ace/theme/nycss');
    if (!window.__store.showMinimap) minimapEl.style.display = 'none';

    minimap.setValue(editor.getValue(), -1);
    minimap.selection.clearSelection();

    let syncTimeout;
    editor.session.on('change', () => {
      clearTimeout(syncTimeout);
      syncTimeout = setTimeout(() => {
        minimap.setValue(editor.getValue(), -1);
        minimap.selection.clearSelection();
      }, 300);
    });

    const rangeIndicator = document.createElement('div');
    rangeIndicator.className = 'ace-minimap-range-indicator';
    minimapEl.appendChild(rangeIndicator);

    const rangeOverlay = document.createElement('div');
    rangeOverlay.className = 'ace-minimap-overlay';
    minimapEl.appendChild(rangeOverlay);

    function updateRangeIndicator() {
      const total = editor.session.getLength();
      if (total < 2) { rangeIndicator.style.top = '0%'; rangeIndicator.style.height = '100%'; return; }
      const scrollTop = editor.session.getScrollTop();
      const lineH = editor.renderer.lineHeight;
      const visH = editor.renderer.$size.scrollerHeight;
      const first = scrollTop / lineH;
      const visLines = visH / lineH;
      const topPct = Math.max(0, Math.min(100, (first / total) * 100));
      const heightPct = Math.max(0.5, (visLines / total) * 100);
      rangeIndicator.style.top = topPct + '%';
      rangeIndicator.style.height = Math.min(heightPct, 100 - topPct) + '%';
    }

    updateRangeIndicator();
    editor.session.on('changeScrollTop', updateRangeIndicator);
    editor.selection.on('changeCursor', () => requestAnimationFrame(updateRangeIndicator));

    let isDragging = false;

    rangeOverlay.addEventListener('mousedown', (e) => {
      isDragging = true;
      scrollEditorToY(e.clientY);
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      scrollEditorToY(e.clientY);
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        editor.focus();
      }
    });

    function scrollEditorToY(clientY) {
      const rect = minimapEl.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
      const totalLines = editor.session.getLength();
      const targetLine = Math.round(Math.max(0, Math.min(ratio * totalLines, totalLines - 1)));
      editor.scrollToLine(targetLine, true, false);
    }

    editor._minimap = { el: minimapEl, editor: minimap };
  }

  function createButton(idSuffix, className, isShadowEditor, accessibleLabel) {
    const button = document.createElement("button");
    button.id = idSuffix;
    button.classList.add(className);
    if (isShadowEditor) button.setAttribute('aria-hidden', 'true');
    else {
      button.setAttribute('aria-label', accessibleLabel);
      button.addEventListener("click", tabButtonHandler);
    }
    return button;
  }

  function createEditorTab(editor, isInputEditor, isShadowEditor) {
    const editorName = editor.id.slice(0, -"Editor".length);

    const editorTab = document.createElement("div");
    editorTab.classList.add('editorTab');

    const fileName = document.createElement("div");
    fileName.classList.add('fileName');
    fileName.textContent = `${editorName}.css`;

    const tabButtons = document.createElement("div");
    tabButtons.classList.add('tabButtons');
    tabButtons.setAttribute('role', 'toolbar');
    tabButtons.setAttribute('aria-label', i18n.editorControls.replace('{name}', editorName));
    tabButtons.setAttribute('aria-orientation', 'horizontal');

    // Add buttons to the tab
    tabButtons.appendChild(createButton(`${editorName}TabCopyAll`, 'tabCopyAll', isShadowEditor, i18n.copyAll));

    if (isInputEditor) {
      if (!isShadowEditor) {
        let fileReader = new FileReader();
        let fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.accept = ".css";

        // Set up an event listener for file selection
        fileInput.addEventListener("change", (event) => {
          if (file = event.target.files[0]) {
            fileReader.onload = (e) => window.inputEditor.setValue(e.target.result);
            fileReader.readAsText(file);
          };
        });

        // Add event listeners for drag-and-drop functionality
        setupDragAndDrop(editor);

        window.insertCSSFileInput = fileInput;
      }

      const insertBtn = createButton(`${editorName}TabInsertCSS`, 'tabInsertCSS', isShadowEditor, i18n.insertCSSFile);
      insertBtn.setAttribute('aria-controls', 'inputEditor');
      tabButtons.appendChild(insertBtn);
    } else {
      tabButtons.appendChild(createButton(`${editorName}TabOpenRaw`, 'tabOpenRaw', isShadowEditor, i18n.openRawOutput));
    }

    tabButtons.appendChild(createButton(`${editorName}TabDeleteAll`, 'tabDeleteAll', isShadowEditor, i18n.deleteAll));

    // Add file name and buttons to the tab
    editorTab.appendChild(fileName);
    editorTab.appendChild(tabButtons);

    return editorTab;
  }

  function wrapEditorWithGroup(editor, editorTab) {
    const editorGroup = document.createElement("div");
    editorGroup.classList.add('editorGroup');

    // Replace editor with the group
    editor.replaceWith(editorGroup);

    // Add editor and the tab into the group
    editorGroup.appendChild(editorTab);
    editorGroup.appendChild(editor);
  }
};

setupEditors();