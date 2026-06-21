function initializeSmoothCursor() {
    var cursorPosition = { x: 0, y: 0 };
    var smoothing = 0.05;
    window.cursorIsAnimating = false;

    function animateCursor() {
        if (!window.cursorX || !window.cursorY) {
            window.cursorIsAnimating = true;
            requestAnimationFrame(animateCursor);
            return;
        }

        if (!window.prefersReducedMotion) {
            var dx = window.cursorX - cursorPosition.x;
            var dy = window.cursorY - cursorPosition.y;

            if (Math.abs(dx) < 0.1 && Math.abs(dy) < 0.1) {
                cursorPosition.x = window.cursorX;
                cursorPosition.y = window.cursorY;
                window.cursorIsAnimating = false;
                return;
            }

            cursorPosition.x += dx * smoothing;
            cursorPosition.y += dy * smoothing;

            if (window.cssBadge && window.cssBadge.classList.contains('hover-animation')) {
                var x = Math.round(cursorPosition.x);
                var y = Math.round(cursorPosition.y);
                if (window.cursor && (window.cursor._lx !== x || window.cursor._ly !== y)) {
                    window.cursor._lx = x;
                    window.cursor._ly = y;
                    window.cursor.style.translate = 'calc(' + x + 'px - 50%) calc(' + y + 'px - 50%)';
                }
            }
        }

        window.cursorIsAnimating = true;
        requestAnimationFrame(animateCursor);
    }
    window.animateCursor = animateCursor;
    animateCursor();
};

window.initializeSmoothCursor = initializeSmoothCursor;