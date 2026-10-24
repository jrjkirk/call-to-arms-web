/**
 * Phone page titles, sized to the space beside the logo.
 *
 * On a phone a member's header is the big logo on the right and the page title
 * on the left (see the layout's .topbar-member rules). This makes the title fill
 * that left-hand column, the rule Joel picked on the design canvas ("Phone
 * titles", option B, 2026-10-25, after trying C):
 *   - the title is on one line, as big as fits the column's width, capped at
 *     the logo's height (the logo is 164px wide to give the column more room);
 *   - its baseline sits exactly where the logo's "Rally. Pair. Play." ends.
 * Option C, stacking two-word titles over two lines ("YOUR / WEEK"), is kept
 * behind STACK_TWO_WORDS for a quick switch back.
 *
 * Measured, not fixed, because some titles are data (a player's name, an
 * event's name). Runs on every navigation, on resize, and whenever a page adds
 * a title late (a profile titles itself once its data loads). Off the phone
 * layout it removes everything it set, so desktop is untouched.
 */

// Barlow Condensed, measured in a browser at 100px with line-height 1.
const BASELINE = 0.9; // baseline sits at 90% of the font size from the box top
const CAP = 0.7; // capitals are 70% of the font size tall
const GAP = 0.92; // two-line titles: baseline to baseline, as a share of the size
// The logo artwork: "Rally. Pair. Play." ends at 85.3% of the image's height.
const TAGLINE = 0.853;
// Space between the title column and the logo.
const GUTTER = 14;
// Option C: put two-word titles on two lines. Off since Joel went with B.
const STACK_TWO_WORDS = false;
// Below this a title is not worth forcing: leave it as the page styles it.
const MIN_SIZE = 24;
// Capitals sit a hair above the baseline at these sizes; measured on the
// phone layout, this lands the letters exactly level with the tagline's.
const NUDGE = 1.5;

const SET = ['fontSize', 'lineHeight', 'maxWidth', 'whiteSpace', 'marginTop', 'textWrap'] as const;

function reset(el: HTMLElement) {
    for (const p of SET) el.style[p as any] = '';
    delete el.dataset.fitted;
}

/** Width of `text` set exactly like `el`, at 100px. */
function widthAt100(el: HTMLElement, text: string): number {
    const probe = el.cloneNode(false) as HTMLElement;
    probe.textContent = text;
    Object.assign(probe.style, {
        position: 'absolute', visibility: 'hidden', left: '-9999px', top: '0',
        fontSize: '100px', lineHeight: '1', whiteSpace: 'nowrap', width: 'auto', maxWidth: 'none', margin: '0'
    });
    document.body.appendChild(probe);
    const w = probe.getBoundingClientRect().width;
    probe.remove();
    return w;
}

/** The two-line split whose longer line is shortest, ignoring splits that
 *  would leave a single letter on a line ("PRIYA / R"). Infinity if none. */
function bestSplit(el: HTMLElement, words: string[]): number {
    let best = Infinity;
    for (let i = 1; i < words.length; i++) {
        const first = words.slice(0, i).join(' ');
        const second = words.slice(i).join(' ');
        if (first.replace(/\W/g, '').length < 2 || second.replace(/\W/g, '').length < 2) continue;
        best = Math.min(best, Math.max(widthAt100(el, first), widthAt100(el, second)));
    }
    return best;
}

function fitOne(title: HTMLElement, logo: HTMLElement) {
    reset(title);
    const logoBox = logo.getBoundingClientRect();
    const titleBox = title.getBoundingClientRect();
    if (!logoBox.width || !titleBox.width) return;

    const column = logoBox.left - GUTTER - titleBox.left;
    const tagline = logoBox.top + TAGLINE * logoBox.height;
    const height = tagline - logoBox.top; // the logo's own height, top to tagline
    const words = (title.textContent ?? '').trim().split(/\s+/).filter(Boolean);
    if (!words.length || column <= 0) return;

    const split = STACK_TWO_WORDS && words.length >= 2 ? bestSplit(title, words) : Infinity;
    const twoLines = split !== Infinity;
    const size = twoLines
        ? Math.min((column * 100) / split, height / (GAP + CAP))
        : Math.min((column * 100) / widthAt100(title, words.join(' ')), height / CAP);
    if (size < MIN_SIZE) return;

    title.style.fontSize = `${size}px`;
    title.style.lineHeight = twoLines ? String(GAP) : '1';
    title.style.whiteSpace = twoLines ? 'normal' : 'nowrap';
    // Two lines: a column just wide enough for the longer line, so the browser
    // breaks at the same place the measurement did.
    title.style.maxWidth = twoLines ? `${Math.ceil((split * size) / 100) + 2}px` : '';
    (title.style as any).textWrap = twoLines ? 'balance' : '';

    // Then move it so the last line's baseline lands on the tagline.
    const box = title.getBoundingClientRect();
    const line = (twoLines ? GAP : 1) * size;
    const lastBaseline = box.bottom - line + ((twoLines ? GAP : 1) - 1) * size / 2 + BASELINE * size;
    const current = parseFloat(getComputedStyle(title).marginTop) || 0;
    title.style.marginTop = `${current + (tagline - lastBaseline) + NUDGE}px`;
    title.dataset.fitted = '1';
}

/** Size every page title on the page, or undo it when not on the phone layout. */
export function fitPhoneTitles() {
    if (typeof document === 'undefined') return;
    const titles = Array.from(document.querySelectorAll<HTMLElement>('.page-title'));
    const logo = document.querySelector<HTMLElement>('.topbar-member .topbar-logo');
    const phone = window.matchMedia('(max-width: 768px)').matches;
    for (const t of titles) {
        if (phone && logo) fitOne(t, logo);
        else if (t.dataset.fitted) reset(t);
    }
}
