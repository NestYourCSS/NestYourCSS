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
      outputEditorInstance.getSession().setValue('/* CSS is valid! */');  
        
      // Create a single, reassuring row for screen reader users.  
      const successRow = tableBodyElem.insertRow();  
      const successCell = successRow.insertCell();  
      successCell.textContent = "No errors found.";  
      successCell.colSpan = 3; // Span across all columns.  
        
      // No need to scroll into view if there are no errors.  
      return;  
    }  
    
    // --- NEGATIVE FEEDBACK: Announce errors exist and populate the table ---  
    outputEditorInstance.getSession().setValue('/* Your input CSS contains errors. See table below. */');  
    
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
    if (nestBtn.hasAttribute('disabled')) return;  
  
    mainElement.classList.toggle('nesting', !(onClick && window.isNesting));  
  
    if (onClick) {  
        if (window.isNesting) return;  
        else scrollWrapper.scrollTo({ top: 0, behavior: 'smooth' });  
    }  
  
    if (typeof outputEditorInstance === 'undefined' || !inputEditorInstance) return;  
  
    let tableBodyElem = errorTable.tBodies[0];  
	const annotations = inputEditorInstance.getSession().getAnnotations().filter((a) => a.type == 'error');  
	if (annotations.length == 0) {  
		outputEditorInstance.getSession().setValue(convertToNestedCSS(inputEditorInstance.getValue()) || '/* Your output CSS will appear here */');  
          
        if (tableBodyElem.rows.length) tableBodyElem.innerHTML = '';  
	} else {  
		outputEditorInstance.getSession().setValue('/* Your input CSS contains errors */');  
		console.log('Code Errors:', annotations);  
		  
        updateAccessibleErrorTable(  
          annotations,  
          tableBodyElem,  
          inputEditorInstance,  
          outputEditorInstance  
        );  
	}  
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
  
    settingsToggle.addEventListener('click', (e) => {  
        e.stopPropagation();  
        const isOpen = mainSettings.classList.toggle('mobile-open');  
        if (isOpen) {  
            mainSettings.removeAttribute('inert');  
        } else {  
            if (mainElement && !mainElement.classList.contains('nesting')) {  
                mainSettings.setAttribute('inert', '');  
            }  
        }  
    });  
  
    document.addEventListener('click', (e) => {  
        if (mainSettings.classList.contains('mobile-open') &&   
            !mainSettings.contains(e.target) &&   
            !settingsToggle.contains(e.target)) {  
            mainSettings.classList.remove('mobile-open');  
            if (mainElement && !mainElement.classList.contains('nesting')) {  
                mainSettings.setAttribute('inert', '');  
            }  
        }  
    });  
  
    document.addEventListener('keydown', (e) => {  
        if (e.key === 'Escape' && mainSettings.classList.contains('mobile-open')) {  
            mainSettings.classList.remove('mobile-open');  
            if (mainElement && !mainElement.classList.contains('nesting')) {  
                mainSettings.setAttribute('inert', '');  
            }  
        }  
    });  
});  