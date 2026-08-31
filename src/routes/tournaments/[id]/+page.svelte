<script lang="ts">
    import { onMount } from 'svelte';
    import { page } from '$app/state';
    import { PUBLIC_API_URL } from '$env/static/public';

    const id = $derived(page.params.id);

    let t = $state<any>(null);
    let loading = $state(true);
    let error = $state<string | null>(null);
    let busy = $state(false);
    let tab = $state<'rounds' | 'entries' | 'standings'>('rounds');

    // Entry the TO is adding at the door
    let newName = $state('');
    let newFaction = $state('');

    async function load() {
        try {
            const r = await fetch(`${PUBLIC_API_URL}/tournaments/${id}`, { credentials: 'include' });
            if (!r.ok) { error = 'That event could not be found.'; return; }
            t = await r.json();
            error = null;
        } catch (_) {
            error = 'Could not reach the app just now.';
        } finally {
            loading = false;
        }
    }
    onMount(load);

    async function call(path: string, method = 'POST', body?: any) {
        busy = true; error = null;
        try {
            const r = await fetch(`${PUBLIC_API_URL}/tournaments/${id}${path}`, {
                method, credentials: 'include',
                headers: body ? { 'Content-Type': 'application/json' } : undefined,
                body: body ? JSON.stringify(body) : undefined
            });
            if (!r.ok) error = (await r.json().catch(() => ({}))).detail || 'That did not work.';
            await load();
        } finally {
            busy = false;
        }
    }

    const isAdmin = $derived(t?.is_admin === true);
    const latestRound = $derived(t?.rounds?.length ? t.rounds[t.rounds.length - 1] : null);
    const allRoundsDone = $derived(t && t.rounds.length >= t.rounds_total);

    // The single most-looked-at thing at an event: where am I and who am I playing.
    const myGame = $derived.by(() => {
        if (!t?.my_entry_id || !t.rounds?.length) return null;
        for (let i = t.rounds.length - 1; i >= 0; i--) {
            const r = t.rounds[i];
            if (r.status === 'paired') continue;
            const g = r.games.find(
                (g: any) => g.a.entry_id === t.my_entry_id || g.b?.entry_id === t.my_entry_id
            );
            if (g) {
                const meIsA = g.a.entry_id === t.my_entry_id;
                return {
                    round: r.round_no, table: g.table,
                    opponent: meIsA ? g.b?.name : g.a.name,
                    result: g.result
                };
            }
        }
        return null;
    });

    function dayLabel(iso: string): string {
        return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
        });
    }

    const STATUS_LABEL: Record<string, string> = {
        draft: 'Draft', open: 'Entries open', closed: 'Entries closed',
        running: 'Under way', finished: 'Finished'
    };
</script>

<svelte:head><title>{t?.name ?? 'Event'} · Call to Arms</title></svelte:head>

