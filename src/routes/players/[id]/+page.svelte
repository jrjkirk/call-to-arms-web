<script lang="ts">
    import { factionIconUrl, systemFolder } from '$lib/factions';

    let { data } = $props();

    const player = $derived(data.player);
    const titles = $derived(data.titles ?? []);
    const achievements = $derived(data.achievements ?? []);
    const signupCounts = $derived(data.signup_counts ?? {});
    const factionUsage = $derived(data.faction_usage ?? {});
    const league = $derived(data.league ?? {});
    const hasLeagueGames = $derived((league.total_games ?? 0) > 0);

    let expandedAchievement = $state<string | null>(null);

    const systemsInOrder = ['The Old World', 'The Horus Heresy', 'Kill Team'];

    const visibleSystems = $derived(
        systemsInOrder.filter((s) => (signupCounts[s] ?? 0) > 0)
    );

    const factionSystems = $derived(
        systemsInOrder.filter((s) => s in factionUsage)
    );

    function outcomeFor(r: any): { label: string; cls: string } {
        if (r.result === 'Draw') return { label: 'DRAW', cls: 'outcome-draw' };
        const isP1 = r.player_1_id === player.id;
        const won = (r.result === 'Player 1 Victory' && isP1) || (r.result === 'Player 2 Victory' && !isP1);
        return won ? { label: 'WIN', cls: 'outcome-win' } : { label: 'LOSS', cls: 'outcome-loss' };
    }

    function opponentOf(r: any) {
        const isP1 = r.player_1_id === player.id;
        return {
            name: isP1 ? r.player_2_name : r.player_1_name,
            faction: isP1 ? r.player_2_faction : r.player_1_faction,
            myFaction: isP1 ? r.player_1_faction : r.player_2_faction
        };
    }

    function factionUsageRows(facs: Record<string, number>) {
        const entries = Object.entries(facs).sort((a, b) => b[1] - a[1]);
        const max = entries.length ? Math.max(...entries.map(([, c]) => c)) : 1;
        return entries.map(([name, count]) => ({
            name,
            count,
            pct: Math.round((100 * count) / max)
        }));
    }

    function toggleAchievement(name: string) {
        expandedAchievement = expandedAchievement === name ? null : name;
    }
</script>

<p class="back-link"><a href="/players">← All players</a></p>

