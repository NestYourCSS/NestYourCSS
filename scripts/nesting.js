/**  
 * Updates the error table based on Ace Editor annotations.  
 * This function is accessible to screen reader and keyboard users.  
 *  
 * @param {Array} annotations The array of error objects from Ace.  
 * @param {HTMLTableSectionElement} tableBodyElem The <tbody> element of the error table.  
 * @param {ace.Editor} inputEditorInstance The editor to navigate on click/enter.  
 * @param {ace.Editor} outputEditorInstance The editor to display a generic message in.  
 */  
function updateAccessibleErrorTable(annotations, tableBodyElem, inputEditorInstance, outputEditorInstance) {  
    // 1. Clear the previous contents of the table body.  
    tableBodyElem.innerHTML = '';  
    
    if (annotations.length === 0) {  
      // --- POSITIVE FEEDBACK: Announce that errors are gone ---  
      outputEditorInstance.getSession().setValue(window.i18n.cssIsValid);  
     
      // Create a single, reassuring row for screen reader users.  
      const successRow = tableBodyElem.insertRow();  
      const successCell = successRow.insertCell();  
      successCell.textContent = window.i18n.noErrorsFound;  
      successCell.colSpan = 3; // Span across all columns.  
        
      // No need to scroll into view if there are no errors.  
      return;  
    }  
    
    // --- NEGATIVE FEEDBACK: Announce errors exist and populate the table ---  
    outputEditorInstance.getSession().setValue(window.i18n.cssContainsErrors);  
    
    // 2. Loop through annotations and create an ACCESSIBLE row for each.  
    annotations.forEach(({ column, row, text }) => {  
      const errorRow = tableBodyElem.insertRow();  
        
      // 3. MAKE IT KEYBOARD ACCESSIBLE:  
      // Allow the row to be focused and make it act like a button.  
      errorRow.tabIndex = 0;  
      errorRow.role = 'button'; // Explicitly define it as a button for screen readers.  
    
      const handleGoToLine = () => inputEditorInstance.gotoLine(row, column - 1, true);  
    
      errorRow.onclick = handleGoToLine;  
      errorRow.onkeydown = (event) => {  
        // Trigger the action on Enter or Space, just like a real button.  
        if (event.key === 'Enter' || event.key === ' ') {  
          event.preventDefault(); // Prevent space from scrolling the page  
          handleGoToLine();  
        }  
      };  
        
      // 4. MAKE IT SEMANTIC: Use <th> for the error message (the row header).  
      const headerCell = document.createElement('th');  
      headerCell.scope = 'row';  
      headerCell.textContent = text;  
      errorRow.appendChild(headerCell);  
    
      // Use <td> for the other data cells.  
      const rowCell = errorRow.insertCell();  
      rowCell.textContent = row;  
    
      const colCell = errorRow.insertCell();  
      colCell.textContent = column;  
    });  
    
    // 5. Scroll the error section into view for sighted users.  
    tableBodyElem.closest('section').scrollIntoView({  
      behavior: 'smooth',  
      block: 'nearest',  
      inline: 'nearest'  
    });  
};  
    
