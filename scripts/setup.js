function initializeAceEditors() {
  window.setupEditors = async () => {
    if (typeof window.ace === 'undefined') {
      if (window._loadAce) await window._loadAce();
    }
    try {
      const CssMode = window.ace.require('ace/mode/css').Mode;
      CssMode.prototype.createWorker = function () { return null; };
    } catch (_) {}
  
    await window.waitForVar('cssSampleDefault');
    let sample = window.cssSampleDefault;
   
    await window.waitForVar('LanguageProvider');
    const languageProvider = window.LanguageProvider.fromCdn("https://www.unpkg.com/ace-linters@1.2.3/build/");
  
    window.inputEditorInstance = initEditor("inputEditor", window.i18n.inputEditorLabel, sample || window.i18n.inputPlaceholder);
    window.outputEditorInstance = initEditor("outputEditor", window.i18n.outputEditorLabel, window.i18n.outputPlaceholder);
    if (!(window.inputEditorInstance && window.outputEditorInstance)) return;

    const editorMql = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateEditorAnimatedScroll = () => {
      const shouldAnimate = !window.prefersReducedMotion;
      window.inputEditorInstance.setAnimatedScroll(shouldAnimate);
      window.outputEditorInstance.setAnimatedScroll(shouldAnimate);
    };
    editorMql.addEventListener('change', updateEditorAnimatedScroll);
    updateEditorAnimatedScroll();

    // Auto Nest
    let codeChanged = false;
    let isProcessing = false;
  
    window.inputEditorInstance.getSession().on('change', () => {
      console.log('[change] fired');
      if (window.appIsInitializing) {
        console.log('[change] SKIP: app is initializing');
        return;
      }

      const isUserAction = window.inputEditorInstance.isFocused() || window._userInitiatedEdit;
      window._userInitiatedEdit = false;
      console.log('[change] isUserAction:', isUserAction, '| isFocused:', window.inputEditorInstance.isFocused(), '| nesting:', window.mainElement.classList.contains('nesting'), '| processAuto:', window.processAuto);

      if (isUserAction && !window.mainElement.classList.contains('nesting')) {
        if (window.processAuto ?? true) {
          console.log('[change] Auto ON → calling nestCode(true)');
          window.nestCode(true);
        } else {
          console.log('[change] Auto OFF → switching to nesting mode only');
          window.switchToNestingMode();
          window.scrollWrapper.scrollTo({ top: 0, behavior: 'smooth' });
        }
      } else if (window.processAuto ?? true) {
        console.log('[change] setting codeChanged = true for changeAnnotation');
        codeChanged = true;
      } else {
        console.log('[change] no action taken');
      }
    });

    window.inputEditorInstance.getSession().on('changeAnnotation', () => {
      console.log('[changeAnnotation] fired, appIsInitializing:', window.appIsInitializing, '| processAuto:', window.processAuto, '| isProcessing:', isProcessing, '| codeChanged:', codeChanged);
      if ((!window.appIsInitializing) && (window.processAuto ?? true) && !isProcessing) {
        isProcessing = true;
        console.log('[changeAnnotation] entering processing block');
   
        setTimeout(() => {
          console.log('[changeAnnotation] timeout fired, codeChanged:', codeChanged);
          if (codeChanged) {
            console.log('[changeAnnotation] calling nestCode()');
            window.nestCode();
            codeChanged = false;
            console.log('[changeAnnotation] codeChanged reset to false');
          } else {
            console.log('[changeAnnotation] codeChanged is false, skipping nestCode()');
          }
   
          isProcessing = false;
        }, 0);
      } else {
        console.log('[changeAnnotation] skipped (guards not met)');
      }
    });
  
    /**
     * Initializes an Ace editor
     * 
     * @param {string} editorId The DOM ID of the element to turn into an editor.
     * @param {string} labelDescription The DOM ID of the <label> element for the editor.
     * @param {string} value The initial code/text to place in the editor.
     * @param {Promise[]} readyPromisesArray An array to push this editor's ready promise into.
     * @returns {ace.Editor} The configured Ace editor instance.
     */
    function initEditor(editorId, labelDescription, value, readyPromise = false) {
      if (!document.getElementById(editorId)) return;
  
      const editor = window.ace.edit(editorId, {
        mode: "ace/mode/css",
        theme: "ace/theme/nycss"
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
      
      editor.commands.addCommand({
        name: "indentWithCtrl",
        bindKey: { win: "Ctrl-]", mac: "Command-]" },
        exec: (editor) => editor.indent(),
      });
      
      editor.commands.addCommand({
        name: "outdentWithCtrl",
        bindKey: { win: "Ctrl-[", mac: "Command-[" },
        exec: (editor) => editor.blockOutdent(),
      });
    
      const textarea = editor.textInput.getElement();
      textarea.setAttribute("aria-label", labelDescription);
    
      editor.setValue(value, -1);
      editor.setAnimatedScroll(!window.prefersReducedMotion);

      let tabIndexSet = false;
      let lastGutterWidth = null;
      const scrollbars = editor.container.querySelectorAll('.ace_scrollbar');
      editor.renderer.on('afterRender', () => {
        if (scrollbars[0].getAttribute('tabindex') !== '-1') {
          if (scrollbars.length > 0) {
            scrollbars.forEach(sb => {
              sb.setAttribute('tabindex', '-1');
            });
            tabIndexSet = true;
          }
        }
      
        const gutter = editor.container.querySelector('.ace_gutter');
        const scrollbarH = editor.container.querySelector('.ace_scrollbar-h');
      
        if (gutter && scrollbarH) {
          const currentGutterWidth = gutter.style.width;
          
          if (currentGutterWidth !== lastGutterWidth) {
            scrollbarH.style.setProperty('--gutter-width', currentGutterWidth);
            lastGutterWidth = currentGutterWidth;
          }
        }
      });
  
      function getElementOffset(element) {
          const de = document.documentElement;
          const box = element.getBoundingClientRect();
          const top = box.top + window.scrollY - de.clientTop;
          const left = box.left + window.scrollX - de.clientLeft;
  
          return { top: top, left: left };
      }
  
      window.ace.require('ace/tooltip').Tooltip.prototype.setPosition = function (x, y) {
          y -= getElementOffset(this.$parentNode).top;
          x -= getElementOffset(this.$parentNode).left;
          this.getElement().style.position = "absolute";
          this.getElement().style.left = x + "px";
          this.getElement().style.top = y + "px";
      };
  
      editor.session.selection.on('changeCursor', () => window.updateCoordinateDisplay(editor));
    
      languageProvider.registerEditor(editor);
      return editor;
    }
  
    // (The rest of your function remains unchanged)
    // ...
    let inputEditorElem = window.inputEditorInstance.container;
    let outputEditorElem = inputEditorElem.parentElement.lastElementChild;
  
    const shadowCount = 3;
  
    function createButton(idSuffix, className, isShadowEditor, accessibleLabel) {
      const button = document.createElement("button");
      button.id = idSuffix;
      button.classList.add(className);
      if (isShadowEditor) button.setAttribute('aria-hidden', 'true');
      else {
        button.setAttribute('aria-label', accessibleLabel);
        button.addEventListener("click", window.tabButtonHandler);
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
      tabButtons.setAttribute('aria-label', window.i18n.editorControls.replace('{name}', editorName));
      tabButtons.setAttribute('aria-orientation', 'horizontal');

      tabButtons.appendChild(createButton(`${editorName}TabCopyAll`, 'tabCopyAll', isShadowEditor, window.i18n.copyAll));
  
      if (isInputEditor) {
        if (!isShadowEditor) {
          let fileReader = new FileReader();
          let fileInput = document.createElement("input");
          fileInput.type = "file";
          fileInput.accept = ".css";
  
          fileInput.addEventListener("change", (event) => {
            if (file = event.target.files[0]) {
              fileReader.onload = (e) => {
                console.log('[fileInput] setting _userInitiatedEdit = true');
                window._userInitiatedEdit = true;
                window.inputEditorInstance.setValue(e.target.result);
              };
              fileReader.readAsText(file);
            };
          });
  
          window.setupDragAndDrop(editor);
          
          window.insertCSSFileInput = fileInput;
        }
        
        const insertBtn = createButton(`${editorName}TabInsertCSS`, 'tabInsertCSS', isShadowEditor, window.i18n.insertCSSFile);
        insertBtn.setAttribute('aria-controls', 'inputEditor');
        tabButtons.appendChild(insertBtn);
      } else {
        tabButtons.appendChild(createButton(`${editorName}TabOpenRaw`, 'tabOpenRaw', isShadowEditor, window.i18n.openRawOutput));
      }

      tabButtons.appendChild(createButton(`${editorName}TabDeleteAll`, 'tabDeleteAll', isShadowEditor, window.i18n.deleteAll));
  
      editorTab.appendChild(fileName);
      editorTab.appendChild(tabButtons);
  
      return editorTab;
    }
  
    function wrapEditorWithGroup(editor, editorTab) {
      const wrapperElement = document.createElement("div");
      wrapperElement.id = `${editor.id}Wrapper`;
      wrapperElement.classList.add('editorWrapper');
  
      const fileNameDiv = editorTab.querySelector('.fileName');
      if (fileNameDiv) {
        const labelId = `${editor.id}-label`;
        fileNameDiv.id = labelId;
        wrapperElement.setAttribute('role', 'region');
        wrapperElement.setAttribute('aria-labelledby', labelId);
      }
  
      const editorGroup = document.createElement("div");
      editorGroup.classList.add('editorGroup');
  
      editor.replaceWith(wrapperElement);
      editor.classList.add('editor');
  
      editorGroup.appendChild(editorTab);
      editorGroup.appendChild(editor);
      wrapperElement.appendChild(editorGroup);
    }
    [inputEditorElem, outputEditorElem].forEach((editor) => {
      const editorTab = createEditorTab(editor, editor === inputEditorElem, false);
      wrapEditorWithGroup(editor, editorTab);
      window.updateCoordinateDisplay(window.ace.edit(editor));
    });

    [window.inputEditorInstance, window.outputEditorInstance].forEach(ed => {
      if (ed) setupMinimap(ed);
    });

    function setupMinimap(editor) {
      const container = editor.container;
      container.style.position = 'relative';

      const minimapEl = document.createElement('div');
      minimapEl.id = editor.container.id + 'Minimap';
      minimapEl.className = 'ace-minimap';
      if (!window.__store.showMinimap) minimapEl.style.display = 'none';
      container.appendChild(minimapEl);

      const minimap = window.ace.edit(minimapEl);
      minimap.session.setMode('ace/mode/css');
      minimap.setFontSize(2.5);
      minimap.setShowPrintMargin(false);
      minimap.renderer.setShowGutter(false);
      minimap.renderer.setOption('showLineNumbers', false);
      minimap.setReadOnly(true);
      minimap.setTheme('ace/theme/nycss');

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
  
    const shadowWrapperElement = document.createElement("div");
    shadowWrapperElement.id = "shadowEditorsWrapper";
    shadowWrapperElement.inert = true;
    shadowWrapperElement.ariaHidden = true;
    inputEditorElem.parentElement.after(shadowWrapperElement);
  
    const shadowEditors = Array.from({ length: shadowCount }, () => {
      const shadowEditorGroup = document.createElement("div");
      shadowEditorGroup.classList.add('editorGroup');
  
      const shadowEditorTab = createEditorTab(inputEditorElem, true, true);
      shadowEditorGroup.appendChild(shadowEditorTab);
  
      const shadowEditor = document.createElement("div");
      shadowEditor.className = `${inputEditorElem.className} shadowEditor`;
      shadowEditor.innerHTML = inputEditorElem.innerHTML;
      shadowEditorGroup.appendChild(shadowEditor);
  
      shadowWrapperElement.appendChild(shadowEditorGroup);
      return shadowEditor;
    });
  
    function styleShadowEditors() {
      // Ensure the elements (including shadow editors are visible / not in mobile view) are available before proceeding
      if (!window.mainContent || !window.codeEditorElem || !inputEditorElem || window.matchMedia('(max-aspect-ratio: 1.097 / 1)').matches) return;

      const remInPixels = parseFloat(getComputedStyle(document.documentElement).fontSize);
      const totalAvailableSpace = window.mainContent.offsetWidth - window.codeEditorElem.offsetWidth - (2 * remInPixels);
      const convertPxToRem = (px) => px / remInPixels;
      
      const shadowHeightDiff = inputEditorElem.offsetHeight / 10;
      const baseShadowOpacity = 0.5;
      const baseShadowBlur = 2;
      const maxWidth = Math.min(inputEditorElem.offsetWidth * 2, totalAvailableSpace);
      
      let baseShadowWidth = inputEditorElem.offsetWidth / 3;
      let shadowWidthDiff = baseShadowWidth / 15;
      let previousShadowTranslation = 0;
  
      if (((32 / 15) * baseShadowWidth) > maxWidth) {
        baseShadowWidth = maxWidth * (5/12);
        shadowWidthDiff = baseShadowWidth / 15;
      }
  
      shadowEditors.forEach((shadowEditor, index) => {
        // Only wrap if you haven't wrapped already
        const shadowEditorWrapper = shadowEditor.closest('.shadowEditorWrapper') || document.createElement("div");
        if (!shadowEditorWrapper.classList.contains('shadowEditorWrapper')) {
            shadowEditorWrapper.classList.add("shadowEditorWrapper", "editorWrapper");
            shadowEditor.parentElement.replaceWith(shadowEditorWrapper);
            shadowEditorWrapper.appendChild(shadowEditor.parentElement);
        }
  
        let scaleValue = ((inputEditorElem.offsetHeight * 0.8) - (shadowHeightDiff * (index + 1))) / inputEditorElem.offsetHeight;
        shadowEditor.parentElement.style.transform = `scale(${scaleValue})`;
  
        let shadowWidth = baseShadowWidth - ((shadowWidthDiff * 2.5) * (index + 1));
        shadowEditorWrapper.style.width = `${convertPxToRem(shadowWidth)}rem`;
        
        previousShadowTranslation += shadowWidth + (2 * shadowWidthDiff);
        shadowEditorWrapper.style.translate = `-${convertPxToRem(previousShadowTranslation)}rem`;
  
        shadowEditorWrapper.style.opacity = baseShadowOpacity - index / 10;
        shadowEditor.parentElement.style.filter = `blur(${Math.pow(baseShadowBlur, index + 1) / 16}rem)`;
        shadowEditorWrapper.style.backgroundColor = `rgb(from white r g b / ${(2 - index)}%)`;
      });
    }
  
    // Recalculate shadow editor styles on window resize/zoom
    window.addEventListener('resize', window.debounce(styleShadowEditors, 250));

    styleShadowEditors();

  
    let isContentObserverPaused = false;
    const shadowEditorsWrapper = shadowEditors[0].closest('#shadowEditorsWrapper');
  
    const contentObserver = new MutationObserver(() => {
      if (isContentObserverPaused) return;
  
      requestAnimationFrame(() => {
        shadowEditors.forEach((shadowEditor) => {
          shadowEditor.innerHTML = inputEditorElem.innerHTML;
        });
  
        const isHidden = window.mainElement.classList.contains('nesting') && parseInt(window.getComputedStyle(shadowEditorsWrapper.parentElement.parentElement).opacity) == 0;
  
        if (isHidden) {
          contentObserver.disconnect();
          isContentObserverPaused = true;
        }
      });
    });
  
    const visibilityObserver = new MutationObserver(() => {
      if (!isContentObserverPaused) return;
      const isVisible = !window.mainElement.classList.contains('nesting') || parseInt(window.getComputedStyle(shadowEditorsWrapper.parentElement.parentElement).opacity) > 0;
  
      if (isVisible) {
        contentObserver.observe(inputEditorElem, {
          childList: true,
          subtree: true,
          characterData: true
        });
        isContentObserverPaused = false;
      }
    });
  
    contentObserver.observe(inputEditorElem, {
      childList: true,
      subtree: true,
      characterData: true
    });
  
    visibilityObserver.observe(window.mainElement, {
      attributes: true,
      attributeFilter: ['class']
    });
  };
  
  const editorSide = document.getElementById('editorSide');
  if (editorSide && typeof IntersectionObserver !== 'undefined') {
    let aceInitialized = false;
    const initAce = () => {
      if (aceInitialized) return;
      aceInitialized = true;
      observer?.disconnect();
      window.setupEditors();
    };
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) initAce();
    }, { threshold: 0 });
    observer.observe(editorSide);
    setTimeout(initAce, 1500);
  } else {
    window.setupEditors();
  }
  
  /**
   * Splits the text content of elements into individual <span>s for animation.
   * It makes the result accessible by setting an aria-label on the parent
   * and hiding the individual letter spans from screen readers.
   *
   * @param {HTMLElement} element - The CSS selector for the target elements.
   */
  window.splitTextForAnimation = (element) => {
      const originalText = element.textContent.trim();
      element.setAttribute('aria-label', originalText);
      element.innerHTML = '';
      
      originalText.split('').forEach((char, index) => {
        const span = document.createElement('span');
        span.setAttribute('aria-hidden', 'true');
        span.textContent = (char === ' ') ? '\u00A0' : char; // Use non-breaking space
        element.appendChild(span);
      });
  };
  
  window.toggleBtn.addEventListener('click', () => {
    if (typeof window.nestCode === 'undefined') return;

    window.nestCode(true);
  });
  
  window.updateCoordinateDisplay = (editor) => {
    let { row, column } = editor.getCursorPosition();
  
    let cursorText = "";
    if (window.coordDisplayMode == null) window.coordDisplayMode = 3;
    if (window.coordDisplayMode === 0) {
      cursorText = "";
    } else if (window.coordDisplayMode === 1) {
      cursorText = ` | Ln ${++row}`;
    } else if (window.coordDisplayMode === 2) {
      cursorText = ` | Col ${column}`;
    } else {
      cursorText = ` | Ln ${++row}, Col ${column}`;
    }
  
    const fileNameEl = editor.container.previousElementSibling.firstElementChild;
    fileNameEl.setAttribute('caret-pos', cursorText);
    
    const baseName = fileNameEl.textContent;
    const fsText = fileNameEl.getAttribute('file-size') || '';
    fileNameEl.setAttribute('aria-label', baseName + cursorText + fsText);
  };
  
  /**
   * Checks if an element is visible and part of the DOM.
   * @param {HTMLElement} el The element to check.
   * @returns {boolean}
   */
  window.isElementVisible = (el) => {
    // A basic check for elements hidden with `display: none` or `visibility: hidden`.
    // It also checks if the element or its parent is collapsed.
    return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  };
  
  /**
   * Checks if a single element is focusable according to a robust set of rules.
   * @param {HTMLElement} el The element to check.
   * @returns {boolean}
   */
  window.isElementFocusable = (el) => {
    // Step 1: The element must not be disabled, inert, or have a negative tabindex.
    // Using `el.inert` is the modern and correct way to check for the inert state.
    if (el.disabled || el.closest('[inert]') || el.tabIndex < 0) {
      return false;
    }
  
    // Step 2: The element must be visible.
    // Assumes a robust `isElementVisible` function is available that checks for
    // `display: none`, `visibility: hidden`, and disconnected elements.
    if (!window.isElementVisible(el)) {
      return false;
    }
  
    const nodeName = el.nodeName.toLowerCase();
  
    // Step 3: Handle natively focusable elements and specific attribute-based rules.
    // This is the most common path for interactive elements.
    switch (nodeName) {
      case 'a':
      case 'area':
        // Anchors and areas are focusable if they have an `href`.
        return el.hasAttribute('href');
      
      case 'input':
        // Special handling for radio button groups: only one can be focusable.
        if (el.type === 'radio' && el.name) {
          const group = el.ownerDocument.querySelectorAll(`input[type="radio"][name="${el.name}"]`);
          const checked = Array.from(group).find(r => r.checked);
          // The focusable radio is the one that's checked, or the first one if none are.
          return checked ? el === checked : el === group[0];
        }
        // All other input types are focusable by default.
        return true;
  
      case 'select':
      case 'textarea':
      case 'button':
      case 'iframe':
        // These elements are always focusable by default.
        return true;
  
      case 'audio':
      case 'video':
        // Media elements are focusable only if they have the `controls` attribute.
        return el.hasAttribute('controls');
    }
  
    // Step 4: Handle contenteditable elements.
    // `el.isContentEditable` correctly reflects the computed (inherited) state.
    if (el.isContentEditable) {
      return true;
    }
    
    // Step 5: Final fallback. Any other element is focusable only if it has a `tabindex`.
    // This correctly handles `<div tabindex="0">` and also the `<summary>` element,
    // which is given a default `tabIndex` of 0 by the browser.
    return el.tabIndex >= 0;
  };
  
  /**
   * Finds all focusable elements within a given root, including inside Shadow DOMs,
   * and sorts them according to the browser's tabbing order.
   * @param {HTMLElement | ShadowRoot} root The element or shadow root to search within.
   * @returns {HTMLElement[]} A sorted array of focusable elements.
   */
  window.getAllFocusableElements = (root = document.body) => {
    const focusableCandidates = [];
    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_ELEMENT,
      { acceptNode: () => NodeFilter.FILTER_ACCEPT },
      false
    );
  
    let node = walker.firstChild();
    while (node) {
      // Search inside shadow roots recursively
      if (node.shadowRoot) {
        focusableCandidates.push(...window.getAllFocusableElements(node.shadowRoot));
      }
      focusableCandidates.push(node);
      node = walker.nextNode();
    }
  
    // Filter the candidates using our robust checker
    const focusableElements = focusableCandidates.filter(window.isElementFocusable);
    
    // Sort the elements to respect `tabindex`
    return focusableElements.sort((a, b) => {
      const tabIndexA = a.tabIndex || 0;
      const tabIndexB = b.tabIndex || 0;
  
      if (tabIndexA === tabIndexB) {
        // When tabindexes are equal, sort by document position.
        // `compareDocumentPosition` is a bitmask, so we check for the FOLLOWING bit.
        return (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) ? -1 : 1;
      }
      
      // Elements with a positive tabindex come before elements with tabindex="0"
      if (tabIndexA > 0 && tabIndexB <= 0) return -1;
      if (tabIndexA <= 0 && tabIndexB > 0) return 1;
  
      // Sort by tabindex value
      return tabIndexA - tabIndexB;
    });
  };
  
  /**
   * Moves focus to the previous focusable element on the page.
   */
  window.focusPreviousElement = () => {
    const allFocusable = window.getAllFocusableElements();
    if (allFocusable.length === 0) return;
  
    const currentElement = document.activeElement.shadowRoot 
      ? document.activeElement.shadowRoot.activeElement 
      : document.activeElement;
  
    const currentIndex = allFocusable.indexOf(currentElement);
    
    const previousIndex = (currentIndex - 1 + allFocusable.length) % allFocusable.length;
    
    allFocusable[previousIndex].focus();
  };
  
  /**
   * Moves focus to the next focusable element on the page.
   */
  window.focusNextElement = () => {
    const allFocusable = window.getAllFocusableElements();
    if (allFocusable.length === 0) return;
  
    const currentElement = document.activeElement.shadowRoot 
      ? document.activeElement.shadowRoot.activeElement 
      : document.activeElement;
  
    const currentIndex = allFocusable.indexOf(currentElement);
    
    const nextIndex = (currentIndex + 1) % allFocusable.length;
    
    allFocusable[nextIndex].focus();
  };
};

window.initializeAceEditors = initializeAceEditors;
