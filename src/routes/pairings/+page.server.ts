import { PUBLIC_API_URL } from '$env/static/public';
import type { PageServerLoad } from './$types';

function defaultWeekFor(system: string): string {
    // Per the Streamlit app's convention: TOW uses upcoming Wednesday,
    // HH/KT use upcoming Friday. We mirror that.
    const target = system === 'The Old World' ? 3 : 5; // 3=Wed, 5=Fri
    const d = new Date();
    const day = d.getDay();
    const daysAhead = (target - day + 7) % 7;
    d.setDate(d.getDate() + daysAhead);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
}

export const load: PageServerLoad = async ({ fetch, url }) => {
    const system = url.searchParams.get('system') || 'The Old World';
    const week = url.searchParams.get('week') || defaultWeekFor(system);

    const params = new URLSearchParams({ system, week });
    const response = await fetch(`${PUBLIC_API_URL}/pairings?${params}`);

    let data: any = { published: false, matchups: [], total_players: 0, total_matchups: 0, byes: 0 };
    if (response.ok) {
        data = await response.json();
    }

    return { system, week, ...data };
};