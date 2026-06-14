import { PUBLIC_API_URL } from '$env/static/public';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, fetch, cookies }) => {
    const sessionCookie = cookies.get('cta_session');
    const headers: HeadersInit = sessionCookie ? { cookie: `cta_session=${sessionCookie}` } : {};

    const response = await fetch(`${PUBLIC_API_URL}/players/${params.id}`, { headers });

    if (response.status === 404) {
        throw error(404, 'Player not found');
    }
    if (!response.ok) {
        throw error(response.status, 'Failed to load player');
    }

    const data = await response.json();
    return data;
};