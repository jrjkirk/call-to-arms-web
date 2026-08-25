<script lang="ts">
    import { onMount } from 'svelte';
    import { PUBLIC_API_URL } from '$env/static/public';
    import HelpTip from './HelpTip.svelte';

    const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    let cfg = $state<any>(null);
    let profile = $state<any>(null);
    let emailsText = $state('');
    let webhookInput = $state('');
    let webhookBusy = $state(false);
    let webhookMessage = $state<string | null>(null);
    let saving = $state(false);
    let error = $state<string | null>(null);
    let message = $state<string | null>(null);

    async function load() {
        const [c, p] = await Promise.all([
            fetch(`${PUBLIC_API_URL}/venue/admin/config`, { credentials: 'include' }),
            fetch(`${PUBLIC_API_URL}/venue/admin/venue-profile`, { credentials: 'include' })
        ]);
        if (!c.ok || !p.ok) { error = 'Could not load settings.'; return; }
        cfg = await c.json();
        profile = await p.json();
        emailsText = (cfg.notify_emails ?? []).join('\n');
    }
    onMount(load);

    async function save() {
        saving = true; error = null; message = null;
        const [c, p] = await Promise.all([
            fetch(`${PUBLIC_API_URL}/venue/admin/config`, {
                method: 'POST', credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...cfg,
                    notify_emails: emailsText.split('\n').map((e) => e.trim()).filter(Boolean)
                })
            }),
            fetch(`${PUBLIC_API_URL}/venue/admin/venue-profile`, {
                method: 'POST', credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    blurb: profile.blurb,
                    website_url: profile.website_url,
                    discord_url: profile.discord_url,
                    opening_hours: profile.opening_hours
                })
            })
        ]);
        if (c.ok && p.ok) {
            cfg = await c.json();
            profile = await p.json();
            emailsText = (cfg.notify_emails ?? []).join('\n');
            message = 'Saved.';
        } else {
            const bad = !c.ok ? c : p;
            error = (await bad.json().catch(() => ({}))).detail || 'Save failed.';
        }
        saving = false;
    }

    async function saveWebhook() {
        webhookBusy = true; webhookMessage = null; error = null;
        const r = await fetch(`${PUBLIC_API_URL}/venue/admin/webhook`, {
            method: 'POST', credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: webhookInput })
        });
        if (r.ok) { profile = await r.json(); webhookInput = ''; webhookMessage = 'Webhook saved.'; }
        else error = (await r.json().catch(() => ({}))).detail || 'Could not save that webhook.';
        webhookBusy = false;
    }

    async function removeWebhook() {
        if (!confirm('Remove the booking webhook?')) return;
        webhookBusy = true; webhookMessage = null;
        const r = await fetch(`${PUBLIC_API_URL}/venue/admin/webhook`, {
            method: 'DELETE', credentials: 'include'
        });
        if (r.ok) { profile = await r.json(); webhookMessage = 'Webhook removed.'; }
        webhookBusy = false;
    }

    async function testWebhook() {
        webhookBusy = true; webhookMessage = null; error = null;
        const r = await fetch(`${PUBLIC_API_URL}/venue/admin/webhook/test`, {
            method: 'POST', credentials: 'include'
        });
        if (r.ok) webhookMessage = 'Test message sent — check the channel.';
        else error = (await r.json().catch(() => ({}))).detail || 'Test failed.';
        webhookBusy = false;
    }

    // Email switched on with nowhere to send is the one misconfiguration that
    // fails silently — the booking works, staff just never hear about it.
    const emailGoesNowhere = $derived(
        cfg?.notify_email && (cfg?.effective_emails ?? []).length === 0
    );
    const discordGoesNowhere = $derived(cfg?.notify_discord && !profile?.webhook?.configured);
</script>

