/**
 * Shared Ace Linters provider for the main and quickly apps.
 *
 * The client and the CSS language service are self-hosted in this directory
 * (ace-linters 2.2.2) so neither app depends on a CDN. Only the CSS service is
 * registered; that keeps the worker payload (and its startup time) small.
 */
(function () {
  var BASE_PATH = '/lib/ace-linters/';
  var provider = null;

  window.createNycssLanguageProvider = function () {
    if (provider) return provider;
    if (typeof window.LanguageProvider === 'undefined') return null;

    provider = window.LanguageProvider.fromCdn({
      includeDefaultLinters: false,
      services: [
        { name: 'css', script: 'css-service.js', className: 'CssService', modes: 'css' }
      ],
      serviceManagerCdn: new URL(BASE_PATH, window.location.origin).href.replace(/\/$/, '')
    });

    return provider;
  };

  /**
   * Resolves with the shared provider once the linter client has loaded, or
   * with null after `timeoutMs` so a missing linter can never block the editor.
   */
  window.whenNycssLanguageProvider = function (timeoutMs) {
    var timeout = typeof timeoutMs === 'number' ? timeoutMs : 3000;
    var started = Date.now();

    return new Promise(function (resolve) {
      (function check() {
        if (typeof window.LanguageProvider !== 'undefined') {
          resolve(window.createNycssLanguageProvider());
          return;
        }
        if (Date.now() - started >= timeout) {
          resolve(null);
          return;
        }
        setTimeout(check, 50);
      })();
    });
  };
})();
