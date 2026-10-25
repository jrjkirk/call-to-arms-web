/**
 * Swipe left or right on a phone to move between the bottom bar's tabs.
 *
 * Judged on the finger's lift, never during the move, and every listener is
 * passive: the page scrolls exactly as it always did, and a swipe only counts
 * once it is clearly sideways. It stays out of the way of anything that uses
 * a sideways drag itself:
 *   - sliders, text boxes, a field being typed in, and anything marked
 *     data-no-swipe
 *   - anything that scrolls sideways (wide tables, tile rows, maps)
 *   - a swipe starting at the screen's edge, which is the phone's own back
 *     gesture
 *   - two fingers (a pinch), or text being selected
 */

const EDGE = 24;          // px from either side left to the system's back gesture
const MIN_DISTANCE = 64;  // px; also at least 18% of the screen's width
const MAX_TIME = 700;     // ms; slower than this is a drag, not a swipe

export type SwipeDirection = 'next' | 'prev';

function usesSidewaysDrag(el: Element | null): boolean {
    for (let n = el; n && n !== document.body; n = n.parentElement) {
        // Dropdowns, buttons and checkboxes do nothing with a sideways drag, so
        // a swipe across the signup form still changes tab. Sliders do, and so
        // does a text field you're typing in (it moves the cursor).
        if (n.matches('input[type="range"], textarea, [contenteditable=""], [contenteditable="true"], [data-no-swipe], .leaflet-container')) {
            return true;
        }
        if (n.matches('input') && n === document.activeElement) return true;
        if (n.scrollWidth > n.clientWidth + 1) {
            const ox = getComputedStyle(n).overflowX;
            if (ox === 'auto' || ox === 'scroll') return true;
        }
    }
    return false;
}

export function attachTabSwipe(
    enabled: () => boolean,
    onSwipe: (direction: SwipeDirection) => void
): () => void {
    let start: { x: number; y: number; t: number } | null = null;

    function down(e: TouchEvent) {
        start = null;
        if (e.touches.length !== 1 || !enabled()) return;
        const t = e.touches[0];
        if (t.clientX < EDGE || t.clientX > window.innerWidth - EDGE) return;
        if (usesSidewaysDrag(e.target as Element)) return;
        start = { x: t.clientX, y: t.clientY, t: Date.now() };
    }

    function up(e: TouchEvent) {
        if (!start) return;
        const s = start;
        start = null;
        const t = e.changedTouches[0];
        const dx = t.clientX - s.x;
        const dy = t.clientY - s.y;
        if (Date.now() - s.t > MAX_TIME) return;
        if (Math.abs(dx) < Math.max(MIN_DISTANCE, window.innerWidth * 0.18)) return;
        if (Math.abs(dy) > Math.abs(dx) * 0.5) return;
        if (window.getSelection()?.toString()) return;
        onSwipe(dx < 0 ? 'next' : 'prev');
    }

    function cancel() {
        start = null;
    }

    // A second finger landing mid-swipe makes it a pinch.
    function move(e: TouchEvent) {
        if (e.touches.length > 1) start = null;
    }

    document.addEventListener('touchstart', down, { passive: true });
    document.addEventListener('touchend', up, { passive: true });
    document.addEventListener('touchcancel', cancel, { passive: true });
    document.addEventListener('touchmove', move, { passive: true });
    return () => {
        document.removeEventListener('touchstart', down);
        document.removeEventListener('touchend', up);
        document.removeEventListener('touchcancel', cancel);
        document.removeEventListener('touchmove', move);
    };
}
