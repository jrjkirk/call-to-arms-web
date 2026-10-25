/**
 * The colour of a kind of game (a vibe), for the standalone bar beside a
 * game or signup. Each keeps the colour it had on the old pairings cards, so
 * regulars recognise a competitive table at a glance. Anything else (a
 * club's own vibe) takes the gold. Shared by the player pairings and the
 * admin Pairings tab so the two can't drift apart.
 */
const VIBE_COLOURS: Record<string, string> = {
    casual: '#6eb46e', competitive: '#d25050', intro: '#5a9bd4', standard: '#9c8bd1'
};

export function vibeColour(vibe: string | null | undefined): string {
    return VIBE_COLOURS[(vibe ?? '').toLowerCase()] ?? '#c9a14a';
}
