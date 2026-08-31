<script lang="ts">
    import { onMount } from 'svelte';
    import { page } from '$app/state';
    import { PUBLIC_API_URL } from '$env/static/public';
    import HelpTip from '$lib/HelpTip.svelte';

    const id = $derived(page.params.id);

    let t = $state<any>(null);
    let loading = $state(true);
    let error = $state<string | null>(null);
    let busy = $state(false);
    let tab = $state<'rounds' | 'entries' | 'standings' | 'schedule' | 'scoring'>('rounds');

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

    const STAGES = [
        { key: 'draft', label: 'Draft' },
        { key: 'open', label: 'Entries open' },
        { key: 'closed', label: 'Entries closed' },
        { key: 'running', label: 'Under way' },
        { key: 'finished', label: 'Finished' }
    ];

    /** One sentence telling a first-time TO what to do now. Derived from the
        actual state rather than a static checklist, so it stays true. */
    const nextStep = $derived.by(() => {
        if (!t) return '';
        const checked = t.entries.filter((e: any) => e.status === 'checked_in').length;
        const registered = t.entries.filter((e: any) => e.status === 'registered').length;
        if (t.status === 'draft')
            return 'Set your rounds and schedule, then move to Entries open so players can register.';
        if (t.status === 'open' && t.entries.length === 0)
            return 'Waiting for entries. You can also add players yourself on the Players tab.';
        if (t.status === 'open')
            return `${t.entries.length} entered. Close entries when you're ready, or leave them open until the morning.`;
        const last = t.rounds?.length ? t.rounds[t.rounds.length - 1] : null;
        if (checked === 0 && registered)
            return `Check in the ${registered} player${registered === 1 ? '' : 's'} who have turned up — only checked-in players get paired.`;
        if (!last) return `${checked} checked in. Generate round 1 when everyone's here.`;
        if (last.status === 'paired')
            return `Round ${last.round_no} is paired but not published. Players can't see it yet.`;
        const open = last.games.filter((g: any) => !g.result).length;
        if (open) return `Round ${last.round_no} is running — ${open} result${open === 1 ? '' : 's'} still to come in.`;
        if (allRoundsDone) return 'Every round is done. Mark the event finished to lock the standings.';
        return `Round ${last.round_no} is complete. Generate round ${last.round_no + 1}.`;
    });

    /** "Sat 14 – Sunday 15 November" for a multi-day event, one date otherwise.
        A two-day event showing only its first date simply reads as wrong. */
    const dateRange = $derived.by(() => {
        if (!t) return '';
        if (!t.end_date || t.end_date === t.date) return dayLabel(t.date);
        const a = new Date(t.date + 'T00:00:00');
        const b = new Date(t.end_date + 'T00:00:00');
        const sameMonth = a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
        const first = a.toLocaleDateString('en-GB',
            sameMonth ? { weekday: 'short', day: 'numeric' }
                      : { weekday: 'short', day: 'numeric', month: 'long' });
        return `${first} – ${dayLabel(t.end_date)}`;
    });

    function longDay(iso: string): string {
        return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
            weekday: 'long', day: 'numeric', month: 'long'
        });
    }

    /** Schedule rows are edited as a whole list — the server renumbers rounds
        by running order, so moving a row is the same operation as editing it. */
    function saveSchedule(rows: any[]) {
        call('', 'PATCH', { schedule: rows });
    }
    function editRow(row: any, patch: Record<string, unknown>) {
        saveSchedule(t.schedule.map((r: any) => (r === row ? { ...r, ...patch } : r)));
    }
    function removeRow(row: any) {
        saveSchedule(t.schedule.filter((r: any) => r !== row));
    }
    function addBreak(day: number) {
        const onDay = t.schedule.filter((r: any) => r.day === day);
        const after = onDay.length ? onDay[onDay.length - 1].end : '12:00';
        saveSchedule([...t.schedule,
            { kind: 'break', day, label: 'Break', start: after, end: after }]);
    }

    const TB_LABEL: Record<string, string> = {
        sos: 'Strength of schedule', diff: 'Differential', vp: 'Victory points',
        wins: 'Games won', sports: 'Sportsmanship', paint: 'Painting', h2h: 'Head to head'
    };

    /** Patch the scoring policy. Merged server-side, so a partial save can't
        reset a knob this screen didn't send. */
    async function save(patch: Record<string, unknown>) {
        await call('', 'PATCH', { scoring: patch });
    }

    function toggleTiebreak(tb: string) {
        const cur: string[] = [...(t.scoring.tiebreakers ?? [])];
        const i = cur.indexOf(tb);
        if (i >= 0) cur.splice(i, 1); else cur.push(tb);
        save({ tiebreakers: cur });
    }
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
            {dateRange}{t.system ? ` · ${t.system}` : ''}
            {t.points_limit ? ` · ${t.points_limit} pts` : ''}
            · {t.rounds_total} round{t.rounds_total === 1 ? '' : 's'}{t.days > 1 ? ` over ${t.days} days` : ''}
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
            <!-- A first-time TO's biggest question is "what do I do now", so
                 the current step is stated before any of the controls. -->
            <div class="next-step">
                <span class="next-label">Next</span>
                <span>{nextStep}</span>
            </div>

            <div class="stage">
                <span class="stage-label">
                    Stage
                    <HelpTip label="event stage" text={"Draft is your private workspace — players can't see the event at all.\n\nEntries open lets people register. Closed stops new entries but keeps everyone already in.\n\nUnder way is set for you when you generate the first round. Finished locks the standings.\n\nYou can move back and forth freely, so reopening entries for a latecomer is one click."} />
                </span>
                <div class="stage-track">
                    {#each STAGES as st}
                        <button class="stage-btn" class:on={t.status === st.key}
                                disabled={busy}
                                onclick={() => call('', 'PATCH', { status: st.key })}>{st.label}</button>
                    {/each}
                </div>
            </div>

            <div class="to-bar">
                <button class="secondary-button" disabled={busy}
                        onclick={() => call('/check-in-all')}>Check everyone in</button>
                <HelpTip label="check-in" text={"Only checked-in players are paired. Anyone who registered but hasn't turned up is left out rather than given an opponent who then sits alone for an hour.\n\nYou can also check people in one at a time on the Players tab."} />
                {#if !allRoundsDone}
                    <button class="primary-button" disabled={busy}
                            onclick={() => call('/rounds')}>
                        Generate round {(t.rounds?.length ?? 0) + 1}
                    </button>
                    <HelpTip label="generating a round" text={"Round one is random, or by seed if you've set seeding. Later rounds pair players on matching records, avoiding anyone they have already played.\n\nThe previous round needs every result in first — pairing on half-finished records produces a table that is simply wrong.\n\nNothing is shown to players until you publish the round."} />
                {:else}
                    <span class="a-note done-note">All {t.rounds_total} rounds generated.</span>
                {/if}
            </div>
        {/if}

        <div class="tabs">
            <button class="tab" class:on={tab === 'rounds'} onclick={() => (tab = 'rounds')}>Rounds</button>
            <button class="tab" class:on={tab === 'standings'} onclick={() => (tab = 'standings')}>Standings</button>
            <button class="tab" class:on={tab === 'entries'} onclick={() => (tab = 'entries')}>
                Players ({t.entries.length})
            </button>
            <button class="tab" class:on={tab === 'schedule'} onclick={() => (tab = 'schedule')}>Schedule</button>
            {#if isAdmin}
                <button class="tab" class:on={tab === 'scoring'} onclick={() => (tab = 'scoring')}>Scoring</button>
            {/if}
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
                            <HelpTip label="publishing a round" text={"Players can't see a round until you publish it. Look the pairings over first — swap a table, fix a name — then publish and it appears on everyone's page.\n\nRe-pair throws the round away and generates it again, and is only possible while no results are in."} />
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
            <!-- The sort key belongs next to the table it sorted. A result
                 nobody can check against a published rule is the complaint
                 that shaped this whole scoring engine. -->
            {#if t.scoring_explained?.length}
                <details class="formula">
                    <summary>How this event is scored</summary>
                    <ul>{#each t.scoring_explained as line}<li>{line}</li>{/each}</ul>
                </details>
            {/if}
            {#if !t.standings.length}
                <p class="a-note">Standings appear once the first results are in.</p>
            {:else}
                <div class="table-scroll">
                    <table class="standings">
                        <thead>
                            <tr>
                                <th>#</th><th>Player</th><th>Pts</th><th>W–D–L</th>
                                <th>VP</th><th>Diff</th><th>SoS</th>
                                {#if t.scoring?.sports_enabled}<th>Sport</th>{/if}
                                {#if t.scoring?.painting_enabled}<th>Paint</th>{/if}
                            </tr>
                        </thead>
                        <tbody>
                            {#each t.standings as s (s.entry_id)}
                                <tr class:dropped={s.dropped} class:me={s.entry_id === t.my_entry_id}>
                                    <td>{s.rank}</td>
                                    <td>
                                        {s.name}
                                        {#if s.bracket}<span class="tag">{s.bracket}</span>{/if}
                                        {#if s.dropped}<span class="tag">dropped</span>{/if}
                                    </td>
                                    <td class="num">{s.points}</td>
                                    <td class="num">{s.wins}–{s.draws}–{s.losses}</td>
                                    <td class="num">{s.raw_vp}</td>
                                    <td class="num">{s.diff > 0 ? '+' : ''}{s.diff}</td>
                                    <td class="num">{s.sos}</td>
                                    {#if t.scoring?.sports_enabled}<td class="num">{s.sports ?? '—'}</td>{/if}
                                    {#if t.scoring?.painting_enabled}<td class="num">{s.painting ?? '—'}</td>{/if}
                                </tr>
                            {/each}
                        </tbody>
                    </table>
                </div>
            {/if}

        {:else if tab === 'schedule'}
            {#if isAdmin}
                <div class="form-grid">
                    <label class="field">
                        <span class="field-label">Days
                            <HelpTip label="multi-day events" text={"How many days the event runs over. Rounds are spread across them, earlier days taking the extra when it doesn't divide evenly — people leave early on the last day, not the first.\n\nChanging this rebuilds the running order below."} /></span>
                        <input class="field-input" type="number" min="1" max="7" value={t.days}
                               onchange={(e) => call('', 'PATCH', { days: Number(e.currentTarget.value) })} />
                    </label>
                    <label class="field">
                        <span class="field-label">Rounds
                            <HelpTip label="rounds" text={"Total across the whole event, not per day. Five rounds over two days is three then two."} /></span>
                        <input class="field-input" type="number" min="1" max="12" value={t.rounds_total}
                               onchange={(e) => call('', 'PATCH', { rounds: Number(e.currentTarget.value) })} />
                    </label>
                    <label class="field">
                        <span class="field-label">Round length
                            <HelpTip label="round length" text={"In minutes, and only used to lay the running order out. It enforces nothing on the day — edit any row afterwards and your version is kept."} /></span>
                        <input class="field-input" type="number" min="30" max="480" step="15" value={t.round_minutes}
                               onchange={(e) => call('', 'PATCH', { round_minutes: Number(e.currentTarget.value) })} />
                    </label>
                    <label class="field">
                        <span class="field-label">First round starts
                            <HelpTip label="start time" text={"When round one begins each day. Everything else is laid out from here."} /></span>
                        <input class="field-input" type="time" value={t.start_time ?? '09:30'}
                               onchange={(e) => call('', 'PATCH', { start_time: e.currentTarget.value })} />
                    </label>
                </div>
                {#if t.schedule_is_default}
                    <p class="a-note">
                        A suggested running order, built from the settings above. Edit any
                        row and it becomes yours.
                    </p>
                {/if}
            {/if}

            {#each t.day_dates as d, i}
                {@const dayNo = i + 1}
                {@const items = t.schedule.filter((r) => r.day === dayNo)}
                <div class="sched-day">
                    <h3 class="round-title">
                        {t.day_dates.length > 1 ? `Day ${dayNo} · ` : ''}{longDay(d)}
                    </h3>
                    {#if !items.length}<p class="a-note">Nothing scheduled this day.</p>{/if}
                    {#each items as row}
                        <div class="sched-row" class:brk={row.kind === 'break'}>
                            {#if isAdmin}
                                <input class="field-input time" type="time" value={row.start}
                                       onchange={(e) => editRow(row, { start: e.currentTarget.value })} />
                                <span class="dash">–</span>
                                <input class="field-input time" type="time" value={row.end}
                                       onchange={(e) => editRow(row, { end: e.currentTarget.value })} />
                            {:else}
                                <span class="sched-time">{row.start}–{row.end}</span>
                            {/if}
                            <span class="sched-what">
                                {#if row.kind === 'round'}
                                    Round {row.round}
                                {:else if isAdmin}
                                    <input class="field-input" type="text" value={row.label}
                                           onchange={(e) => editRow(row, { label: e.currentTarget.value })} />
                                {:else}
                                    {row.label}
                                {/if}
                            </span>
                            {#if isAdmin && row.kind === 'break'}
                                <button class="res" disabled={busy} onclick={() => removeRow(row)}>Remove</button>
                            {/if}
                        </div>
                    {/each}
                    {#if isAdmin}
                        <button class="res add-break" disabled={busy}
                                onclick={() => addBreak(dayNo)}>+ Add a break</button>
                    {/if}
                </div>
            {/each}

        {:else if tab === 'scoring'}
            <p class="a-note">
                Defaults follow what a written post-event review found went wrong elsewhere:
                record decides the table, victory points break ties, and sportsmanship
                never outweighs a game.
            </p>
            <div class="form-grid">
                <label class="field">
                    <span class="field-label">Ranked primarily on</span>
                    <select class="field-select" value={t.scoring.primary}
                            onchange={(e) => save({ primary: e.currentTarget.value })}>
                        <option value="wins">Win/draw/loss record</option>
                        <option value="vp">Total victory points</option>
                        <option value="composite">Record and VP combined</option>
                    </select>
                </label>
                <label class="field">
                    <span class="field-label">Victory points</span>
                    <select class="field-select" value={t.scoring.vp_mode}
                            onchange={(e) => save({ vp_mode: e.currentTarget.value })}>
                        <option value="raw">Counted in full</option>
                        <option value="capped">Capped per game</option>
                        <option value="normalised">Scored within each round</option>
                    </select>
                </label>
                {#if t.scoring.vp_mode === 'capped'}
                    <label class="field">
                        <span class="field-label">Cap per game</span>
                        <input class="field-input" type="number" value={t.scoring.vp_cap ?? 40}
                               onchange={(e) => save({ vp_cap: Number(e.currentTarget.value) })} />
                    </label>
                {/if}
                <label class="field">
                    <span class="field-label">A bye is worth</span>
                    <select class="field-select" value={t.scoring.bye_vp_mode}
                            onchange={(e) => save({ bye_vp_mode: e.currentTarget.value })}>
                        <option value="own_average">That player's own average</option>
                        <option value="field_average">The round's field average</option>
                        <option value="fixed">A fixed score</option>
                    </select>
                </label>
            </div>

            <h3 class="a-subtitle">Sportsmanship</h3>
            <label class="check-row">
                <input type="checkbox" checked={t.scoring.sports_enabled}
                       onchange={(e) => save({ sports_enabled: e.currentTarget.checked })} />
                <span>Collect a sportsmanship score each round</span>
            </label>
            {#if t.scoring.sports_enabled}
                <div class="form-grid">
                    <label class="field">
                        <span class="field-label">How it counts</span>
                        <select class="field-select" value={t.scoring.sports_mode}
                                onchange={(e) => save({ sports_mode: e.currentTarget.value })}>
                            <option value="tiebreak">Tiebreaker only</option>
                            <option value="bonus">Bonus points</option>
                            <option value="multiplier">Multiplier</option>
                        </select>
                    </label>
                    <label class="field">
                        <span class="field-label">Out of</span>
                        <input class="field-input" type="number" min="1" max="10"
                               value={t.scoring.sports_scale_max}
                               onchange={(e) => save({ sports_scale_max: Number(e.currentTarget.value) })} />
                    </label>
                </div>
                <label class="check-row">
                    <input type="checkbox" checked={t.scoring.sports_drop_lowest}
                           onchange={(e) => save({ sports_drop_lowest: e.currentTarget.checked })} />
                    <span>Drop each player's lowest rating, so one sore-loser score can't swing an event</span>
                </label>
            {/if}

            <h3 class="a-subtitle">Painting</h3>
            <label class="check-row">
                <input type="checkbox" checked={t.scoring.painting_enabled}
                       onchange={(e) => save({ painting_enabled: e.currentTarget.checked })} />
                <span>Score painting</span>
            </label>
            {#if t.scoring.painting_enabled}
                <div class="form-grid">
                    <label class="field">
                        <span class="field-label">How it counts</span>
                        <select class="field-select" value={t.scoring.painting_mode}
                                onchange={(e) => save({ painting_mode: e.currentTarget.value })}>
                            <option value="tiebreak">Tiebreaker only</option>
                            <option value="bonus">Bonus points</option>
                        </select>
                    </label>
                    <label class="field">
                        <span class="field-label">Out of</span>
                        <input class="field-input" type="number" min="1" max="100"
                               value={t.scoring.painting_max}
                               onchange={(e) => save({ painting_max: Number(e.currentTarget.value) })} />
                    </label>
                </div>
            {/if}

            <h3 class="a-subtitle">Ties are broken by</h3>
            <div class="tb-row">
                {#each ['sos', 'diff', 'vp', 'wins', 'sports', 'paint', 'h2h'] as tb}
                    <button class="res" class:on={t.scoring.tiebreakers.includes(tb)}
                            onclick={() => toggleTiebreak(tb)}>
                        {TB_LABEL[tb]}
                        {#if t.scoring.tiebreakers.includes(tb)}
                            <span class="tb-order">{t.scoring.tiebreakers.indexOf(tb) + 1}</span>
                        {/if}
                    </button>
                {/each}
            </div>

            <div class="formula-live">
                {#each t.scoring_explained as line}<p class="a-note">{line}</p>{/each}
            </div>

        {:else}
            {#if isAdmin}
                <div class="add-entry">
                    <HelpTip label="adding players" text={"For someone paying at the door, or a visitor from another club with no profile here — they just need a name.\n\nAdding someone here ignores the capacity limit, because a TO standing in the room knows better than the limit does."} />
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

    .formula {
        margin-bottom: 0.9rem;
        border: 1px solid var(--color-steel-border);
        border-radius: 6px;
        padding: 0.5rem 0.8rem;
        font-size: 0.86rem;
    }
    .formula summary { cursor: pointer; color: var(--color-accent); }
    .formula ul { margin: 0.5rem 0 0; padding-left: 1.1rem; color: var(--color-text-dim); }
    .formula li { margin-bottom: 0.3rem; }

    .formula-live {
        margin-top: 1.2rem; padding-top: 0.8rem;
        border-top: 1px solid var(--color-steel-border);
    }

    .tb-row { display: flex; gap: 0.4rem; flex-wrap: wrap; margin-bottom: 0.5rem; }
    .tb-order {
        margin-left: 0.3rem; font-size: 0.66rem; opacity: 0.8;
    }

    .next-step {
        display: flex; align-items: baseline; gap: 0.6rem; flex-wrap: wrap;
        margin: 1rem 0 0.8rem; padding: 0.7rem 0.9rem;
        border: 1px solid var(--color-accent-border);
        border-radius: var(--radius);
        background: color-mix(in srgb, var(--color-accent) 8%, transparent);
        font-size: 0.92rem;
    }
    .next-label {
        font-size: 0.66rem; text-transform: uppercase; letter-spacing: 0.09em;
        font-weight: 700; color: var(--color-accent);
    }

    .stage { display: flex; align-items: center; gap: 0.7rem; flex-wrap: wrap; margin-bottom: 0.7rem; }
    .stage-label {
        font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.07em;
        color: var(--color-text-dim);
    }
    .stage-track {
        display: flex; flex-wrap: wrap;
        border: 1px solid var(--color-steel-border); border-radius: 999px; overflow: hidden;
    }
    .stage-btn {
        background: none; border: none; border-right: 1px solid var(--color-steel-border);
        color: var(--color-text-dim); font-family: inherit; font-size: 0.78rem;
        padding: 0.35rem 0.8rem; cursor: pointer; white-space: nowrap;
    }
    .stage-btn:last-child { border-right: none; }
    .stage-btn:hover:not(.on) { background: rgba(201, 161, 74, 0.08); color: var(--color-text-bright); }
    .stage-btn.on { background: var(--color-accent); color: #1b1206; font-weight: 700; }

    .sched-day { margin-bottom: 1.4rem; }
    .sched-row {
        display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;
        padding: 0.35rem 0; border-bottom: 1px solid var(--color-steel-border);
    }
    .sched-row.brk { opacity: 0.8; }
    .sched-row .time { width: 7.5rem; }
    .sched-time { font-variant-numeric: tabular-nums; color: var(--color-text-dim); width: 9rem; }
    .sched-what { flex: 1 1 10rem; font-weight: 600; color: var(--color-text-bright); }
    .sched-row.brk .sched-what { font-weight: 400; color: var(--color-text-dim); }
    .dash { color: var(--color-text-dim); }
    .add-break { margin-top: 0.6rem; }

    .back { display: inline-block; margin-top: 1rem; color: var(--color-accent); font-size: 0.85rem; }
</style>
