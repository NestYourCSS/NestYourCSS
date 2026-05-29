const mainContentBackgroundString = (horizValue) => `
url("https://ucarecdn.com/380d4e4c-268c-4913-8c92-e049c44234ec/-/preview/189x189/") 0 0.1dvh / 5dvh repeat,
linear-gradient(to right, rgb(from var(--shades-black) r g b / var(--opacity-medium)), rgb(from var(--pri-colour-em-darker) r g b / var(--opacity-medium))) 0 0 / 100dvw 100dvh,
linear-gradient(45deg, transparent, rgb(from var(--pri-colour-m-darker) r g b / var(--opacity-medium)) ${horizValue}, transparent) 0 0 / 100dvw 100dvh,
var(--shades-black)
`;

document.body.addEventListener('pointermove', (e) => {
  if (typeof splashTextElem === 'undefined' || splashTextElem === null || !mainElement) return;

  const prefersReducedMotion = window.prefersReducedMotion;

  window.cursorX = e.clientX;
  window.cursorY = e.clientY;
  
  requestAnimationFrame(() => {
    // 1. Handle the background motion
    if (prefersReducedMotion) {
      // Set a static "safe" value (e.g., 50%) so it doesn't move
      mainContent.style.background = mainContentBackgroundString("50%");
    } else {
      const horizValue = roundNumber((e.clientX / document.body.clientWidth) * 100) + '%';
      if (window.isNesting || scrollWrapper.scrollTop < mainElement.offsetHeight)
        mainContent.style.background = mainContentBackgroundString(horizValue);
    }

    // 2. Handle nested nav buttons (Safe-ish, but good to check)
    if (window.isNesting && !prefersReducedMotion) {
      // Offset is needed since containing box has been changed from root to mainSettings (or some other element)
      const [ offsetX, offsetY ] = [(mainSettings.scrollLeft - mainSettings.lastElementChild.clientHeight / 2), (mainSettings.scrollTop - (mainSettings.lastElementChild.clientHeight / 2))];

      const nestedNavButtons = mainSettings.lastElementChild;
      nestedNavButtons.style.setProperty('--cursor-x-pos', (e.clientX + offsetX) + 'px');
      nestedNavButtons.style.setProperty('--cursor-y-pos', (e.clientY + offsetY) + 'px');
    }
    else {
      if (e.target === splashTextElem) attemptSplashTextUpdate();
      
      const scrollTop = scrollWrapper.scrollTop;
      const editorTop = editorSection.offsetTop;
      const editorHeight = editorSection.offsetHeight;
      
      const isEditorTopScrolledPassed = scrollTop > editorTop;
      const isEditorBottomNotScrolledPassed = (editorTop + editorHeight + window.innerHeight) > scrollTop;

      const isEditorInView = isEditorTopScrolledPassed && isEditorBottomNotScrolledPassed;
      if (isEditorInView) updateActiveLine(e.clientX, e.clientY);
    }
  });
});

document.addEventListener('visibilitychange', () => document.body.hidden = document.hidden);

const elements = [
  '#mainSettings > nav > a > figure.inner-cursor',
  '#repeatingText span.repeat',
  '#changingText s',
  '#groupedText',
  '#nycssCursor',
  '#splittingText'
];
const intersectionObserver = new IntersectionObserver((entries) => {
  const reduce = window.prefersReducedMotion;
  entries.forEach(entry => {
    if (entry.target.id === 'nycssCursor' && reduce) return;
    entry.target.hidden = !entry.isIntersecting;
  });
}, { threshold: 0.01 });
elements.flatMap(s => [...document.querySelectorAll(s)]).filter(Boolean).forEach(el => intersectionObserver.observe(el));

scrollWrapper.addEventListener('scroll', (e) => requestAnimationFrame(() => (typeof updateLogoState !== 'undefined' && updateLogoState())));

function announce(message) {
    const liveRegion = document.getElementById('a11y-live-region');
    if (liveRegion) {
        liveRegion.textContent = '';
        requestAnimationFrame(() => { liveRegion.textContent = message; });
    }
}

window.tabButtonHandler = (e) => {
  let tabButton = e.currentTarget;
  let editor = (tabButton.closest('.editorWrapper')?.id.startsWith("input")) ? inputEditorInstance : outputEditorInstance;

  switch (tabButton.className) {
    case "tabCopyAll":
      let copiedText = editor.getValue(); 
      navigator.clipboard.writeText(copiedText);
      announce(i18n.copiedToClipboard);
      break;
    case "tabInsertCSS":
      window.insertCSSFileInput.click();
      break;
    case "tabOpenRaw":
      announce(i18n.openingNewWindow);

      let content = editor.getValue();

      let rawFileWindow = window.open("", "_blank", "noopener,noreferrer");
      rawFileWindow.document.write(`
        <html style="color-scheme: dark;">
            <body style="
              margin: 0;
              padding: 2rem;
              font-family: monospace;
              background: linear-gradient(to right, #12121280, #09253380), black;
            ">

              <pre style="
              background: url("https://ucarecdn.com/380d4e4c-268c-4913-8c92-e049c44234ec/-/preview/189x189/") 0 0.1dvh / 5dvh repeat, linear-gradient(to right, #121212, #092533);
                margin: 0;
                padding: 2rem;
                overflow: auto;
                height: 100%;
                width: 100%;
                box-sizing: border-box;
                border-radius: 2rem 0 0;
                clip-path: inset(0 round 0.5rem);
              ">${content.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>

              <script>
                document.addEventListener('copy', function(e) {
                  const text_only = document.getSelection().toString();
                  const clipdata = e.clipboardData || window.clipboardData;  
                  clipdata.setData('text/plain', text_only);
                  clipdata.setData('text/html', text_only);
                  e.preventDefault();
                });
              </script>
            </body>
        </html>
      `);
      
      rawFileWindow.document.close(); // Complete the writing stream

      break;
    case "tabDeleteAll":
      if (confirm(i18n.confirmDeleteAll)) {
        editor.setValue("");
        announce(i18n.contentDeleted);
      }
      break;
  }
};

window.setupDragAndDrop = (editor) => {
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

      if (file && (file.type === "text/css" || file.name.endsWith('.css'))) { // css file
          const reader = new FileReader();
          reader.onload = (event) => {
            inputEditorInstance.setValue(event.target.result);
            announce(i18n.fileImported + ": " + file.name);
          };
          reader.readAsText(file);
      }
      else if (e.dataTransfer.getData('text/plain')) {
        announce(i18n.textInsertedDragDrop);
      }
      else {
          announce(i18n.onlyCSSFilesAllowed);
      }
  });
};

window.addEventListener('load', () => {
  setTimeout(() => {
    const deferredScripts = [
      initializeAceEditors,
      initializeMiniEditor,
      initializeSplashTextAnimator,
      initializeFallingBadgeManager,
      initializeSmoothCursor,
      initializeSmoothScrollAndNestingController,
      initializeDebuggingTools
    ];
    deferredScripts.forEach((dScript) => dScript());

    document.querySelectorAll('#strechingText, #visibleText u b').forEach(element => {
      splitTextForAnimation(element);
    });
  }, 100);
});