function tabButtonHandler(e) {
    let tabButton = e.currentTarget;
    let editor = (tabButton.parentElement.parentElement.nextElementSibling?.id.startsWith("input")) ? inputEditor : outputEditor;

    switch (tabButton.className) {
      case "tabCopyAll":
        let copiedText = editor.getValue(); 
        navigator.clipboard.writeText(copiedText);
        break;
      case "tabInsertCSS":
        window.insertCSSFileInput.click();
        break;
      case "tabOpenRaw":
        // Get the raw text from the editor
        let content = editor.getValue();

        // Open a new blank window
        let rawFileWindow = window.open("", "_blank");
        rawFileWindow.document.write(`
          <html style="color-scheme: dark;">
              <body style="
                margin: 0;
                padding: 2rem;
                font-family: monospace;
                background: linear-gradient(to right, #12121280, #09253380), black;
              ">

                <pre style="
                background: url('assets/nycss-bg-pattern.png') 0 0.1dvh / 5dvh repeat, linear-gradient(to right, #121212, #092533);
                  margin: 0;
                  padding: 2rem;
                  overflow: auto;
                  height: 100%;
                  width: 100%;
                  box-sizing: border-box;
                  border-radius: 2rem 0 0;
                  clip-path: inset(0 round 0.5rem);
                ">${content.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>
              </body>
          </html>
        `);
        
        rawFileWindow.document.close(); // Complete the writing stream

        break;
      case "tabDeleteAll":
        editor.setValue("");
        break;
    }
};

function setupDragAndDrop(editor) {
  // Handle drag events and prevent default behavior
  const handleDrag = (e) => {
      e.preventDefault();

      // Highlight editor during dragenter/dragover, remove on dragleave
      if (['dragenter', 'dragover'].includes(e.type)) {
          editor.classList.add('drag-hover');
      } else if (['dragleave', 'drop'].includes(e.type)) {
          editor.classList.remove('drag-hover');
      }
  };

  // Attach only one listener for all drag events except 'drop'
  ['dragenter', 'dragover', 'dragleave'].forEach(eventName => {
      editor.addEventListener(eventName, handleDrag);
  });

  // Handle the 'drop' event for both class removal and file processing
  editor.addEventListener('drop', (e) => {
      handleDrag(e);

      const file = e.dataTransfer.files[0];
      const text = e.dataTransfer.getData('text/plain');

      if (file && (file.type === "text/css" || file.name.endsWith('.css'))) { // css file
          const reader = new FileReader();
          reader.onload = (event) => window.inputEditor.setValue(event.target.result);
          reader.readAsText(file);
      }
      else if (text) { // plain text
          const cursorPosition = window.inputEditor.getCursorPosition();
          window.inputEditor.insertText(cursorPosition, text);
      } else {
          alert("Only .css files or text are allowed!");
      }
  });
}