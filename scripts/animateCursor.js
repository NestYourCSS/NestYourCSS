function initializeSmoothCursor() {
    const cursorPosition = { x: 0, y: 0 };
    const smoothing = 0.05;
    
    function animateCursor() {
        if (!window.cursorX || !window.cursorY) return requestAnimationFrame(animateCursor);
        
        const dx = window.cursorX - cursorPosition.x;
        const dy = window.cursorY - cursorPosition.y;
        
        cursorPosition.x += dx * smoothing;
        cursorPosition.y += dy * smoothing;
    
        if (cssBadge.classList.contains('hover-animation')) {
            const x = Math.round(cursorPosition.x);
            const y = Math.round(cursorPosition.y);
            if (cursor._lx !== x || cursor._ly !== y) {
                cursor._lx = x;
                cursor._ly = y;
                cursor.style.translate = `calc(${x}px - 50%) calc(${y}px - 50%)`;
            }
        }
    
        requestAnimationFrame(animateCursor);
    };
    animateCursor();
};