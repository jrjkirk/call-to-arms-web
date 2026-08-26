/**
 * Rasterise a floor-plan SVG to a PNG the venue can print and carry around.
 *
 * Shared by the editor and the diary's read-only view, because getting this
 * right was not obvious. Serialising an SVG detaches it from the document, and
 * with it every stylesheet rule that was colouring the plan — the first version
 * downloaded a black rectangle. So the computed style of each node is copied
 * onto its clone as an inline style FIRST, while the two trees still match one
 * for one, and editor furniture is stripped afterwards. Stripping first shifts
 * the indices and paints every element with its neighbour's colours.
 */

const EXPORT_PROPS = [
    'fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-dasharray',
    'stroke-linecap', 'stroke-linejoin', 'opacity', 'shape-rendering',
    'font-family', 'font-size', 'font-weight', 'font-style',
    'letter-spacing', 'text-anchor', 'dominant-baseline', 'text-transform',
    'paint-order'
];

/** Selectors for things that belong on screen but not on a printout. */
const FURNITURE = '.frame, .grid, .band, .group-box, .sel-box, .handle, .rot-arm, .dims';

export type ExportOptions = {
    /** The SVG's user-space window, in feet. */
    view: { x: number; y: number; w: number; h: number };
    /** Download name, without the extension. */
    name: string;
    /** Pixels per foot. 34 gives a readable A4-ish sheet for a normal room. */
    px?: number;
    /** Drawn behind the plan — the page colour, so text stays legible. */
    background?: string;
    /** Extra lines printed along the top: the date, what the colours mean. */
    caption?: string[];
};

export async function exportPlanPng(svgEl: SVGSVGElement, opts: ExportOptions): Promise<void> {
    const { view, name, px = 34, background = '#0d0f13', caption = [] } = opts;
    const clone = svgEl.cloneNode(true) as SVGSVGElement;

    const src = [svgEl, ...svgEl.querySelectorAll('*')];
    const dst = [clone, ...clone.querySelectorAll('*')];
    for (let i = 0; i < src.length; i++) {
        const cs = getComputedStyle(src[i] as Element);
        let css = '';
        for (const prop of EXPORT_PROPS) {
            const v = cs.getPropertyValue(prop);
            if (v) css += `${prop}:${v};`;
        }
        dst[i].setAttribute('style', css);
        // text-transform styles the RENDER, not the content, and doesn't
        // survive into a rasterised copy — so apply it to the text itself.
        if (dst[i].tagName === 'text' && cs.textTransform === 'uppercase') {
            dst[i].textContent = (dst[i].textContent ?? '').toUpperCase();
        }
    }
    clone.querySelectorAll(FURNITURE).forEach((n) => n.remove());

    const w = Math.round(view.w * px);
    const plan = Math.round(view.h * px);
    // Caption band above the plan. A sheet that says only "here are some
    // rectangles" is no use behind the bar — it has to say which night.
    const line = 22;
    const band = caption.length ? caption.length * line + 16 : 0;
    const h = plan + band;

    clone.setAttribute('width', String(w));
    clone.setAttribute('height', String(plan));
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

    const svgText = new XMLSerializer().serializeToString(clone);
    const url = URL.createObjectURL(new Blob([svgText], { type: 'image/svg+xml' }));
    try {
        const img = new Image();
        await new Promise((res, rej) => {
            img.onload = res;
            img.onerror = () => rej(new Error('render failed'));
            img.src = url;
        });
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const g = canvas.getContext('2d')!;
        g.fillStyle = background;
        g.fillRect(0, 0, w, h);
        caption.forEach((text, i) => {
            g.fillStyle = i === 0 ? '#e8e8ec' : '#9a9ea8';
            g.font = `${i === 0 ? '700 ' : ''}${i === 0 ? 17 : 13}px system-ui, sans-serif`;
            g.fillText(text, 14, 24 + i * line);
        });
        g.drawImage(img, 0, band, w, plan);
        const a = document.createElement('a');
        a.download = `${name.replace(/\W+/g, '-').toLowerCase()}.png`;
        a.href = canvas.toDataURL('image/png');
        a.click();
    } finally {
        URL.revokeObjectURL(url);
    }
}
