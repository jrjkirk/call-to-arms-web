/**
 * Helpers for the Discord membership gate's 403 response.
 *
 * The gate is the one API error that carries a structured body rather than a
 * plain string, because it needs a club name and an invite URL to render a
 * useful prompt. Every call site that can hit the gate must go through
 * `detailText` rather than `body.detail`, or an object detail renders as
 * "[object Object]".
 */

export type DiscordGateBlock = {
	code: 'discord_membership_required';
	message: string;
	club_name: string | null;
	/** Which game night was refused — a club can gate each of its systems on a
	 *  different Discord server, so "you need the Discord" is ambiguous without
	 *  it. Null for the club-level fallback gate. */
	system: string | null;
	/** How to refer to the server the player must join, e.g. "the Kill Team
	 *  Discord" or "EGNWGC's Discord". Resolved server-side because only the
	 *  backend knows whether this system has its own server or is borrowing the
	 *  club's. */
	server_label: string | null;
	/** The invite for THAT server specifically — never the club-wide one when
	 *  the system has its own, or the player joins somewhere that won't let
	 *  them past the gate. */
	discord_url: string | null;
};

/**
 * The gate payload if this response body is a gate refusal, else null.
 */
export function discordGateFrom(body: unknown): DiscordGateBlock | null {
	const detail = (body as { detail?: unknown } | null | undefined)?.detail;
	if (!detail || typeof detail !== 'object') return null;
	const d = detail as Record<string, unknown>;
	if (d.code !== 'discord_membership_required') return null;
	return {
		code: 'discord_membership_required',
		message:
			typeof d.message === 'string' && d.message
				? d.message
				: 'You need to join the right Discord server to take part.',
		club_name: typeof d.club_name === 'string' ? d.club_name : null,
		system: typeof d.system === 'string' ? d.system : null,
		server_label: typeof d.server_label === 'string' ? d.server_label : null,
		discord_url: typeof d.discord_url === 'string' ? d.discord_url : null
	};
}

/**
 * Safely turn any error body into display text.
 *
 * Defensive on purpose: a string detail passes through, an object detail
 * falls back to its `message` field, and anything else yields the caller's
 * fallback — so no future structured error can ever leak "[object Object]"
 * into the UI the way an unguarded `body.detail` would.
 */
export function detailText(body: unknown, fallback: string): string {
	const detail = (body as { detail?: unknown } | null | undefined)?.detail;
	if (typeof detail === 'string' && detail) return detail;
	if (detail && typeof detail === 'object') {
		const msg = (detail as Record<string, unknown>).message;
		if (typeof msg === 'string' && msg) return msg;
	}
	return fallback;
}
