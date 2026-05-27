async function setupEditors() {
  await waitForVar('LanguageProvider');
  let provider = LanguageProvider.fromCdn("https://www.unpkg.com/ace-linters@1.2.3/build/");
      
  function initializeEditor(editorId, value) {
    const editor = ace.edit(editorId, {
      mode: "ace/mode/css",
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
      insertBtn.setAttribute('aria-controls', 'css-file-input');
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