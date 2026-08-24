<script lang="ts">
    import { onMount } from 'svelte';
    import { PUBLIC_API_URL } from '$env/static/public';
    import HelpTip from './HelpTip.svelte';

    const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    let cfg = $state<any>(null);
    let emailsText = $state('');
    let saving = $state(false);
    let error = $state<string | null>(null);
    let message = $state<string | null>(null);

    async function load() {
        const r = await fetch(`${PUBLIC_API_URL}/venue/admin/config`, { credentials: 'include' });
        if (!r.ok) { error = 'Could not load settings.'; return; }
        cfg = await r.json();
        emailsText = (cfg.notify_emails ?? []).join('\n');
    }
    onMount(load);

    async function save() {
        saving = true; error = null; message = null;
        const r = await fetch(`${PUBLIC_API_URL}/venue/admin/config`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...cfg,
                notify_emails: emailsText.split('\n').map((e) => e.trim()).filter(Boolean)
            })
        });
        if (r.ok) {
            cfg = await r.json();
            emailsText = (cfg.notify_emails ?? []).join('\n');
            message = 'Saved.';
        } else {
            error = (await r.json().catch(() => ({}))).detail || 'Save failed.';
        }
        saving = false;
    }

    // Email switched on with nowhere to send is the one misconfiguration that
    // fails silently — the booking works, staff just never hear about it.
    const emailGoesNowhere = $derived(
        cfg?.notify_email && (cfg?.effective_emails ?? []).length === 0
    );
    const discordGoesNowhere = $derived(cfg?.notify_discord && !cfg?.discord_webhook_configured);
</script>

{#if cfg}
    <div class="a-card">
        <div class="a-head">
            <h2 class="a-title">Bookings</h2>
            <HelpTip
                label="public bookings"
                text={"Off means there's no booking page at all — nothing on your club page, and the booking links stop working.\n\nYou need at least one table before this will turn on."}
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
    </div>

    <div class="a-card">
        <div class="a-head">
            <h2 class="a-title">How you hear about it</h2>
            <HelpTip
                label="notifications"
                text={"Pick whichever suits how your venue is run — a staff Discord, an inbox, both, or neither.\n\nWith both off, bookings still arrive and still show in the Diary. You just won't be told."}
            />
        </div>

        <label class="check-row notify-row">
            <input type="checkbox" bind:checked={cfg.notify_email} />
            <span>Email</span>
        </label>
        {#if cfg.notify_email}
            <label class="field">
                <span class="field-label">
                    Send to <span class="field-label-hint">(one per line)</span>
                </span>
                <textarea class="field-input field-textarea" rows="3" bind:value={emailsText}
                          placeholder={cfg.club_contact_email ?? 'bookings@yourvenue.com'}></textarea>
            </label>
            {#if emailGoesNowhere}
                <p class="field-error">
                    Email is on but there's no address to send to, and your club has no contact
                    email either. Add one above or bookings will arrive unannounced.
                </p>
            {:else if (cfg.notify_emails ?? []).length === 0}
                <p class="a-note">Using your club contact address: {cfg.effective_emails[0]}</p>
            {/if}
        {/if}

        <label class="check-row notify-row">
            <input type="checkbox" bind:checked={cfg.notify_discord} />
            <span>Discord</span>
        </label>
        {#if discordGoesNowhere}
            <p class="field-error">
                Discord is on but no venue webhook is set. Add one under
                Admin → Discord, as the “venue booking” webhook.
            </p>
        {/if}
    </div>

    <div class="a-card">
        <div class="a-head">
            <h2 class="a-title">Hours</h2>
            <HelpTip
                label="bookable hours"
                text={"When tables can be booked — separate from your opening hours, because most venues are open before they'll take a table booking.\n\nA day left closed takes no bookings at all."}
            />
        </div>
        <div class="hours-grid">
            {#each DAYS as day, i}
                {@const row = cfg.booking_hours[i]}
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
                </div>
            {/each}
        </div>
    </div>

    <div class="a-card">
        <div class="a-head">
            <h2 class="a-title">Rules</h2>
            <HelpTip
                label="booking rules"
                text={"Slot length is how start times are offered — 30 minutes means 18:00, 18:30, 19:00.\n\nNotice is how close to the start someone may still book, so a table can't appear on you with no warning.\n\nPer person caps how many upcoming bookings one account can hold at once. Booking needs a login, so this is what stops one person taking the room."}
            />
        </div>
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
    </div>

    <div class="a-card">
        <div class="a-head">
            <h2 class="a-title">What bookers see</h2>
            <HelpTip
                label="booking page text"
                text={"The blurb sits on the booking form — parking, food, house rules.\n\nThe confirmation note goes on the confirmation and in their email: door codes, where the terrain lives, who to ask for."}
            />
        </div>
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

    {#if error}<p class="field-error">{error}</p>{/if}
    {#if message}<p class="pairing-message">{message}</p>{/if}
    <button class="primary-button" type="button" disabled={saving} onclick={save}>
        {saving ? 'Saving…' : 'Save'}
    </button>
{/if}

<style>
    .notify-row { margin-bottom: 0.5rem; }

    .opt-row { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; }

    .hours-grid { display: flex; flex-direction: column; gap: 0.4rem; }
    .hours-row { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; }
    .hours-row.closed { opacity: 0.5; }
    .hours-day {
        width: 2.6rem;
        font-size: 0.78rem;
        font-weight: 700;
        color: var(--color-text-bright);
    }
    .hours-time { width: 7.5rem; }
    .hours-sep { color: var(--color-text-faint); }

    .rules-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
        gap: 0.7rem;
    }

    .field { display: flex; flex-direction: column; gap: 0.2rem; margin-bottom: 0.6rem; }
</style>
