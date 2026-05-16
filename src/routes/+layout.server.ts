import { PUBLIC_API_URL } from '$env/static/public';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ fetch, request }) => {
    // Forward the user's cookies to the backend so the backend can
    // recognise their session. Without this, the call is anonymous.
    const cookieHeader = request.headers.get('cookie') ?? '';

    try {
        const response = await fetch(`${PUBLIC_API_URL}/auth/me`, {
            headers: { cookie: cookieHeader },
            credentials: 'include'
        });
        if (response.ok) {
            return { auth: await response.json() };
        }
    } catch (_) {
        // Backend might be cold-starting; treat as anonymous for this render
    }
    return { auth: { authenticated: false } };
};