function nestCode(onClick = false) {  
    console.log('[nestCode] called, onClick:', onClick, '| window.isNesting:', window.isNesting, '| nestBtn disabled:', nestBtn?.disabled);

    if (onClick) {
        if (nestBtn?.hasAttribute('disabled')) {
          console.log('[nestCode] onClick EARLY RETURN: nestBtn is disabled');
          return;
        }
        console.log('[nestCode] onClick block: disabling buttons, toggling nesting class');
        if (nestBtn) nestBtn.disabled = true;
        if (typeof toggleBtn !== 'undefined' && toggleBtn) {
            toggleBtn.style.pointerEvents = 'none';
        }

        mainElement.classList.toggle('nesting', !window.isNesting);
        console.log('[nestCode] nesting class toggled, is now:', mainElement.classList.contains('nesting'), '| window.isNesting still:', window.isNesting);
        if (window.isNesting) {
          console.log('[nestCode] EARLY RETURN: was already nesting');
          return;
        }
        scrollWrapper.scrollTo({ top: 0, behavior: 'smooth' });  
    }  
   
    if (typeof window.outputEditorInstance === 'undefined' || !window.inputEditorInstance) {
      console.log('[nestCode] EARLY RETURN: editors not ready');
      return;
    }

    console.log('[nestCode] processing CSS...');
    if (typeof window.announce === 'function') window.announce(window.i18n.process);
    const wrapper = document.getElementById('codeEditor') || document.getElementById('siteWrapper');
    if (wrapper) wrapper.setAttribute('aria-busy', 'true');
    
    let tableBodyElem = errorTable.tBodies[0];  
	const annotations = window.inputEditorInstance.getSession().getAnnotations().filter((a) => a.type == 'error');  
	if (annotations.length == 0) {  
	    console.log('[nestCode] no errors, converting to nested CSS');
		window.outputEditorInstance.getSession().setValue(convertToNestedCSS(window.inputEditorInstance.getValue()) || window.i18n.outputPlaceholder);  
        
        if (tableBodyElem.rows.length) tableBodyElem.innerHTML = '';  
        if (typeof window.announce === 'function') window.announce(window.i18n.conversionComplete);
        console.log('[nestCode] conversion complete');
	} else {  
	    console.log('[nestCode] errors found, updating error table');
		window.outputEditorInstance.getSession().setValue(window.i18n.cssContainsErrors);  
		  
        updateAccessibleErrorTable(  
          annotations,  
          tableBodyElem,  
          window.inputEditorInstance,  
          window.outputEditorInstance  
        );  
        if (typeof window.announce === 'function') window.announce(window.i18n.cssContainsErrors);
	}  
    if (wrapper) wrapper.removeAttribute('aria-busy');
    console.log('[nestCode] done');
};
  
function convertToNestedCSS(cssProvided, htmlString) {  
	window.processMode ??= 3; // 0: Minify, 1: Beautify, 2: Denest, 3: Nest  
	window.preserveComments ??= true;  

    cssProvided = parseCSS(cssProvided);  
    if (window.processMode == 0) return minifyCSS(cssProvided);  
    if (window.processMode == 1) return beautifyCSS(cssProvided);  
    if (window.processMode == 2) cssProvided = denestCSS(cssProvided);  
    if (window.processMode == 3) cssProvided = renestCSS(cssProvided);  
    return beautifyCSS(cssProvided);  
};
  
document.addEventListener('DOMContentLoaded', () => {  
    const settingsToggle = document.getElementById('settingsBtn');  
    const mainSettings = document.getElementById('mainSettings');  
    const mainElement = document.querySelector('main');  

    if (!settingsToggle || !mainSettings) return;  

    function openSettingsPanel() {
        mainSettings.classList.add('mobile-open');  
        mainSettings.removeAttribute('inert');
        const focusable = mainSettings.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"]), nycss-dropdown output, nycss-combobox output, nycss-toggle, nycss-stepper, nycss-radio-group label');
        if (focusable.length) focusable[0].focus();
    }

    function closeSettingsPanel() {
        mainSettings.classList.remove('mobile-open');  
        if (mainElement && !mainElement.classList.contains('nesting')) {  
            mainSettings.setAttribute('inert', '');
        }
        settingsToggle.focus();
    }

    settingsToggle.addEventListener('click', (e) => {  
        e.stopPropagation();  
        if (mainSettings.classList.contains('mobile-open')) {
            closeSettingsPanel();
        } else {
            openSettingsPanel();
        }
    });  

    document.addEventListener('click', (e) => {  
        if (mainSettings.classList.contains('mobile-open') &&   
            !mainSettings.contains(e.target) &&   
            !settingsToggle.contains(e.target)) {  
            closeSettingsPanel();
        }  
    });  

    document.addEventListener('keydown', (e) => {  
        if (e.key === 'Escape' && mainSettings.classList.contains('mobile-open')) {  
            closeSettingsPanel();
        }  
    });  
});