{#if cfg && profile}
    <!-- ── Bookings ─────────────────────────────────────────────────────── -->
    <div class="a-card">
        <div class="a-head">
            <h2 class="a-title">Bookings</h2>
            <HelpTip
                label="public bookings"
                text={"Off means there's no booking page at all — no button on your club page, and the booking links stop working.\n\nYou need at least one table before this will turn on."}
            />
            <span class="a-head-end a-state" class:is-on={cfg.enabled}>
                {cfg.enabled ? 'Open' : 'Closed'}
            </span>
        </div>
        <label class="check-row">
            <input type="checkbox" bind:checked={cfg.enabled} />
            <span>Take bookings from the public</span>
        </label>

        <h3 class="a-subtitle">When someone books</h3>
        <div class="opt-row">
            <label class="check-row">
                <input type="radio" bind:group={cfg.confirm_mode} value="instant" />
                <span>Confirm it straight away</span>
            </label>
            <label class="check-row">
                <input type="radio" bind:group={cfg.confirm_mode} value="request" />
                <span>Hold it until staff say yes</span>
            </label>
            <HelpTip
                label="confirmation"
                text={"Straight away: the table is theirs the moment they book, and you're told after. This is what stops staff answering booking emails.\n\nHold it: every booking waits for you. It still holds the table while it waits, so an unanswered request blocks the slot."}
            />
        </div>

        <h3 class="a-subtitle">
            How you hear about it
            <HelpTip
                label="notifications"
                text={"Pick whichever suits how your venue is run — a staff Discord, an inbox, both, or neither.\n\nWith both off, bookings still arrive and still show in the Diary. You just won't be told."}
            />
        </h3>

        <label class="check-row notify-row">
            <input type="checkbox" bind:checked={cfg.notify_email} />
            <span>Email</span>
        </label>
        {#if cfg.notify_email}
            <label class="field indented">
                <span class="field-label">Send to <span class="field-label-hint">(one per line)</span></span>
                <textarea class="field-input field-textarea" rows="3" bind:value={emailsText}
                          placeholder="bookings@example.com"></textarea>
            </label>
            {#if emailGoesNowhere}
                <p class="field-error indented">
                    Email is on but there's no address to send to, so bookings will arrive
                    unannounced. Add one above.
                </p>
            {/if}
        {/if}

        <label class="check-row notify-row">
            <input type="checkbox" bind:checked={cfg.notify_discord} />
            <span>Discord</span>
        </label>
        {#if cfg.notify_discord}
            <div class="hook-row indented">
                <span class="hook-label">
                    Booking channel
                    <HelpTip
                        label="webhook"
                        text={"In Discord: Server Settings → Integrations → Webhooks → New Webhook. Pick the channel your staff watch, copy the URL, paste it here.\n\nWe never show the whole URL back — anyone holding it can post to that channel."}
                    />
                </span>
                {#if profile.webhook.configured}
                    <span class="hook-state a-state is-on">Set · {profile.webhook.last_four}</span>
                    <button class="secondary-button" type="button" disabled={webhookBusy} onclick={testWebhook}>Test</button>
                    <button class="danger-button" type="button" disabled={webhookBusy} onclick={removeWebhook}>Remove</button>
                {:else}
                    <input class="field-input hook-input" type="text" bind:value={webhookInput}
                           placeholder="https://discord.com/api/webhooks/…" />
                    <button class="primary-button" type="button"
                            disabled={webhookBusy || !webhookInput.trim()} onclick={saveWebhook}>Save</button>
                {/if}
            </div>
            {#if discordGoesNowhere}
                <p class="field-error indented">
                    Discord is on but no webhook is saved, so nothing will be posted.
                </p>
            {/if}
            {#if webhookMessage}<p class="pairing-message indented">{webhookMessage}</p>{/if}
        {/if}

        <h3 class="a-subtitle">
            Rules
            <HelpTip
                label="booking rules"
                text={"Slot length is how start times are offered — 30 minutes means 18:00, 18:30, 19:00.\n\nNotice is how close to the start someone may still book, so a table can't appear on you with no warning.\n\nPer person caps how many upcoming bookings one account can hold at once. Booking needs a login, so this is what stops one person taking the room."}
            />
        </h3>
        <div class="rules-grid">
            <label class="field">
                <span class="field-label">Slot length</span>
                <select class="field-select" bind:value={cfg.slot_minutes}>
                    <option value={15}>15 min</option>
                    <option value={30}>30 min</option>
                    <option value={60}>1 hour</option>
                </select>
            </label>
            <label class="field">
                <span class="field-label">Shortest booking</span>
                <input class="field-input" type="number" step="15" min="15" max="720" bind:value={cfg.min_duration_minutes} />
            </label>
            <label class="field">
                <span class="field-label">Longest booking</span>
                <input class="field-input" type="number" step="15" min="15" max="720" bind:value={cfg.max_duration_minutes} />
            </label>
            <label class="field">
                <span class="field-label">Notice needed (min)</span>
                <input class="field-input" type="number" min="0" max="10080" bind:value={cfg.lead_time_minutes} />
            </label>
            <label class="field">
                <span class="field-label">Book up to (days)</span>
                <input class="field-input" type="number" min="1" max="365" bind:value={cfg.max_advance_days} />
            </label>
            <label class="field">
                <span class="field-label">Biggest party</span>
                <input class="field-input" type="number" min="1" max="40" bind:value={cfg.max_party_size} />
            </label>
            <label class="field">
                <span class="field-label">Bookings per person</span>
                <input class="field-input" type="number" min="1" max="50" bind:value={cfg.max_active_bookings_per_user} />
            </label>
        </div>

        <h3 class="a-subtitle">
            What bookers see
            <HelpTip
                label="booking page text"
                text={"The blurb sits on the booking form — parking, food, house rules.\n\nThe confirmation note goes on the confirmation and in their email: door codes, where the terrain lives, who to ask for."}
            />
        </h3>
        <label class="field">
            <span class="field-label">On the booking form</span>
            <textarea class="field-input field-textarea" rows="2" bind:value={cfg.booking_blurb}></textarea>
        </label>
        <label class="field">
            <span class="field-label">On the confirmation</span>
            <textarea class="field-input field-textarea" rows="2" bind:value={cfg.confirmation_note}></textarea>
        </label>
        <label class="check-row">
            <input type="checkbox" bind:checked={cfg.promote_club_nights} />
            <span>Mention your club nights when someone books</span>
            <HelpTip
                label="club nights"
                text={"After booking, they're told about your club night for the game they've booked to play — the same evening if it's on then, otherwise the next date it runs.\n\nOnly ever that game. Someone booking for The Old World won't be pitched 40k."}
            />
        </label>
    </div>

    <!-- ── Venue ────────────────────────────────────────────────────────── -->
    <div class="a-card">
        <div class="a-head">
            <h2 class="a-title">Venue</h2>
            <HelpTip
                label="venue details"
                text={"Your venue's own details and when it takes bookings.\n\nThe blurb, website and Discord invite all show on your public club page — the Discord invite becomes a button beside Book a table."}
            />
        </div>

        <h3 class="a-subtitle">
            Open hours
            <HelpTip
                label="open hours"
                text={"Your venue's hours, in one place. They show on your club page and they're the window bookings are offered inside — a day left closed takes no bookings at all.\n\nThe note is optional and shows under that day on your club page: \"kitchen closes 9\", \"members only\"."}
            />
        </h3>
        <div class="hours-grid">
            {#each DAYS as day, i}
                {@const row = profile.opening_hours[i]}
                <div class="hours-row" class:closed={row.closed}>
                    <span class="hours-day">{day.slice(0, 3)}</span>
                    <label class="check-row">
                        <input type="checkbox" checked={!row.closed}
                               onchange={(e) => (row.closed = !(e.currentTarget as HTMLInputElement).checked)} />
                        <span>Open</span>
                    </label>
                    <input class="field-input hours-time" type="time" bind:value={row.open} disabled={row.closed} />
                    <span class="hours-sep">–</span>
                    <input class="field-input hours-time" type="time" bind:value={row.close} disabled={row.closed} />
                    <input class="field-input hours-note" type="text" bind:value={row.note}
                           disabled={row.closed} placeholder="Note (optional)" />
                </div>
            {/each}
        </div>

        <h3 class="a-subtitle">On your club page</h3>
        <label class="field">
            <span class="field-label">Blurb</span>
            <textarea class="field-input field-textarea" rows="3" bind:value={profile.blurb}
                      placeholder="A short welcome for players landing on your club page…"></textarea>
        </label>
        <div class="link-row">
            <span class="hook-label">Website</span>
            <input class="field-input hook-input" type="text" bind:value={profile.website_url}
                   placeholder="https://…" />
        </div>
        <div class="link-row">
            <span class="hook-label">
                Discord invite
                <HelpTip
                    label="club Discord"
                    text={"Becomes a Join our Discord button on your club page, beside Book a table.\n\nThis is the club's own server. Each game night can point at a different one from its own carousel card — set those under Admin."}
                />
            </span>
            <input class="field-input hook-input" type="text" bind:value={profile.discord_url}
                   placeholder="https://discord.gg/…" />
        </div>
    </div>

    {#if error}<p class="field-error">{error}</p>{/if}
    {#if message}<p class="pairing-message">{message}</p>{/if}
    <button class="primary-button" type="button" disabled={saving} onclick={save}>
        {saving ? 'Saving…' : 'Save'}
    </button>
{/if}

<style>
    .opt-row { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; }
    .notify-row { margin-bottom: 0.4rem; }

    /* Sub-settings sit under the switch that turns them on, so the nesting
       reads as "this belongs to that" without another box around it. */
    .indented { margin-left: 1.4rem; }

    .hours-grid { display: flex; flex-direction: column; gap: 0.4rem; }
    .hours-row { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; }
    .hours-row.closed { opacity: 0.5; }
    .hours-day { width: 2.6rem; font-size: 0.78rem; font-weight: 700; color: var(--color-text-bright); }
    .hours-time { width: 7.5rem; }
    .hours-note { flex: 1 1 10rem; min-width: 0; }
    .hours-sep { color: var(--color-text-faint); }

    .rules-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
        gap: 0.7rem;
    }

    .field { display: flex; flex-direction: column; gap: 0.2rem; margin-bottom: 0.6rem; }

    /* Same row shape as the admin tab's webhook rows: label, value, actions. */
    .hook-row, .link-row {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex-wrap: wrap;
        margin-bottom: 0.6rem;
    }
    .hook-label {
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
        flex: 0 0 9rem;
        font-size: 0.72rem;
        font-weight: 700;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        color: var(--color-text-muted);
    }
    .hook-input { flex: 1 1 16rem; min-width: 0; }
    .hook-state { flex: 0 0 auto; }
</style>
