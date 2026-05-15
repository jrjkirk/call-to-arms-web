import { PUBLIC_API_URL } from '$env/static/public';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

interface RankingRow {
    rank: number;
    player_id: number;
    name: string;
    default_faction: string | null;
    rating: number;
    wins: number;
    losses: number;
    draws: number;
    total_games: number;
}

export const load: PageServerLoad = async ({ fetch }) => {
    const response = await fetch(`${PUBLIC_API_URL}/league/rankings`);
    if (!response.ok) {
        throw error(response.status, 'Failed to load league rankings');
    }
    const rankings: RankingRow[] = await response.json();
    return { rankings };
};