import { PUBLIC_API_URL } from '$env/static/public';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

interface Player {
    id: number;
    name: string;
    default_faction: string | null;
    active: boolean;
}

export const load: PageServerLoad = async ({ fetch }) => {
    const response = await fetch(`${PUBLIC_API_URL}/players`);
    if (!response.ok) {
        throw error(response.status, 'Failed to load players');
    }
    const players: Player[] = await response.json();
    return { players };
};