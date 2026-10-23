/**
 * Push notifications in the browser: the steps the Account page's panel and
 * the one-tap prompt both use. The server side is push.py in the API; the
 * service worker that shows them is static/sw.js.
 */
import { PUBLIC_API_URL } from '$env/static/public';

export type PushKind = { kind: string; label: string };
export type PushInfo = { enabled: boolean; public_key: string | null; kinds: PushKind[] };

export function pushSupported(): boolean {
    return typeof window !== 'undefined'
        && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export function isIos(): boolean {
    return /iPad|iPhone|iPod/.test(navigator.userAgent)
        || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function isInstalled(): boolean {
    return window.matchMedia('(display-mode: standalone)').matches
        || (navigator as unknown as { standalone?: boolean }).standalone === true;
}

export async function pushApi(path: string, body?: unknown) {
    const r = await fetch(`${PUBLIC_API_URL}${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        credentials: 'include',
        headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body)
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data?.detail || 'Something went wrong. Try again.');
    return data;
}

export async function pushInfo(): Promise<PushInfo> {
    return pushApi('/push/key');
}

export async function pushRegistration(): Promise<ServiceWorkerRegistration> {
    return (await navigator.serviceWorker.getRegistration('/')) ?? navigator.serviceWorker.register('/sw.js');
}

/** The VAPID public key, as the bytes pushManager.subscribe wants. */
function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
    const pad = '='.repeat((4 - (base64url.length % 4)) % 4);
    const raw = atob((base64url + pad).replace(/-/g, '+').replace(/_/g, '/'));
    const out = new Uint8Array(new ArrayBuffer(raw.length));
    for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
}

/** Whether this browser is subscribed for the signed-in account. */
export async function deviceStatus(): Promise<{ subscribed: boolean; muted: string[] }> {
    const sub = await (await pushRegistration()).pushManager.getSubscription();
    if (!sub) return { subscribed: false, muted: [] };
    return pushApi('/push/status', { endpoint: sub.endpoint });
}

/**
 * Subscribe this browser for the signed-in account. Assumes permission is
 * already granted (ask with Notification.requestPermission() first, from a
 * tap). Re-subscribing moves a device that was another account's.
 */
export async function subscribeDevice(publicKey: string): Promise<{ subscribed: boolean; muted: string[] }> {
    const reg = await pushRegistration();
    const sub = (await reg.pushManager.getSubscription())
        ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) }));
    return pushApi('/push/subscribe', sub.toJSON());
}

/** The browser's own errors mean nothing to a player; ours from the API do. */
export function friendlyPushError(e: unknown): string {
    const text = e instanceof Error ? e.message : '';
    return /registration|push service|AbortError|NotAllowed/i.test(text) || !text
        ? "This browser couldn't set up notifications. Check they're allowed for this site, then try again."
        : text;
}