<div class="container">
{#if loading}
    <p class="a-note">Loading…</p>
{:else if error && !t}
    <div class="a-card"><p class="a-note">{error}</p>
        <a class="secondary-button" href="/tournaments">All events</a></div>
{:else if t}
    <div class="a-card">
        <div class="a-head">
            <h1 class="a-title">{t.name}</h1>
            <span class="a-head-end pill" class:live={t.status === 'running'}>
                {STATUS_LABEL[t.status] ?? t.status}
            </span>
        </div>
        <p class="a-note">
            {dayLabel(t.date)}{t.system ? ` · ${t.system}` : ''}
            {t.points_limit ? ` · ${t.points_limit} pts` : ''}
            · {t.rounds_total} rounds
        </p>
        {#if t.blurb}<p class="a-note">{t.blurb}</p>{/if}

        <!-- Borrowed from how BCP and Hololith open: the one thing a player at
             an event wants is their table number, so it leads. -->
        {#if myGame}
            <div class="my-game">
                <span class="my-game-round">Round {myGame.round}</span>
                {#if myGame.opponent}
                    <span class="my-game-line">
                        You're playing <strong>{myGame.opponent}</strong>
                    </span>
                    {#if myGame.table}<span class="my-game-table">Table {myGame.table}</span>{/if}
                {:else}
                    <span class="my-game-line">You have the bye this round.</span>
                {/if}
            </div>
        {:else if t.my_entry_id}
            <p class="a-note">You're entered. Your table will show here once the round is published.</p>
        {/if}

        {#if error}<p class="field-error">{error}</p>{/if}

        {#if isAdmin}
            <div class="to-bar">
                {#if t.status === 'draft'}
                    <button class="primary-button" disabled={busy}
                            onclick={() => call('', 'PATCH', { status: 'open' })}>Open entries</button>
                {:else if t.status === 'open'}
                    <button class="secondary-button" disabled={busy}
                            onclick={() => call('', 'PATCH', { status: 'closed' })}>Close entries</button>
                {/if}
                <button class="secondary-button" disabled={busy}
                        onclick={() => call('/check-in-all')}>Check everyone in</button>
                <!-- The API refuses a round past the configured count; the
                     button should not offer one in the first place. -->
                {#if !allRoundsDone}
                    <button class="primary-button" disabled={busy}
                            onclick={() => call('/rounds')}>
                        Generate round {(t.rounds?.length ?? 0) + 1}
                    </button>
                {:else}
                    <span class="a-note done-note">All {t.rounds_total} rounds generated.</span>
                {/if}
                {#if t.status !== 'finished'}
                    <button class="secondary-button" disabled={busy}
                            onclick={() => call('', 'PATCH', { status: 'finished' })}>Finish event</button>
                {/if}
            </div>
        {/if}

        <div class="tabs">
            <button class="tab" class:on={tab === 'rounds'} onclick={() => (tab = 'rounds')}>Rounds</button>
            <button class="tab" class:on={tab === 'standings'} onclick={() => (tab = 'standings')}>Standings</button>
            <button class="tab" class:on={tab === 'entries'} onclick={() => (tab = 'entries')}>
                Players ({t.entries.length})
            </button>
        </div>

        {#if tab === 'rounds'}
            {#if !t.rounds.length}
                <p class="a-note">No rounds yet.</p>
            {/if}
            {#each [...t.rounds].reverse() as r (r.id)}
                <div class="round">
                    <div class="round-head">
                        <h3 class="round-title">Round {r.round_no}</h3>
                        {#if r.status === 'paired'}
                            <span class="pill draft">Not published</span>
                            {#if isAdmin}
                                <button class="secondary-button small" disabled={busy}
                                        onclick={() => call(`/rounds/${r.id}/publish`)}>Publish</button>
                                <button class="danger-button small" disabled={busy}
                                        onclick={() => call(`/rounds/${r.id}`, 'DELETE')}>Re-pair</button>
                            {/if}
                        {/if}
                    </div>
                    <div class="games">
                        {#each r.games as g (g.id)}
                            <div class="game" class:done={!!g.result}>
                                <span class="game-table">{g.table ?? '—'}</span>
                                <span class="game-players">
                                    <span class:won={g.result === 'a'}>{g.a.name}</span>
                                    <span class="vs">vs</span>
                                    <span class:won={g.result === 'b'}>{g.b ? g.b.name : 'BYE'}</span>
                                </span>
                                {#if g.result === 'bye'}
                                    <span class="game-result">Bye</span>
                                {:else if isAdmin}
                                    <span class="game-actions">
                                        <button class="res" class:on={g.result === 'a'} disabled={busy}
                                                onclick={() => call(`/games/${g.id}`, 'PATCH', { result: 'a' })}>1</button>
                                        <button class="res" class:on={g.result === 'draw'} disabled={busy}
                                                onclick={() => call(`/games/${g.id}`, 'PATCH', { result: 'draw' })}>D</button>
                                        <button class="res" class:on={g.result === 'b'} disabled={busy}
                                                onclick={() => call(`/games/${g.id}`, 'PATCH', { result: 'b' })}>2</button>
                                    </span>
                                {:else}
                                    <span class="game-result">
                                        {g.result === 'draw' ? 'Draw' : g.result ? 'Played' : ''}
                                    </span>
                                {/if}
                            </div>
                        {/each}
                    </div>
                </div>
            {/each}

        {:else if tab === 'standings'}
            {#if !t.standings.length}
                <p class="a-note">Standings appear once the first results are in.</p>
            {:else}
                <div class="table-scroll">
                    <table class="standings">
                        <thead>
                            <tr><th>#</th><th>Player</th><th>Pts</th><th>W–D–L</th><th>Diff</th><th>SoS</th></tr>
                        </thead>
                        <tbody>
                            {#each t.standings as s (s.entry_id)}
                                <tr class:dropped={s.dropped} class:me={s.entry_id === t.my_entry_id}>
                                    <td>{s.rank}</td>
                                    <td>{s.name}{#if s.dropped}<span class="tag">dropped</span>{/if}</td>
                                    <td class="num">{s.points}</td>
                                    <td class="num">{s.wins}–{s.draws}–{s.losses}</td>
                                    <td class="num">{s.diff > 0 ? '+' : ''}{s.diff}</td>
                                    <td class="num">{s.sos}</td>
                                </tr>
                            {/each}
                        </tbody>
                    </table>
                </div>
            {/if}

        {:else}
            {#if isAdmin}
                <div class="add-entry">
                    <input class="field-input" type="text" bind:value={newName} placeholder="Name" />
                    <input class="field-input" type="text" bind:value={newFaction} placeholder="Faction (optional)" />
                    <button class="secondary-button" disabled={busy || !newName.trim()}
                            onclick={async () => {
                                await call('/entries', 'POST', { display_name: newName, faction: newFaction });
                                newName = ''; newFaction = '';
                            }}>Add player</button>
                </div>
            {/if}
            <div class="entries">
                {#each t.entries as e (e.id)}
                    <div class="entry" class:out={e.status === 'dropped'}>
                        <span class="entry-name">{e.name}</span>
                        <span class="entry-faction">{e.faction ?? ''}</span>
                        <span class="pill" class:live={e.status === 'checked_in'}>{e.status.replace('_', ' ')}</span>
                        {#if isAdmin}
                            <span class="entry-actions">
                                {#if e.status !== 'checked_in' && e.status !== 'dropped'}
                                    <button class="res" disabled={busy}
                                            onclick={() => call(`/entries/${e.id}`, 'PATCH', { status: 'checked_in' })}>Check in</button>
                                {/if}
                                {#if e.status !== 'dropped'}
                                    <button class="res" disabled={busy}
                                            onclick={() => call(`/entries/${e.id}`, 'PATCH', { status: 'dropped' })}>Drop</button>
                                {/if}
                            </span>
                        {/if}
                    </div>
                {/each}
            </div>
        {/if}
    </div>

    <a class="back" href="/tournaments">← All events</a>
{/if}
</div>

<style>
    .pill {
        font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.06em;
        font-weight: 700; padding: 0.15rem 0.5rem; border-radius: 999px;
        border: 1px solid var(--color-steel-border); color: var(--color-text-dim);
        white-space: nowrap;
    }
    .pill.live { color: var(--color-accent); border-color: var(--color-accent-border); }
    .pill.draft { opacity: 0.75; font-style: italic; }

    .my-game {
        display: flex; align-items: baseline; gap: 0.7rem; flex-wrap: wrap;
        margin: 1rem 0;
        padding: 0.9rem 1.1rem;
        border: 1px solid var(--color-accent-border);
        border-radius: var(--radius);
        background: color-mix(in srgb, var(--color-accent) 10%, transparent);
    }
    .my-game-round {
        font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.08em;
        color: var(--color-accent); font-weight: 700;
    }
    .my-game-line { color: var(--color-text-bright); }
    .my-game-table {
        margin-left: auto; font-size: 1.4rem; font-weight: 700;
        color: var(--color-accent); white-space: nowrap;
    }

    .to-bar { display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center; margin: 1rem 0; }
    .done-note { margin: 0; }

    .tabs { display: flex; gap: 1.2rem; border-bottom: 1px solid var(--color-steel-border); margin: 1.2rem 0 1rem; }
    .tab {
        background: none; border: none; color: var(--color-text-base);
        font-family: inherit; font-size: 0.92rem; padding: 0 0 0.5rem;
        border-bottom: 3px solid transparent; cursor: pointer;
    }
    .tab.on { color: var(--color-accent); border-bottom-color: var(--color-accent-soft); }

    .round { margin-bottom: 1.4rem; }
    .round-head { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; margin-bottom: 0.5rem; }
    .round-title { margin: 0; font-size: 1rem; color: var(--color-text-bright); }

    .games { display: flex; flex-direction: column; gap: 0.35rem; }
    .game {
        display: grid;
        grid-template-columns: 2.6rem 1fr auto;
        align-items: center; gap: 0.8rem;
        padding: 0.5rem 0.7rem;
        border: 1px solid var(--color-steel-border);
        border-radius: 6px;
        background: rgba(0, 0, 0, 0.18);
        font-size: 0.92rem;
    }
    .game.done { opacity: 0.85; }
    .game-table {
        font-weight: 700; color: var(--color-accent);
        font-variant-numeric: tabular-nums; text-align: center;
    }
    .game-players { display: flex; gap: 0.5rem; flex-wrap: wrap; min-width: 0; }
    .vs { color: var(--color-text-dim); }
    .won { color: var(--color-accent); font-weight: 700; }
    .game-result { font-size: 0.78rem; color: var(--color-text-dim); }
    .game-actions { display: flex; gap: 0.25rem; }

    .res {
        background: rgba(0, 0, 0, 0.3);
        border: 1px solid var(--color-steel-border);
        color: var(--color-text-base);
        font-family: inherit; font-size: 0.76rem;
        padding: 0.25rem 0.5rem; border-radius: 5px; cursor: pointer;
    }
    .res:hover { border-color: var(--color-accent-border); }
    .res.on { background: var(--color-accent); border-color: var(--color-accent); color: #1b1206; font-weight: 700; }

    .table-scroll { overflow-x: auto; }
    .standings { width: 100%; border-collapse: collapse; font-size: 0.9rem; min-width: 28rem; }
    .standings th, .standings td {
        text-align: left; padding: 0.45rem 0.6rem;
        border-bottom: 1px solid var(--color-steel-border);
    }
    .standings th {
        font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.07em;
        color: var(--color-text-dim); font-weight: 600;
    }
    .standings .num { font-variant-numeric: tabular-nums; }
    .standings tr.dropped { opacity: 0.5; }
    .standings tr.me { background: color-mix(in srgb, var(--color-accent) 10%, transparent); }
    .tag {
        font-size: 0.66rem; margin-left: 0.4rem; color: var(--color-text-dim);
        text-transform: uppercase; letter-spacing: 0.05em;
    }

    .add-entry { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.9rem; }
    .add-entry .field-input { flex: 1 1 10rem; }

    .entries { display: flex; flex-direction: column; gap: 0.35rem; }
    .entry {
        display: flex; align-items: center; gap: 0.7rem; flex-wrap: wrap;
        padding: 0.45rem 0.7rem;
        border: 1px solid var(--color-steel-border);
        border-radius: 6px; font-size: 0.9rem;
    }
    .entry.out { opacity: 0.55; }
    .entry-name { font-weight: 600; color: var(--color-text-bright); }
    .entry-faction { color: var(--color-text-dim); font-size: 0.82rem; }
    .entry-actions { margin-left: auto; display: flex; gap: 0.3rem; }

    .back { display: inline-block; margin-top: 1rem; color: var(--color-accent); font-size: 0.85rem; }
</style>
