import { PUBLIC_API_URL } from '$env/static/public';
import type { PageServerLoad } from './$types';

function ukDateStr(d: Date): string {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${d.getFullYear()}`;
}

/** Python weekday convention: Mon=0 … Sun=6. */
function pyWeekday(d: Date): number {
    return (d.getDay() + 6) % 7;
}

/** Wednesday id. From Saturday onwards, roll to next week's Wednesday. */
function weekIdWed(today: Date): string {
    const d = new Date(today);
    let w = pyWeekday(d);
    if (w >= 5) {
        d.setDate(d.getDate() + (7 - w)); // jump to next Monday
        w = 0;
    }
    d.setDate(d.getDate() + (2 - w));
    return ukDateStr(d);
}

/** Next Friday on or after today. */
function weekIdFri(today: Date): string {
    const d = new Date(today);
    const ahead = (((4 - pyWeekday(d)) % 7) + 7) % 7;
    d.setDate(d.getDate() + ahead);
    return ukDateStr(d);
}

/** HH runs fortnightly, anchored on Friday 8 May 2026. */
const HH_SESSION_ANCHOR = new Date(2026, 4, 8);

function hhNextSessionFriday(today: Date): string {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (d <= HH_SESSION_ANCHOR) return ukDateStr(HH_SESSION_ANCHOR);
    const msPerDay = 24 * 60 * 60 * 1000;
    const deltaDays = Math.floor((d.getTime() - HH_SESSION_ANCHOR.getTime()) / msPerDay);
    const fortnights = Math.floor(deltaDays / 14);
    const candidate = new Date(HH_SESSION_ANCHOR);
    candidate.setDate(candidate.getDate() + fortnights * 14);
    if (d > candidate) candidate.setDate(candidate.getDate() + 14);
    return ukDateStr(candidate);
}

function weekIdForSystem(system: string): string {
    const today = new Date();
    if (system === 'The Horus Heresy') return hhNextSessionFriday(today);
    if (system === 'Kill Team') return weekIdFri(today);
    return weekIdWed(today);
}

export const load: PageServerLoad = async ({ fetch, url }) => {
    const system = url.searchParams.get('system') || 'The Old World';
    const week = url.searchParams.get('week') || weekIdForSystem(system);

    const params = new URLSearchParams({ system, week });
    const response = await fetch(`${PUBLIC_API_URL}/signups/stats?${params}`);

    let stats = { signed_up: 0, newcomers: 0, veterans: 0 };
    if (response.ok) {
        stats = await response.json();
    }

    return { system, week, stats };
};