<script lang="ts">
    import { goto } from '$app/navigation';
    import { factionIconUrl, systemFolder } from '$lib/factions';

    let { data } = $props();

    let system = $state(data.system);
    let week = $state(data.week);

    $effect(() => {
        system = data.system;
        week = data.week;
    });

    const systems = ['The Old World', 'The Horus Heresy', 'Kill Team'];

    function applyFilters() {
        const params = new URLSearchParams({ system, week });
        goto(`/pairings?${params}`, { invalidateAll: true });
    }

    function accentClass(gt: string | null | undefined): string {
        if (!gt) return '';
        const k = gt.toLowerCase();
        if (k === 'intro') return 'accent-intro';
        if (k === 'casual') return 'accent-casual';
        if (k === 'escalation') return 'accent-escalation';
        if (k === 'competitive') return 'accent-competitive';
        if (k === 'standard') return 'accent-standard';
        return '';
    }
</script>

<h2 class="page-heading">Weekly Pairings</h2>

<div class="filter-row">
    <div class="field">
        <label class="field-label" for="system">System</label>
        <select id="system" class="field-select" bind:value={system} onchange={applyFilters}>
            {#each systems as s}
                <option value={s}>{s}</option>
            {/each}
        </select>
    </div>

    <div class="field">
        <label class="field-label" for="week">Week (DD/MM/YYYY)</label>
        <input id="week" class="field-input" type="text" bind:value={week} onblur={applyFilters} />
    </div>
</div>

{#if !data.published}
    <div class="empty-state">No pairings published yet for this week/system.</div>
{:else if data.matchups.length === 0}
    <div class="empty-state">No pairings yet.</div>
{:else}
    <div class="stat-row">
        <div class="stat-card">
            <div class="stat-label">Players</div>
            <div class="stat-value">{data.total_players}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Matchups</div>
            <div class="stat-value">{data.total_matchups}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">On Standby</div>
            <div class="stat-value">{data.byes}</div>
        </div>
    </div>

    <div class="matchups">
        {#each data.matchups as m}
            <div class={`matchup-card ${m.is_bye ? 'matchup-bye' : ''} ${accentClass(m.game_type)}`}>
                <div class="player-row player-a">
                    {#if factionIconUrl(m.player_a_faction, systemFolder(data.system))}
                        <img class="matchup-icon" src={factionIconUrl(m.player_a_faction, systemFolder(data.system))} alt="" />
                    {:else}
                        <div class="matchup-icon-empty"></div>
                    {/if}
                    <div class="player-text">
                        <div class="player-name">{m.player_a_name}</div>
                        <div class="player-faction">{m.player_a_faction ?? '—'}</div>
                    </div>
                </div>

                <div class="vs-divider">
                    <span class="vs-line"></span>
                    <span class="vs-label">VS</span>
                    <span class="vs-line"></span>
                </div>

                <div class="player-row player-b">
                    {#if m.player_b_name && factionIconUrl(m.player_b_faction, systemFolder(data.system))}
                        <img class="matchup-icon" src={factionIconUrl(m.player_b_faction, systemFolder(data.system))} alt="" />
                    {:else}
                        <div class="matchup-icon-empty"></div>
                    {/if}
                    <div class="player-text">
                        <div class="player-name">{m.player_b_name ?? 'BYE / Standby'}</div>
                        {#if m.player_b_name}
                            <div class="player-faction">{m.player_b_faction ?? '—'}</div>
                        {/if}
                    </div>
                </div>

                {#if m.game_type || m.eta || m.points}
                    <div class="matchup-meta">
                        {#if m.game_type}
                            <span class="matchup-meta-item">
                                <span class="matchup-meta-label">Type</span>
                                <span class="matchup-meta-value">{m.game_type}</span>
                            </span>
                        {/if}
                        {#if m.eta}
                            <span class="matchup-meta-item">
                                <span class="matchup-meta-label">ETA</span>
                                <span class="matchup-meta-value">{m.eta}</span>
                            </span>
                        {/if}
                        {#if m.points}
                            <span class="matchup-meta-item">
                                <span class="matchup-meta-label">Points</span>
                                <span class="matchup-meta-value">{m.points}</span>
                            </span>
                        {/if}
                    </div>
                {/if}
            </div>
        {/each}
    </div>
{/if}

<style>
    .page-heading { font-size: 1.5rem; margin: 0 0 1rem; }

    .filter-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
        margin-bottom: 1rem;
    }

    @media (max-width: 600px) {
        .filter-row { grid-template-columns: 1fr; }
    }

    .matchups { display: flex; flex-direction: column; gap: 14px; margin-top: 0.5rem; }

    .matchup-card {
        background: linear-gradient(135deg, rgba(30, 30, 40, 0.92) 0%, rgba(20, 20, 30, 0.95) 100%);
        border: 1px solid rgba(180, 150, 90, 0.35);
        border-radius: 12px;
        padding: 18px 20px;
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.04);
        color: #e8e4d8;
        transition: transform 0.15s ease, box-shadow 0.15s ease;
    }

    .matchup-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.06);
    }

    .player-row { display: flex; align-items: center; gap: 14px; }
    .player-row.player-a { justify-content: flex-start; }
    .player-row.player-b { justify-content: flex-start; }

    .player-text { display: flex; flex-direction: column; align-items: flex-start; flex: 1; }

    .player-name {
        font-size: 1.2rem;
        font-weight: 700;
        color: #f4e9c8;
        letter-spacing: 0.2px;
        margin-bottom: 4px;
        text-align: left;
    }

    .player-faction {
        font-size: 0.95rem;
        color: #b8a878;
        font-style: italic;
        text-align: left;
    }

    .matchup-icon {
        width: 48px;
        height: 48px;
        object-fit: contain;
        flex: 0 0 auto;
        filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.5));
    }

    .matchup-icon-empty { width: 48px; height: 48px; flex: 0 0 auto; }

    .vs-divider {
        display: flex;
        align-items: center;
        gap: 10px;
        margin: 12px 0;
    }

    .vs-line { flex: 1; height: 1px; background: rgba(180, 150, 90, 0.35); }

    .vs-label {
        font-size: 1rem;
        font-weight: 800;
        color: var(--color-accent);
        text-shadow: 0 0 8px var(--color-accent-glow);
        letter-spacing: 1px;
    }

    .matchup-meta {
        margin-top: 14px;
        padding-top: 12px;
        border-top: 1px dashed rgba(180, 150, 90, 0.25);
        display: flex;
        justify-content: center;
        gap: 22px;
        font-size: 0.88rem;
        color: #d4c8a0;
        flex-wrap: wrap;
    }

    .matchup-meta-item { display: inline-flex; align-items: center; gap: 6px; }

    .matchup-meta-label {
        opacity: 0.7;
        text-transform: uppercase;
        font-size: 0.72rem;
        letter-spacing: 0.6px;
    }

    .matchup-meta-value { font-weight: 600; color: #f0e4bc; }

    .matchup-bye .player-row.player-b .player-name {
        color: var(--color-text-faint);
        font-style: italic;
        font-weight: 400;
    }

    .accent-casual { border-left: 4px solid #6eb46e; }
    .accent-competitive { border-left: 4px solid #d25050; }
    .accent-intro { border-left: 4px solid #5a9bd4; }
    .accent-escalation { border-left: 4px solid #c9a14a; }
    .accent-standard { border-left: 4px solid #9c8bd1; }

    @media (min-width: 768px) {
        .matchup-card {
            display: grid;
            grid-template-columns: 1fr auto 1fr;
            grid-template-rows: auto auto;
            align-items: center;
            gap: 16px;
        }

        .player-row.player-a {
            grid-column: 1;
            grid-row: 1;
            justify-content: flex-end;
            flex-direction: row-reverse;
            text-align: right;
        }

        .player-row.player-a .player-text { align-items: flex-end; }
        .player-row.player-a .player-name,
        .player-row.player-a .player-faction { text-align: right; }

        .player-row.player-b {
            grid-column: 3;
            grid-row: 1;
            justify-content: flex-start;
        }

        .vs-divider {
            grid-column: 2;
            grid-row: 1;
            flex-direction: column;
            margin: 0;
            gap: 0;
        }

        .vs-divider .vs-line { display: none; }

        .vs-label { font-size: 1.5rem; padding: 0 6px; }

        .matchup-meta {
            grid-column: 1 / -1;
            grid-row: 2;
        }

        .matchup-icon, .matchup-icon-empty { width: 56px; height: 56px; }
        .player-name { font-size: 1.15rem; font-weight: 600; }
        .player-faction { font-size: 0.92rem; }
    }
</style>