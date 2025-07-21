
let lineNumbers = miniEditor.querySelector('#lineNumbers');
let nycssCodeExample = miniEditor.querySelector('#nycssCodeExample');

let lines = nycssCodeExample.textContent.trim().split("\n").concat('\n');
lineNumbers.innerHTML = [...lines].fill().map((_, i) => `<div>${i + 1}</div>`).join("");
nycssCodeExample.innerHTML = lines.map((item) => {
  if (!item.trim()) return '<br>';
  
  let line = item.trim().replace(/{TAB}/g, "&emsp;").replace(/{BOLD} /g, "<strong>").replace(/ {\/BOLD}/g, "</strong>");
  
  let splitLine = line.split(/(&emsp; )+/);
  let lineContent = splitLine[splitLine.length - 1];
  
  // Only wrap non-tag characters in spans
  line = line.slice(0, line.length - lineContent.length) + lineContent.split(/(<\/?strong>)/).reduce((acc, part, index, arr) => acc + (part.match(/(<\/?strong>)/) ? part : [...part].map((ch, i) => `<span style="--charIndex: ${arr.slice(0, index).filter((p) => !p.match(/(<\/?strong>)/)).join("").length + i}">${ch}</span>`).join("")), "");
  
  return `<div>${line}</div>`;
}).join("");
nycssCodeExample.parentElement.innerHTML = nycssCodeExample.outerHTML.trim();

/* Set active line */

function updateActiveLine(cursorX, cursorY) {
  let lineNumbers = miniEditor.querySelector('#lineNumbers');
  let nycssCodeExample = miniEditor.querySelector('#nycssCodeExample');

  /* Vertical */
  
  debounce(() => {
    const segmentHeight = miniEditor.parentElement.offsetHeight / lines.length;
    
    const activeLine = Math.ceil(cursorY / segmentHeight);
    
    nycssCodeExample.parentElement.style.setProperty('--activeLine', activeLine + '');
    nycssCodeExample.parentElement.style.setProperty('--maxLines', lines.length + '');
  }, 250)();
  
  /* Horizontal */

  let horizontalPos = cursorX / document.body.clientWidth;
  let padding = nycssCodeExample.parentElement.offsetLeft / miniEditor.offsetWidth;
  let horizontalRePos = ((1 - (padding * 2)) * horizontalPos) + padding;
  nycssCodeExample.parentElement.style.setProperty('--intensityPos', roundNumber(horizontalRePos * 100) + '%');
}