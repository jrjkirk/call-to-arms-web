import { PUBLIC_API_URL } from '$env/static/public';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

interface RankingRow {
    rank: number;
    player_id: number;
    name: string;
    default_faction: string | null;
    most_played_faction: string | null;
    rating: number;
    wins: number;
    losses: number;
    draws: number;
    total_games: number;
}

interface Player {
    id: number;
    name: string;
}

export const load: PageServerLoad = async ({ fetch }) => {
    const [rankingsResp, playersResp] = await Promise.all([
        fetch(`${PUBLIC_API_URL}/league/rankings`),
        fetch(`${PUBLIC_API_URL}/players`),
    ]);

    if (!rankingsResp.ok) {
        throw error(rankingsResp.status, 'Failed to load league rankings');
    }

    const rankings: RankingRow[] = await rankingsResp.json();
    const players: Player[] = playersResp.ok ? await playersResp.json() : [];

    return { rankings, players };
};
