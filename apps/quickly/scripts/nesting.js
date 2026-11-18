{
  const editorSide = document.getElementById('code-editor');
  if (editorSide && typeof IntersectionObserver !== 'undefined') {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        if (typeof window.preloadEngine === 'function') window.preloadEngine();
        observer.disconnect();
      }
    }, { rootMargin: '200px' });
    observer.observe(editorSide);
  }
}

async function nestCode(e) {
    if (typeof window.preloadEngine === 'function') await window.preloadEngine();
    if (e && e.currentTarget && e.currentTarget.disabled) return;

    const wrapper = document.getElementById('code-editor-wrapper');
    if (wrapper) wrapper.setAttribute('aria-busy', 'true');

    // Match the main app: do not convert input that the Ace linter rejects.
    const annotations = inputEditor.getSession().getAnnotations().filter((a) => a.type == 'error');
    if (annotations.length) {
        outputEditor.getSession().setValue(i18n.cssContainsErrors);
        announce(i18n.cssContainsErrors);
        if (wrapper) wrapper.removeAttribute('aria-busy');
        return false;
    }

    let result = '';
    try {
        result = convertToNestedCSS(inputEditor.getValue());
    } catch (error) {
        console.error('CSS conversion failed:', error);
    }

    if (result) {
        outputEditor.getSession().setValue(result);
        announce(i18n.conversionComplete);
        if (wrapper) wrapper.removeAttribute('aria-busy');
        return true;
    }

    outputEditor.getSession().setValue(i18n.cssContainsErrors);
    announce(i18n.cssContainsErrors);
    if (wrapper) wrapper.removeAttribute('aria-busy');
    return false;
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