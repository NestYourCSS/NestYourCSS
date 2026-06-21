function initializeSmoothCursor() {
    const cursorPosition = { x: 0, y: 0 };
    const smoothing = 0.05;
    
    function animateCursor() {
        if (!window.cursorX || !window.cursorY) return requestAnimationFrame(animateCursor);

        if (!window.prefersReducedMotion) {
            const dx = window.cursorX - cursorPosition.x;
            const dy = window.cursorY - cursorPosition.y;
            
            cursorPosition.x += dx * smoothing;
            cursorPosition.y += dy * smoothing;
        
            if (window.cssBadge.classList.contains('hover-animation')) {
                const x = Math.round(cursorPosition.x);
                const y = Math.round(cursorPosition.y);
                if (window.cursor._lx !== x || window.cursor._ly !== y) {
                    window.cursor._lx = x;
                    window.cursor._ly = y;
                    window.cursor.style.translate = `calc(${x}px - 50%) calc(${y}px - 50%)`;
                }
            }
        }
    
        requestAnimationFrame(animateCursor);
    };
    animateCursor();
};

window.initializeSmoothCursor = initializeSmoothCursor;