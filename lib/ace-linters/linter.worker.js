self.onmessage = function (e) {
  var data = e.data;
  if (data.type === 'lint') {
    var annotations = lintCSS(data.code);
    self.postMessage({ type: 'lintResult', sessionId: data.sessionId, annotations: annotations });
  }
};

function lintCSS(css) {
  var annotations = [];
  if (!css || !css.trim()) return annotations;

  var lines = css.split('\n');
  var braceDepth = 0;
  var lineContents = [];

  for (var i = 0; i < lines.length; i++) {
    lineContents.push({ text: lines[i], openBraces: 0, closeBraces: 0 });

    var openCount = (lines[i].match(/\{/g) || []).length;
    var closeCount = (lines[i].match(/\}/g) || []).length;

    lineContents[i].openBraces = openCount;
    lineContents[i].closeBraces = closeCount;
    braceDepth += openCount - closeCount;

    if (braceDepth < 0) {
      annotations.push({
        row: i, column: lines[i].lastIndexOf('}') + 1,
        text: 'Unexpected closing brace', type: 'error'
      });
      braceDepth = 0;
    }

    var commentMatch = lines[i].match(/\/\*[\s\S]*?\*\//g);
    if (commentMatch) {
      for (var c = 0; c < commentMatch.length; c++) {
        if (commentMatch[c].indexOf('/*') > -1 && commentMatch[c].indexOf('*/') === -1) {
          annotations.push({
            row: i, column: lines[i].indexOf('/*') + 1,
            text: 'Unclosed comment', type: 'warning'
          });
        }
      }
    }
  }

  if (braceDepth > 0) {
    annotations.push({
      row: lines.length - 1, column: 0,
      text: 'Unclosed block - missing ' + braceDepth + ' closing brace(s)', type: 'error'
    });
  }

  return annotations;
}
