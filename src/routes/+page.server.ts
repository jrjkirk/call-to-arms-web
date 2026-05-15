import { PUBLIC_API_URL } from '$env/static/public';
import type { PageServerLoad } from './$types';

function nextWednesday(): string {
    // Returns the next (or current) Wednesday in DD/MM/YYYY format.
    const d = new Date();
    const day = d.getDay(); // 0 = Sun, 3 = Wed
    const daysUntilWed = (3 - day + 7) % 7;
    d.setDate(d.getDate() + daysUntilWed);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
}

export const load: PageServerLoad = async ({ fetch, url }) => {
    const system = url.searchParams.get('system') || 'The Old World';
    const week = url.searchParams.get('week') || nextWednesday();

    const params = new URLSearchParams({ system, week });
    const response = await fetch(`${PUBLIC_API_URL}/signups/stats?${params}`);

    let stats = { signed_up: 0, newcomers: 0, veterans: 0 };
    if (response.ok) {
        stats = await response.json();
    }

    return { system, week, stats };
};