<!--
  A night's games, one row each: the label, one player on the left, "v", the
  other mirrored on the right with their icon outermost. The caller's own game
  is picked out in gold, label and "v" both. Players sitting out are listed
  after the games rather than as a half-empty row.

  `detail` adds what the old pairings cards carried under each game (kind of
  game, arrival, points, levels, guest), for the pairings page; the home tab
  leaves it off.
-->
<script lang="ts">
    import FactionIcon from '../FactionIcon.svelte';
    import { gameLabel, type Matchup } from './api';

    let {
        matchups,
        playerId = null,
        folder,
        detail = false
    }: {
        matchups: Matchup[];
        playerId?: number | null;
        folder: string | null | undefined;
        detail?: boolean;
    } = $props();

    const games = $derived(matchups.filter((m) => !m.is_bye));
    const sittingOut = $derived(matchups.filter((m) => m.is_bye));

    function mine(m: Matchup): boolean {
        return playerId != null && (m.player_a_id === playerId || m.player_b_id === playerId);
    }

    function meta(m: Matchup): string[] {
        const out: string[] = [];
        if (m.game_type) out.push(m.game_type);
        if (m.eta) out.push(m.eta);
        if (m.points) out.push(`${Number(m.points).toLocaleString('en-GB')} pts`);
        if (m.prearranged) out.push('Arranged');
        return out;
    }
</script>

<ol class="games">
    {#each games as m, i (m.id ?? `${m.player_a_name}|${m.player_b_name}`)}
        {@const [kind, num] = gameLabel(m, i).split(' ')}
        <li class="game" class:mine={mine(m)}>
            <span class="label"><small>{kind}</small> {num}</span>
            <div class="side">
                <FactionIcon faction={m.player_a_faction} {folder} class="game-icon" />
                <div class="who">
                    <span class="name">
                        {m.player_a_name}
                        {#if detail && m.player_a_level}<span class="lvl">Lvl {m.player_a_level}</span>{/if}
                    </span>
                    <span class="faction">{m.player_a_faction ?? '—'}</span>
                </div>
            </div>
            <span class="v">v</span>
            <div class="side side-b">
                <div class="who">
                    <span class="name">
                        {#if detail && m.player_b_level}<span class="lvl">Lvl {m.player_b_level}</span>{/if}
                        {m.player_b_name}
                        {#if m.player_b_id == null}<span class="guest">guest</span>{/if}
                    </span>
                    <span class="faction">{m.player_b_faction ?? '—'}</span>
                </div>
                <FactionIcon faction={m.player_b_faction} {folder} class="game-icon" />
            </div>
            {#if detail && meta(m).length}
                <div class="meta">{meta(m).join(' · ')}</div>
            {/if}
        </li>
    {/each}
</ol>

{#if sittingOut.length}
    <p class="sitting-out">
        Sitting out: {sittingOut.map((m) => m.player_a_name).join(', ')}
    </p>
{/if}

<style>
    .games {
        list-style: none;
        margin: 0;
        padding: 0;
    }

    .game {
        display: grid;
        grid-template-columns: 76px minmax(0, 1fr) 36px minmax(0, 1fr);
        align-items: center;
        gap: 10px;
        padding: 12px 20px;
        border-bottom: 1px solid #1c2029;
    }

    .game:last-child { border-bottom: none; }

    .game.mine { background: rgba(201, 161, 74, 0.08); }

    .label,
    .v {
        font-family: var(--font-heading);
        font-weight: 700;
        font-size: 1.1rem;
        color: var(--color-text-dim);
        white-space: nowrap;
    }

    .v { text-align: center; }

    .label small { font-size: inherit; }

    .game.mine .label,
    .game.mine .v { color: var(--color-accent); }

    .side {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
    }

    .side-b {
        justify-content: flex-end;
        text-align: right;
    }

    .side :global(.game-icon) {
        width: 34px;
        height: 34px;
        flex: none;
    }

    .who {
        display: flex;
        flex-direction: column;
        min-width: 0;
    }

    .name {
        font-weight: 600;
        color: var(--color-text-bright);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .faction {
        font-size: 0.82rem;
        color: var(--color-text-dim);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .lvl,
    .guest {
        font-size: 0.7rem;
        font-weight: 700;
        color: var(--color-text-dim);
        text-transform: uppercase;
        letter-spacing: 0.04em;
    }

    .meta {
        grid-column: 2 / -1;
        font-size: 0.8rem;
        color: var(--color-text-dim);
        text-align: center;
        margin-top: -2px;
    }

    .sitting-out {
        margin: 0;
        padding: 12px 20px;
        border-top: 1px dashed #343a47;
        font-size: 0.88rem;
        color: var(--color-text-dim);
    }

    @media (max-width: 560px) {
        .game {
            grid-template-columns: 34px minmax(0, 1fr) 14px minmax(0, 1fr);
            gap: 6px;
            padding: 10px 12px;
        }
        .label, .v { font-size: 1.05rem; }
        /* "Game" over the number: the word costs a third of a phone's width
           on one line, and the faction names were paying for it. */
        .label { display: flex; flex-direction: column; align-items: center; line-height: 1; }
        .label small { font-size: 0.6rem; letter-spacing: 0.08em; text-transform: uppercase; }
        .side { gap: 6px; }
        .side :global(.game-icon) { width: 28px; height: 28px; }
        .name { font-size: 0.92rem; }
        .faction { font-size: 0.75rem; }
        .sitting-out { padding: 10px 12px; }
    }
</style>
