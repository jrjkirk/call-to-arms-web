<script lang="ts">
    import { onMount } from 'svelte';
    import { page } from '$app/state';
    import { PUBLIC_API_URL } from '$env/static/public';
    import { factionIconUrl, systemFolder } from '$lib/factions';
    import { getSystemsConfig, FALLBACK_SYSTEMS_CONFIG, type SystemConfig } from '$lib/systemsConfig';

    let apiData = $state<any>(null);
    let pageLoading = $state(true);
    let notFound = $state(false);
    let loadError = $state<string | null>(null);
    // Icon folder per system comes from backend-owned SystemConfig
    // (GET /systems); FALLBACK carries the same values until it loads.
    let systemsConfig = $state<SystemConfig[]>(FALLBACK_SYSTEMS_CONFIG);

    onMount(async () => {
        getSystemsConfig().then((c) => (systemsConfig = c));
        try {
            const r = await fetch(`${PUBLIC_API_URL}/players/${page.params.id}`, { credentials: 'include' });
            if (r.status === 404) {
                notFound = true;
            } else if (!r.ok) {
                loadError = 'Failed to load player.';
            } else {
                apiData = await r.json();
            }
        } catch (_) {
            loadError = 'Network error.';
        }
        pageLoading = false;
    });

    const player = $derived(apiData?.player ?? { name: '' });
    const club = $derived(apiData?.club ?? null);
    const titles = $derived(apiData?.titles ?? []);
    const achievements = $derived(apiData?.achievements ?? []);
    const signupCounts = $derived(apiData?.signup_counts ?? {});
    const factionUsage = $derived(apiData?.faction_usage ?? {});
    const league = $derived(apiData?.league ?? {});
    const hasLeagueGames = $derived((league.total_games ?? 0) > 0);

    let expandedAchievement = $state<string | null>(null);
    let downloadingCard = $state(false);
    let cardError = $state<string | null>(null);

    async function downloadCard() {
        if (downloadingCard) return;
        downloadingCard = true;
        cardError = null;
        try {
            const r = await fetch(`${PUBLIC_API_URL}/players/${page.params.id}/card`, {
                credentials: 'include'
            });
            if (!r.ok) {
                cardError = 'Could not generate a card for this player yet.';
                return;
            }
            const blob = await r.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${player.name || 'player'}-card.png`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (_) {
            cardError = 'Network error.';
        } finally {
            downloadingCard = false;
        }
    }

    const systemsInOrder = ['The Old World', 'The Horus Heresy', 'Kill Team'];

    const visibleSystems = $derived(
        systemsInOrder.filter((s) => (signupCounts[s] ?? 0) > 0)
    );

    const factionSystems = $derived(
        systemsInOrder.filter((s) => s in factionUsage)
    );

    const discord = $derived(apiData?.discord ?? null);
    const recentGamesBySystem = $derived(apiData?.recent_games_by_system ?? {});

    function outcomeClass(result: string | null): string {
        if (result === 'Win') return 'outcome-win';
        if (result === 'Loss') return 'outcome-loss';
        if (result === 'Draw') return 'outcome-draw';
        return '';
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

{#if pageLoading}
    <p style="color: var(--color-text-dim); font-style: italic;">Loading…</p>
{:else if notFound}
    <p style="color: var(--color-text-dim); font-style: italic;">Player not found.</p>
{:else if loadError}
    <p style="color: #fca5a5;">{loadError}</p>
{:else}

<div class="profile-card">
    {#if discord}
        <div class="profile-discord">
            {#if discord.avatar_url}
                <img class="profile-discord-avatar" src={discord.avatar_url} alt="" />
            {/if}
            <span class="profile-discord-name">{discord.discord_name}</span>
        </div>
    {/if}
    <div class="profile-name">{player.name}</div>
    {#if club || titles.length > 0}
        <div class="profile-titles">
            {#if club}
                <span class="profile-club-chip">{club.name}</span>
            {/if}
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
                        {#if factionIconUrl(row.name, systemFolder(sysName, systemsConfig))}
                            <img src={factionIconUrl(row.name, systemFolder(sysName, systemsConfig))} alt="" />
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

    <div class="card-download-row">
        <button class="card-download-button" onclick={downloadCard} disabled={downloadingCard} type="button">
            {downloadingCard ? 'Generating…' : 'Download Card'}
        </button>
        {#if cardError}
            <span class="card-download-error">{cardError}</span>
        {/if}
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

{/if}

{#each systemsInOrder as sysName}
    {@const games = recentGamesBySystem[sysName] ?? []}
    {#if games.length > 0}
        <div class="section-title">Recent {sysName} Games</div>
        <div class="results">
            {#each games as g}
                <div class="result-row">
                    <span class="result-date">{g.week}</span>
                    {#if g.result}
                        <span class={outcomeClass(g.result) + ' result-outcome'}>{g.result.toUpperCase()}</span>
                    {/if}
                    <span class="result-detail">
                        <em>{g.your_faction ?? '?'}</em>
                        {#if g.opponent_name}
                            <span class="result-vs">vs</span>
                            <strong>{g.opponent_name}</strong>
                            (<em>{g.opponent_faction ?? '?'}</em>)
                        {:else}
                            <span class="result-vs result-bye">— BYE</span>
                        {/if}
                    </span>
                </div>
            {/each}
        </div>
    {/if}
{/each}
{/if}

<style>
    .back-link { margin: 0 0 1rem; color: var(--color-text-dim); }
    .back-link a { text-decoration: none; }
    .back-link a:hover { color: var(--color-text-bright); }

    .profile-card {
        background: var(--color-sidebar-bg);
        border: 1px solid var(--color-accent-border);
        border-radius: var(--radius);
        padding: 18px 22px;
        margin-bottom: 14px;
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
    }

    .profile-discord {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-bottom: 8px;
    }

    .profile-discord-avatar {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        object-fit: cover;
        border: 1px solid var(--color-accent-border-soft);
    }

    .profile-discord-name {
        font-size: 0.85rem;
        color: var(--color-text-dim);
        font-style: italic;
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
        border-radius: var(--radius);
        font-size: 0.82rem;
    }

    .profile-club-chip {
        background: var(--color-surface-dark);
        border: 1px solid var(--color-steel-border);
        color: var(--color-text-dim);
        padding: 3px 10px;
        border-radius: var(--radius);
        font-size: 0.82rem;
    }

    .card-download-row {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin: 0.9rem 0 1.4rem;
    }

    .card-download-button {
        background: var(--color-accent);
        border: 1px solid var(--color-accent);
        color: #1b1608;
        padding: 0.6rem 1.2rem;
        border-radius: var(--radius);
        font-size: 0.9rem;
        font-weight: 700;
        font-family: inherit;
        cursor: pointer;
        transition: background 0.1s ease, border-color 0.1s ease;
    }

    .card-download-button:hover:not(:disabled) {
        background: var(--color-accent-soft);
        box-shadow: 0 4px 16px var(--color-accent-glow);
    }

    .card-download-button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    .card-download-error {
        color: #f87171;
        font-size: 0.85rem;
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
        border-radius: var(--radius);
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
        border-radius: var(--radius);
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
        border-radius: var(--radius);
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
        border-radius: var(--radius);
        padding: 0.5rem;
        margin: 0.5rem 0 1rem;
    }

    .elo-svg { width: 100%; height: auto; }

    .results { background: rgba(0, 0, 0, 0.15); border-radius: var(--radius); padding: 0.25rem 0.75rem; }

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
    .result-bye { color: var(--color-text-dim); font-style: italic; font-weight: 400; }
</style>