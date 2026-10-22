<script lang="ts">
    import { onMount } from 'svelte';
    import { PUBLIC_API_URL } from '$env/static/public';
    import HelpTip from '$lib/HelpTip.svelte';

    /**
     * The Club Health tab of the platform admin page: one row per club with
     * what it has set up (systems, admins, webhook) and whether it is actually being
     * used. Split out of routes/platform-admin/+page.svelte; loads when opened.
     * Shared styles come from platform-admin.css.
     */
    type ClubHealthRow = {
        id: number; name: string; slug: string; active: boolean; region: string | null;
        systems_enabled: number; super_admins: number; has_scope_admin: boolean;
        webhook: boolean; players: number; last_signup_at: string | null;
        pairings_published: boolean;
    };
    let clubsHealth = $state<ClubHealthRow[]>([]);
    let clubsHealthLoading = $state(false);

    async function loadClubsHealth() {
        clubsHealthLoading = true;
        try {
            const r = await fetch(`${PUBLIC_API_URL}/admin/platform/clubs-health`, { credentials: 'include' });
            clubsHealth = r.ok ? await r.json() : [];
        } catch (_) {
            clubsHealth = [];
        }
        clubsHealthLoading = false;
    }

    function daysSince(iso: string | null): number | null {
        if (!iso) return null;
        return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    }
    function lastSignupLabel(iso: string | null): string {
        const d = daysSince(iso);
        if (d == null) return 'never';
        if (d === 0) return 'today';
        if (d === 1) return 'yesterday';
        return `${d}d ago`;
    }
    // A club that isn't really set up or has gone quiet — worth a look.
    function healthFlags(c: ClubHealthRow): string[] {
        const f: string[] = [];
        if (!c.active) f.push('inactive');
        if (c.systems_enabled === 0) f.push('no systems');
        if (c.super_admins === 0) f.push('no admin');
        if (!c.webhook) f.push('no Discord');
        const d = daysSince(c.last_signup_at);
        if (d == null) f.push('no signups');
        else if (d > 21) f.push('quiet 3wk+');
        return f;
    }

    onMount(loadClubsHealth);
</script>

<div class="dash-group">
    <div class="dash-group-header static">
        <span class="dash-group-title">Club Health</span>
            <HelpTip label="club health" text={"Every club on the platform and whether it's actually being used: signups this week, last activity, whether anyone has set it up. The place to spot a club that signed up and then stalled."} />
    </div>
    <div class="dash-group-body">
        <section class="admin-section">
            {#if clubsHealthLoading}
                <p class="muted">Loading…</p>
            {:else if clubsHealth.length === 0}
                <p class="muted">No clubs yet.</p>
            {:else}
                <div class="health-table-wrap">
                    <table class="health-table">
                        <thead>
                            <tr>
                                <th>Club</th>
                                <th>Systems</th>
                                <th>Admins</th>
                                <th>Members</th>
                                <th>Discord</th>
                                <th>Last signup</th>
                                <th>Pairings</th>
                                <th>Flags</th>
                            </tr>
                        </thead>
                        <tbody>
                            {#each clubsHealth as c (c.id)}
                                {@const flags = healthFlags(c)}
                                <tr class:row-flagged={flags.length > 0} class:row-inactive={!c.active}>
                                    <td>
                                        <a href={`https://${c.slug}.calltoarms.app`} class="health-club">{c.name}</a>
                                        <span class="health-region">{c.region ?? '—'}</span>
                                    </td>
                                    <td class="cell-center" class:bad={c.systems_enabled === 0}>{c.systems_enabled}</td>
                                    <td class="cell-center" class:bad={c.super_admins === 0}>
                                        {c.super_admins}{#if c.has_scope_admin}<span class="dot-ok" title="Has a game-system admin"> +</span>{/if}
                                    </td>
                                    <td class="cell-center">{c.players}</td>
                                    <td class="cell-center" class:bad={!c.webhook}>{c.webhook ? '✓' : '✗'}</td>
                                    <td class:bad={daysSince(c.last_signup_at) == null || (daysSince(c.last_signup_at) ?? 0) > 21}>
                                        {lastSignupLabel(c.last_signup_at)}
                                    </td>
                                    <td class="cell-center">{c.pairings_published ? '✓' : '—'}</td>
                                    <td>
                                        {#each flags as f}<span class="flag">{f}</span>{/each}
                                    </td>
                                </tr>
                            {/each}
                        </tbody>
                    </table>
                </div>
            {/if}
        </section>
    </div>
</div>

<style>
    .health-table-wrap { overflow-x: auto; }

    .health-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.85rem;
    }

    .health-table th {
        text-align: left;
        font-size: 0.72rem;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: var(--color-text-faint);
        font-weight: 700;
        padding: 0.4rem 0.6rem;
        border-bottom: 1px solid var(--color-steel-border);
        white-space: nowrap;
    }

    .health-table td {
        padding: 0.55rem 0.6rem;
        border-bottom: 1px solid var(--color-accent-border-soft);
        color: var(--color-text-base);
        vertical-align: top;
    }

    .health-table .cell-center { text-align: center; }

    .health-table td.bad { color: var(--color-accent); font-weight: 700; }

    .row-flagged td { background: rgba(201, 161, 74, 0.05); }

    .row-inactive { opacity: 0.55; }

    .health-club {
        color: var(--color-text-bright);
        font-weight: 600;
        text-decoration: none;
    }

    .health-club:hover { color: var(--color-accent); }

    .health-region { display: block; font-size: 0.75rem; color: var(--color-text-faint); }

    .dot-ok { color: var(--color-accent); }

    .flag {
        display: inline-block;
        font-size: 0.7rem;
        font-weight: 600;
        color: var(--color-accent);
        background: rgba(201, 161, 74, 0.12);
        border: 1px solid var(--color-accent-border);
        border-radius: 999px;
        padding: 0.05rem 0.5rem;
        margin: 0 0.25rem 0.25rem 0;
        white-space: nowrap;
    }
</style>
