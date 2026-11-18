function glueEditor(editor) {
    let container = editor.container;
    let stickyEl = container.querySelector('.ace_scroller');
    
    if (stickyEl.nextElementSibling.classList[0] == 'ace_scrollbar') {
        stickyEl.insertAdjacentHTML("beforebegin", "<div class='ace_sticky-content ace_layer'></div>");
    
        const stickyRule = document.createElement('style');
    
        stickyRule.innerHTML = `
            .ace_sticky-content {
                position: fixed;
                height: fit-content;
                background: rgb(9, 31, 42);
                border-bottom: 1px solid rgb(from var(--pri-colour-m-darker) r g b /  / 0.50);
                pointer-events: unset;
            }
            
            .ace_sticky-content .ace_indent-guide {
                border: none;
            }
        `;
        
        container.style.alignSelf = 'flex-end';
        stickyEl.parentElement.style.contain = 'content';
    
        document.head.appendChild(stickyRule);
    }
    
    stickyEl = stickyEl.previousElementSibling;
    
    function stickyScroll() {
        if (editor.session.getScrollTop() != this.scrollTop) {
            this.scrollTop = editor.session.getScrollTop();
            
            let selectors = [];
            
            let currentRow = editor.renderer.layerConfig.firstRow;
            let row = 0;
            
            while (row < currentRow) {
                let tokens = editor.session.getTokens(row);
                
                if (tokens.some((token) => "paren.lparen" == token.type)) {
                    selectors.push([row, tokens]);
    
                } else if (tokens.some((token) => "paren.rparen" == token.type)) {
                    selectors.pop();
                }
                
                row++;
            }
    
            stickyEl.innerHTML = selectors.map(([row, tokens], length) => {
                return `<div class="ace_line">${new Array(length).fill(null).map(() => '<span class="ace_indent-guide">    </span>').join('') + tokens.filter((token) => token.value != '\t').map((token) => token.type == "text" ? token.value.replace(/\t/g, '') : `<span class="ace_${token.type}">${token.value}</span>`).join('')}</div>`;
            }).join('');
    
            container.querySelector('.ace_gutter').style.marginTop = (selectors.length * 19) + 'px';
            container.querySelector('.ace_scroller').style.marginTop = (selectors.length * 19) + 'px';
            
            let gutterWidth = container.querySelector('.ace_gutter').offsetWidth;
            stickyEl.style.paddingLeft = (gutterWidth + 5) + 'px';
            stickyEl.style.width = stickyEl.parentElement.offsetWidth + 'px';
    
            container.querySelector('.ace_scrollbar-v').style.height = `calc(100% - ${(selectors.length * 19) + 16}px)`;

            let currentPosition = editor.getCursorPosition();

            const fillerString = '​​​​​END OF CODE​​​​​';

            let allLines = editor.session.getDocument().getAllLines();

            let fillerLines = allLines.filter(line => line == fillerString);
            let totalLines = allLines.filter(line => line != fillerString);
            let difference = selectors.length - fillerLines.length;

            if (difference > 0) {
                for (let i = 0; i < difference; i++) {
                    editor.session.insert({
                        row: Number.POSITIVE_INFINITY,
                        column: 0
                    }, '\n' + fillerString);
                }
            }
            else if (difference < 0) {
                editor.session.remove({
                    start: { row: totalLines.length, column: 0 },
                    end: { row: totalLines.length - difference, column: 0 }
                });
            }

            editor.moveCursorToPosition(currentPosition);
        }
    }
    
    editor.renderer.on("afterRender", () => stickyScroll());

    let maxLine = 10;
    let isProgrammaticChange = false;
    editor.getSession().selection.on('changeSelection', () => {
        if (isProgrammaticChange) return;

        let { start: { row: startRow }, end: { row: endRow } } = editor.getSelectionRange();

        let finalLine = maxLine - 1;
        let finalChar = (line) => editor.session.getLine(line).length;

        if (startRow > maxLine && endRow > maxLine) {

            isProgrammaticChange = true;

            editor.clearSelection();
            editor.moveCursorTo(maxLine, finalChar(maxLine));

            let { start: { row: startRow }, end: { row: endRow } } = editor.getSelectionRange();
            isProgrammaticChange = false;

        } else if (startRow > maxLine) {

            isProgrammaticChange = true;

            editor.getSelection().moveCursorTo({row: finalLine, column: finalChar(finalLine)});
            editor.getSelection().selectTo(finalLine, finalChar(finalLine));

            let { start: { row: startRow }, end: { row: endRow } } = editor.getSelectionRange();
            isProgrammaticChange = false;

        } else if (endRow > maxLine) {

            isProgrammaticChange = true;

            editor.getSelection().selectTo(finalLine, finalChar(finalLine));

            let { start: { row: startRow }, end: { row: endRow } } = editor.getSelectionRange();
            isProgrammaticChange = false;

        }
        
    });

    // stickyScroll();
}