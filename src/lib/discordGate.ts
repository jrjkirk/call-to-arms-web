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
				: "You need to join this club's Discord to sign up.",
		club_name: typeof d.club_name === 'string' ? d.club_name : null,
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