<div class="profile-card">
    <div class="profile-name">{player.name}</div>
    {#if titles.length > 0}
        <div class="profile-titles">
            {#each titles as t}
                <span class="profile-title-chip">{t}</span>
            {/each}
        </div>
    {/if}
</div>

{#if achievements.length > 0}
    <div class="section-title">Achievements</div>
    <div class="achievement-grid">
        {#each achievements as ach}
            <button
                class="achievement-chip"
                class:expanded={expandedAchievement === ach.name}
                onclick={() => toggleAchievement(ach.name)}
                type="button"
            >
                🏅 {ach.name}
            </button>
        {/each}
    </div>
    {#if expandedAchievement}
        {@const found = achievements.find((a) => a.name === expandedAchievement)}
        {#if found}
            <div class="achievement-detail">
                <strong>{found.name}</strong>
                <p>{found.description}</p>
            </div>
        {/if}
    {/if}
{/if}

{#if visibleSystems.length > 0}
    <div class="section-title">Games Played</div>
    <div class="stat-row">
        {#each visibleSystems as s}
            <div class="stat-card">
                <div class="stat-label">{s}</div>
                <div class="stat-value">{signupCounts[s]}</div>
            </div>
        {/each}
    </div>
{/if}

{#if factionSystems.length > 0}
    <div class="section-title">Faction Breakdown</div>
    <div class="faction-systems">
        {#each factionSystems as sysName}
            <div class="faction-box">
                <div class="faction-box-label">{sysName}</div>
                {#each factionUsageRows(factionUsage[sysName]) as row}
                    <div class="faction-row">
                        {#if factionIconUrl(row.name, systemFolder(sysName))}
                            <img src={factionIconUrl(row.name, systemFolder(sysName))} alt="" />
                        {:else}
                            <div class="faction-icon-empty"></div>
                        {/if}
                        <span class="faction-name">{row.name}</span>
                        <div class="faction-bar">
                            <span class="faction-bar-fill" style="width: {row.pct}%"></span>
                        </div>
                        <span class="faction-count">{row.count}</span>
                    </div>
                {/each}
            </div>
        {/each}
    </div>
{/if}

{#if hasLeagueGames}
    <div class="section-title">The Old World League</div>

    <div class="stat-row">
        <div class="stat-card">
            <div class="stat-label">ELO</div>
            <div class="stat-value">{league.rating?.toFixed(0) ?? '—'}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Rank</div>
            <div class="stat-value">#{league.rank ?? '—'}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">W / D / L</div>
            <div class="stat-value">{league.wins}/{league.draws}/{league.losses}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">League Games</div>
            <div class="stat-value">{league.total_games}</div>
        </div>
    </div>

    {#if league.elo_history && league.elo_history.length > 1}
        {@const elos = league.elo_history.map((h: any) => h.elo)}
        {@const yMin = Math.min(...elos) - 20}
        {@const yMax = Math.max(yMin + 40, Math.max(...elos) + 20)}
        {@const range = yMax - yMin}
        {@const n = league.elo_history.length}
        <div class="elo-chart">
            <svg viewBox="0 0 600 240" preserveAspectRatio="none" class="elo-svg">
                <!-- gridlines (4 horizontal divisions) -->
                {#each [0, 1, 2, 3, 4] as i}
                    <line
                        x1="40" x2="580"
                        y1={20 + (i / 4) * 200}
                        y2={20 + (i / 4) * 200}
                        stroke="rgba(180,150,90,0.18)"
                        stroke-width="1"
                    />
                    <text
                        x="36"
                        y={20 + (i / 4) * 200 + 4}
                        fill="#e8e4d8"
                        font-size="10"
                        text-anchor="end"
                    >
                        {Math.round(yMax - (i / 4) * range)}
                    </text>
                {/each}

                <!-- line -->
                <polyline
                    fill="none"
                    stroke="#c9a14a"
                    stroke-width="2.5"
                    points={league.elo_history
                        .map((h: any, i: number) => {
                            const x = 40 + (i / Math.max(1, n - 1)) * 540;
                            const y = 20 + ((yMax - h.elo) / range) * 200;
                            return `${x},${y}`;
                        })
                        .join(' ')}
                />

                <!-- points -->
                {#each league.elo_history as h, i}
                    {@const x = 40 + (i / Math.max(1, n - 1)) * 540}
                    {@const y = 20 + ((yMax - h.elo) / range) * 200}
                    <circle cx={x} cy={y} r="5" fill="#f4e9c8" stroke="#c9a14a" stroke-width="2">
                        <title>{h.label}{h.date ? ` (${h.date})` : ''}: {h.elo}</title>
                    </circle>
                {/each}
            </svg>
        </div>
    {/if}

    {#if league.recent_results && league.recent_results.length > 0}
        <div class="section-title">Recent League Results</div>
        <div class="results">
            {#each league.recent_results as r}
                {@const outcome = outcomeFor(r)}
                {@const opp = opponentOf(r)}
                <div class="result-row">
                    <span class="result-date">{r.result_date}</span>
                    <span class={outcome.cls + ' result-outcome'}>{outcome.label}</span>
                    <span class="result-detail">
                        <em>{opp.myFaction ?? '?'}</em>
                        <span class="result-vs">vs</span>
                        <strong>{opp.name}</strong>
                        (<em>{opp.faction ?? '?'}</em>)
                    </span>
                </div>
            {/each}
        </div>
    {/if}
{/if}

<style>
    .back-link { margin: 0 0 1rem; color: var(--color-text-dim); }
    .back-link a { text-decoration: none; }
    .back-link a:hover { color: var(--color-text-bright); }

    .profile-card {
        background: linear-gradient(135deg, rgba(30, 30, 40, 0.92), rgba(20, 20, 30, 0.95));
        border: 1px solid var(--color-accent-border);
        border-radius: 12px;
        padding: 18px 22px;
        margin-bottom: 14px;
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
    }

    .profile-name {
        font-size: 1.6rem;
        font-weight: 700;
        color: var(--color-text-bright);
    }

    .profile-titles {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 8px;
    }

    .profile-title-chip {
        background: rgba(201, 161, 74, 0.18);
        border: 1px solid rgba(201, 161, 74, 0.45);
        color: var(--color-text-bright);
        padding: 3px 10px;
        border-radius: 12px;
        font-size: 0.82rem;
    }

    .achievement-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
        gap: 0.5rem;
        margin-bottom: 0.5rem;
    }

    .achievement-chip {
        background: rgba(0, 0, 0, 0.25);
        border: 1px solid var(--color-accent-border-soft);
        color: var(--color-text-bright);
        padding: 8px 10px;
        border-radius: 10px;
        font-size: 0.85rem;
        font-family: inherit;
        cursor: pointer;
        text-align: left;
        transition: background 0.1s ease, border-color 0.1s ease;
    }

    .achievement-chip:hover {
        background: rgba(201, 161, 74, 0.10);
        border-color: rgba(201, 161, 74, 0.55);
    }

    .achievement-chip.expanded {
        background: rgba(201, 161, 74, 0.18);
        border-color: var(--color-accent);
    }

    .achievement-detail {
        margin: 0.25rem 0 0.75rem;
        padding: 0.75rem 1rem;
        background: rgba(0, 0, 0, 0.25);
        border: 1px solid var(--color-accent-border-soft);
        border-radius: 10px;
        font-size: 0.9rem;
    }

    .achievement-detail p { margin: 0.25rem 0 0; color: var(--color-text-muted); }

    .faction-systems {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        gap: 0.75rem;
    }

    .faction-box {
        background: rgba(0, 0, 0, 0.25);
        border: 1px solid var(--color-accent-border-soft);
        border-radius: 10px;
        padding: 14px 12px;
    }

    .faction-box-label {
        font-size: 0.85rem;
        color: var(--color-accent);
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 6px;
    }

    .faction-row {
        display: grid;
        grid-template-columns: 22px minmax(60px, 1fr) minmax(40px, 90px) 36px;
        align-items: center;
        gap: 8px;
        padding: 6px 0;
        font-size: 0.88rem;
        min-width: 0;
    }

    .faction-row img { width: 22px; height: 22px; object-fit: contain; }
    .faction-icon-empty { width: 22px; height: 22px; }

    .faction-name {
        color: var(--color-text-bright);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .faction-bar {
        height: 8px;
        background: rgba(0, 0, 0, 0.4);
        border-radius: 4px;
        overflow: hidden;
        border: 1px solid var(--color-accent-border-soft);
    }

    .faction-bar-fill {
        display: block;
        height: 100%;
        background: linear-gradient(90deg, #c9a14a, #d97a2a);
    }

    .faction-count {
        color: var(--color-text-muted);
        text-align: right;
        font-variant-numeric: tabular-nums;
        font-size: 0.85rem;
    }

    .elo-chart {
        background: rgba(0, 0, 0, 0.25);
        border: 1px solid var(--color-accent-border-soft);
        border-radius: 10px;
        padding: 0.5rem;
        margin: 0.5rem 0 1rem;
    }

    .elo-svg { width: 100%; height: auto; }

    .results { background: rgba(0, 0, 0, 0.15); border-radius: 10px; padding: 0.25rem 0.75rem; }

    .result-row {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 4px;
        border-bottom: 1px dashed var(--color-accent-border-soft);
        font-size: 0.92rem;
        flex-wrap: wrap;
    }

    .result-row:last-child { border-bottom: none; }

    .result-date {
        color: var(--color-text-dim);
        min-width: 90px;
        font-variant-numeric: tabular-nums;
    }

    .result-outcome { min-width: 46px; }

    .result-detail { color: var(--color-text-muted); }
    .result-detail em { color: var(--color-text-bright); font-style: italic; }
    .result-detail strong { color: var(--color-text-bright); font-weight: 600; }
    .result-vs { color: var(--color-accent); font-weight: 700; padding: 0 2px; }
</style>