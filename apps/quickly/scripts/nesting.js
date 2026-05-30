function nestCode(e) {
    if (e && e.currentTarget && e.currentTarget.disabled) return;

    const wrapper = document.getElementById('code-editor-wrapper');
    if (wrapper) wrapper.setAttribute('aria-busy', 'true');

    const annotations = inputEditor.getSession().getAnnotations().filter((a) => a.type == 'error');
    if (annotations.length == 0) {
        const result = convertToNestedCSS(inputEditor.getValue());
        outputEditor.getSession().setValue(result || i18n.outputPlaceholder);
        announce(i18n.conversionComplete);
        if (wrapper) wrapper.removeAttribute('aria-busy');
        return true;
    } else {
        console.log('Code Errors:', annotations);
        outputEditor.getSession().setValue(i18n.cssContainsErrors);
        announce(i18n.cssContainsErrors);
        if (wrapper) wrapper.removeAttribute('aria-busy');
        return false;

        // Show a list of the errors if any.

        // "Your code doesn't seem to be valid, do you want to try nesting anyways?"
        // "It may not work properly."
    }
};

document.getElementById('nest-btn').addEventListener('click', nestCode);

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