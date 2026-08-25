/**
 * Floor-plan geometry. Everything is in FEET; every object is described by its
 * CENTRE, a bounding box (width × depth) and a rotation in degrees.
 *
 * Kept out of the component because resize-under-rotation is the one piece of
 * real maths here, and it is far easier to be sure of when it isn't tangled up
 * with pointer plumbing and Svelte state.
 */

export type Box = {
    pos_x: number;
    pos_y: number;
    width_ft: number;
    depth_ft: number;
    rotation: number;
};

export type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

const rad = (deg: number) => (deg * Math.PI) / 180;

/** Rotate a vector by `deg` clockwise, matching SVG's rotate(). */
export function rotate(x: number, y: number, deg: number): { x: number; y: number } {
    const a = rad(deg);
    const c = Math.cos(a);
    const s = Math.sin(a);
    return { x: x * c - y * s, y: x * s + y * c };
}

/** A world point expressed in the object's own un-rotated frame. */
export function toLocal(box: Box, x: number, y: number): { x: number; y: number } {
    return rotate(x - box.pos_x, y - box.pos_y, -box.rotation);
}

/** A point in the object's frame expressed in world coordinates. */
export function toWorld(box: Box, x: number, y: number): { x: number; y: number } {
    const r = rotate(x, y, box.rotation);
    return { x: r.x + box.pos_x, y: r.y + box.pos_y };
}

/** Which corner/edge each handle sits on, in units of half-extent. */
export const HANDLE_DIR: Record<Handle, [number, number]> = {
    nw: [-1, -1], n: [0, -1], ne: [1, -1], e: [1, 0],
    se: [1, 1], s: [0, 1], sw: [-1, 1], w: [-1, 0]
};

export function handlePoint(box: Box, h: Handle): { x: number; y: number } {
    const [sx, sy] = HANDLE_DIR[h];
    return toWorld(box, (sx * box.width_ft) / 2, (sy * box.depth_ft) / 2);
}

/**
 * Resize by dragging `handle` to a world point.
 *
 * The opposite corner stays put — which is what makes a drag feel right, and is
 * the whole reason this works in the object's LOCAL frame. Done in world
 * coordinates, a rotated table would slide sideways as you tried to lengthen it.
 */
export function resize(
    box: Box,
    handle: Handle,
    px: number,
    py: number,
    opts: { min?: number; snap?: number; keepAspect?: boolean } = {}
): Box {
    const min = opts.min ?? 1;
    const snap = opts.snap ?? 0;
    const [sx, sy] = HANDLE_DIR[handle];

    const p = toLocal(box, px, py);
    const ax = (-sx * box.width_ft) / 2;      // the edge that must not move
    const ay = (-sy * box.depth_ft) / 2;

    let w = box.width_ft;
    let d = box.depth_ft;
    if (sx !== 0) w = Math.abs(p.x - ax);
    if (sy !== 0) d = Math.abs(p.y - ay);

    if (snap > 0) {
        if (sx !== 0) w = Math.round(w / snap) * snap;
        if (sy !== 0) d = Math.round(d / snap) * snap;
    }
    if (opts.keepAspect && sx !== 0 && sy !== 0) {
        const k = Math.max(w / box.width_ft, d / box.depth_ft);
        w = box.width_ft * k;
        d = box.depth_ft * k;
    }
    w = Math.max(min, w);
    d = Math.max(min, d);

    const cx = sx === 0 ? 0 : ax + (sx * w) / 2;
    const cy = sy === 0 ? 0 : ay + (sy * d) / 2;
    const c = toWorld(box, cx, cy);

    return { ...box, width_ft: w, depth_ft: d, pos_x: c.x, pos_y: c.y };
}

/** Degrees from an object's centre to a point, 0 = straight up. */
export function angleTo(box: Box, px: number, py: number): number {
    return (Math.atan2(py - box.pos_y, px - box.pos_x) * 180) / Math.PI + 90;
}

export function norm(deg: number): number {
    return ((deg % 360) + 360) % 360;
}

/** Half-extents of the rotated box projected onto the world axes. */
export function extents(box: Box): { hx: number; hy: number } {
    const a = rad(box.rotation);
    const c = Math.abs(Math.cos(a));
    const s = Math.abs(Math.sin(a));
    return {
        hx: (box.width_ft * c + box.depth_ft * s) / 2,
        hy: (box.width_ft * s + box.depth_ft * c) / 2
    };
}

export function overlaps(a: Box, b: Box, tolerance = 0.05): boolean {
    const ea = extents(a);
    const eb = extents(b);
    return (
        Math.abs(a.pos_x - b.pos_x) < ea.hx + eb.hx - tolerance &&
        Math.abs(a.pos_y - b.pos_y) < ea.hy + eb.hy - tolerance
    );
}

/** Feet as a readable measurement: 6 → 6′, 4.5 → 4′ 6″, 0.5 → 6″ */
export function feet(v: number): string {
    const whole = Math.floor(v + 1e-6);
    const inches = Math.round((v - whole) * 12);
    if (inches === 12) return `${whole + 1}′`;
    if (inches === 0) return `${whole}′`;
    if (whole === 0) return `${inches}″`;
    return `${whole}′ ${inches}″`;
}
