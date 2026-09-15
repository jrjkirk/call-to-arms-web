/**
 * How the UI names an account (account overhaul Slab 3).
 *
 * Three names can describe one person, and they mean different things:
 *   player_name   their name on this club's roster, set by the club's admins
 *   name          the name the account goes by, which the person chooses
 *                 (the API resolves it: their chosen name, else their Discord handle)
 *   discord_name  their Discord handle, kept so an admin can find them in the server
 *
 * Lead with the most specific name available and put the Discord handle beside
 * it when it adds something, which is how an admin matches a person here to a
 * person in their Discord.
 */
export type NamedAccount = {
	player_name?: string | null;
	name?: string | null;
	discord_name?: string | null;
};

export function accountLabel(entry: NamedAccount): string {
	const primary = entry.player_name || entry.name || entry.discord_name || 'Unknown';
	const handle = entry.discord_name;
	return handle && handle !== primary ? `${primary} (${handle})` : primary;
}
