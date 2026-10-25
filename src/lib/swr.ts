/**
 * Stale-while-revalidate for a page's own data: show what this visit last
 * saw at once, fetch fresh behind it, and only touch the page if the answer
 * changed.
 *
 *     const k = `/league/rankings?${params}`;
 *     rankings = peek(k) ?? [];                  // instant on a return visit
 *     revalidate(k, (v) => (rankings = v));      // called only when different
 *
 * A tab you came back to used to start empty and fill in as its requests
 * landed, so every switch flickered. Now it reappears as you left it and only
 * moves if something really did change (a new signup, a result).
 *
 * Kept in memory for the visit, like $lib/session, and cleared with it on
 * sign-out. Only successful answers are kept; a failure leaves the last good
 * one showing.
 */
import { PUBLIC_API_URL } from '$env/static/public';

const store = new Map<string, { json: string; value: unknown }>();

/** What this visit last saw for `path`, if anything. */
export function peek<T>(path: string): T | undefined {
    return store.get(path)?.value as T | undefined;
}

/** Fetch `path` fresh and remember it. Null on any failure. */
export async function fetchFresh<T>(path: string): Promise<T | null> {
    try {
        const r = await fetch(`${PUBLIC_API_URL}${path}`, { credentials: 'include' });
        if (!r.ok) return null;
        const text = await r.text();
        const value = JSON.parse(text) as T;
        store.set(path, { json: text, value });
        return value;
    } catch (_) {
        return null;
    }
}

/**
 * Fetch `path` fresh and hand it to `apply` only if it differs from what was
 * there before (or nothing was). Resolves true if `apply` ran.
 */
export async function revalidate<T>(path: string, apply: (value: T) => void): Promise<boolean> {
    const before = store.get(path)?.json;
    const value = await fetchFresh<T>(path);
    if (value === null) return false;
    if (before !== undefined && store.get(path)?.json === before) return false;
    apply(value);
    return true;
}

/** Forget one answer (after changing it) or, with no argument, everything. */
export function forget(path?: string): void {
    if (path === undefined) store.clear();
    else store.delete(path);
}
