/**
 * The answers every page needs and that don't change between tabs: who is
 * signed in (/auth/me), what they may administer (/admin/me), and which systems
 * their club runs (/systems/mine).
 *
 * Every page used to fetch these itself on every visit, and most showed a
 * placeholder until they came back, so each tab switch waited on the same
 * three round trips. Now the first ask goes to the API and everyone after it,
 * on any page, gets the same answer straight away. Requests in flight are
 * shared too, so two components asking at once make one request.
 *
 * The layout keeps it current: refreshAuth() fetches fresh and primes the
 * cache (on load, after claiming a profile), and signing out clears it. A
 * failed answer is never kept, so the next ask tries again.
 */
import { PUBLIC_API_URL } from '$env/static/public';
import { forget } from './swr';

const cache = new Map<string, Promise<any>>();

function load(path: string): Promise<any> {
    const p = fetch(`${PUBLIC_API_URL}${path}`, { credentials: 'include' })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);
    cache.set(path, p);
    p.then((v) => {
        if (v === null && cache.get(path) === p) cache.delete(path);
    });
    return p;
}

/** The cached answer for `path`, fetching it once if nobody has yet. */
export function cached<T = any>(path: string): Promise<T | null> {
    return cache.get(path) ?? load(path);
}

/** Store an answer fetched elsewhere (the layout's own fresh requests). */
export function prime(path: string, value: unknown): void {
    if (value === null || value === undefined) cache.delete(path);
    else cache.set(path, Promise.resolve(value));
}

/** Forget everything: signing out, or anything that changes who is signed in. */
export function clearSession(): void {
    cache.clear();
    forget();
}

export const getMe = () => cached('/auth/me');
export const getAdminMe = () => cached('/admin/me');
export const getMySystemRows = () =>
    cached<{ legacy_system_name: string; session_start_time?: string | null }[]>('/systems/mine');
