<script lang="ts">
    import { PUBLIC_API_URL } from '$env/static/public';
    import HelpTip from '$lib/HelpTip.svelte';

    /**
     * The Table booking tab of the club admin page: who gets the weekly
     * table-booking email, when it goes, and a preview and history of what was
     * sent. Split out of routes/admin/+page.svelte, which only shows it to a
     * super-admin. General admin styles come from club-admin.css.
     */
    let { scopes }: { scopes: string[] } = $props();

    // Table booking — super-admin-only oversight, not a per-system-admin
    // self-service surface like Missions/League: venue emails are closer to
    // a billing/venue relationship than day-to-day system admin work.
    type TableBookingData = {
        table_booking_enabled: boolean;
        venue_name: string | null;
        venue_email: string;
        cc_emails: string[];
        players_per_table: number;
        include_player_names: boolean;
        send_mode: string; // 'on_publish' | 'cutoff'
        cutoff_day: string | null;
        cutoff_time: string | null;
        subject_template: string | null;
        notes: string | null;
    };
    const TABLE_BOOKING_CUTOFF_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    let tbSelectScope = $state('');
    let tbLoading = $state(false);
    let tbSaving = $state(false);
    let tbError = $state<string | null>(null);
    let tbMessage = $state<string | null>(null);
    let tbEnabled = $state(false);
    let tbVenueName = $state('');
    let tbVenueEmail = $state('');
    let tbCcEmailsText = $state('');
    let tbPlayersPerTable = $state(2);
    let tbIncludeNames = $state(true);
    let tbSendMode = $state('on_publish');
    let tbCutoffDay = $state('Wednesday');
    let tbCutoffTime = $state('17:00');
    let tbSubjectTemplate = $state('');
    let tbNotes = $state('');

    type TableBookingPreview = {
        tables: number;
        headcount: number;
        player_names: string[];
        subject: string;
        html: string;
        already_sent: boolean;
    };
    type TableBookingHistoryRow = {
        week: string;
        tables: number;
        headcount: number;
        status: string;
        error: string | null;
        sent_at: string;
    };
    let tbPreviewWeek = $state('');
    let tbPreview = $state<TableBookingPreview | null>(null);
    let tbPreviewLoading = $state(false);
    let tbPreviewError = $state<string | null>(null);
    let tbSendLoading = $state(false);
    let tbSendMessage = $state<string | null>(null);
    let tbHistory = $state<TableBookingHistoryRow[]>([]);
    let tbHistoryLoading = $state(false);

    async function loadTableBooking(scope: string) {
        tbSelectScope = scope;
        tbLoading = true;
        tbError = null;
        tbMessage = null;
        tbPreview = null;
        tbPreviewError = null;
        tbSendMessage = null;
        loadTableBookingHistory(scope);
        try {
            const r = await fetch(`${PUBLIC_API_URL}/admin/table-booking-settings?system=${encodeURIComponent(scope)}`, { credentials: 'include' });
            if (!r.ok) throw new Error('Failed to load.');
            const d: TableBookingData = await r.json();
            tbEnabled = d.table_booking_enabled;
            tbVenueName = d.venue_name ?? '';
            tbVenueEmail = d.venue_email;
            tbCcEmailsText = (d.cc_emails ?? []).join(', ');
            tbPlayersPerTable = d.players_per_table;
            tbIncludeNames = d.include_player_names;
            tbSendMode = d.send_mode;
            tbCutoffDay = d.cutoff_day ?? 'Wednesday';
            tbCutoffTime = d.cutoff_time ?? '17:00';
            tbSubjectTemplate = d.subject_template ?? '';
            tbNotes = d.notes ?? '';
        } catch (e) {
            tbError = e instanceof Error ? e.message : 'Failed to load.';
        } finally {
            tbLoading = false;
        }
    }

    async function saveTableBooking() {
        if (!tbSelectScope) return;
        tbSaving = true;
        tbError = null;
        tbMessage = null;
        try {
            const settingsRes = await fetch(`${PUBLIC_API_URL}/admin/table-booking-settings`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ system: tbSelectScope, table_booking_enabled: tbEnabled }),
            });
            if (!settingsRes.ok) {
                const body = await settingsRes.json().catch(() => ({}));
                throw new Error(body.detail || 'Failed to save toggle.');
            }

            const configRes = await fetch(`${PUBLIC_API_URL}/admin/table-booking-config`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    system: tbSelectScope,
                    venue_name: tbVenueName.trim() || null,
                    venue_email: tbVenueEmail.trim(),
                    cc_emails: tbCcEmailsText.split(',').map((s) => s.trim()).filter(Boolean),
                    players_per_table: tbPlayersPerTable,
                    include_player_names: tbIncludeNames,
                    send_mode: tbSendMode,
                    cutoff_day: tbSendMode === 'cutoff' ? tbCutoffDay : null,
                    cutoff_time: tbSendMode === 'cutoff' ? tbCutoffTime : null,
                    subject_template: tbSubjectTemplate.trim() || null,
                    notes: tbNotes.trim() || null,
                }),
            });
            if (!configRes.ok) {
                const body = await configRes.json().catch(() => ({}));
                throw new Error(body.detail || 'Failed to save config.');
            }
            tbMessage = 'Saved.';
            await loadTableBookingHistory(tbSelectScope);
        } catch (e) {
            tbError = e instanceof Error ? e.message : 'Failed to save.';
        } finally {
            tbSaving = false;
        }
    }

    async function loadTableBookingHistory(scope: string) {
        tbHistoryLoading = true;
        try {
            const r = await fetch(`${PUBLIC_API_URL}/admin/table-booking-history?system=${encodeURIComponent(scope)}`, { credentials: 'include' });
            tbHistory = r.ok ? await r.json() : [];
        } finally {
            tbHistoryLoading = false;
        }
    }

    async function refreshTableBookingPreview() {
        if (!tbSelectScope || !tbPreviewWeek.trim()) return;
        tbPreviewLoading = true;
        tbPreviewError = null;
        try {
            const r = await fetch(`${PUBLIC_API_URL}/admin/table-booking/preview`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ system: tbSelectScope, week: tbPreviewWeek.trim() }),
            });
            if (!r.ok) {
                const body = await r.json().catch(() => ({}));
                throw new Error(body.detail || 'Failed to compute preview.');
            }
            tbPreview = await r.json();
        } catch (e) {
            tbPreviewError = e instanceof Error ? e.message : 'Failed to compute preview.';
        } finally {
            tbPreviewLoading = false;
        }
    }

    async function previewTableBooking() {
        tbSendMessage = null;
        tbPreview = null;
        await refreshTableBookingPreview();
    }

    async function sendTableBookingNow() {
        if (!tbSelectScope || !tbPreviewWeek.trim()) return;
        tbSendLoading = true;
        tbSendMessage = null;
        try {
            const r = await fetch(`${PUBLIC_API_URL}/admin/table-booking/send`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ system: tbSelectScope, week: tbPreviewWeek.trim() }),
            });
            const body = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(body.detail || 'Failed to send.');
            tbSendMessage = body.status === 'sent' ? 'Sent.' : `Failed: ${body.error ?? 'unknown error'}`;
            await Promise.all([refreshTableBookingPreview(), loadTableBookingHistory(tbSelectScope)]);
        } catch (e) {
            tbSendMessage = e instanceof Error ? `Failed: ${e.message}` : 'Failed to send.';
        } finally {
            tbSendLoading = false;
        }
    }
</script>

<!-- ══ Table Booking ══ -->
<div class="dash-group">
    <div class="dash-group-header static">
        <span class="dash-group-title">Table Booking</span>
    </div>
    <div class="dash-group-body">
<section class="admin-section sub-section">
    <div class="a-head">
        <h3 class="section-heading">Venue table-booking emails</h3>
        <HelpTip label="table booking" text="Sends your venue a table and player count ahead of each session, once signups are in, so they know how much to set out. Configured per system. Pick one below." />
    </div>

    <div class="field field-narrow">
        <label class="field-label" for="tb-scope">System</label>
        <select
            id="tb-scope"
            class="field-select"
            value={tbSelectScope}
            onchange={(e) => { const v = (e.target as HTMLSelectElement).value; if (v) loadTableBooking(v); }}
        >
            <option value="">Select a system</option>
            {#each scopes as s}
                <option value={s}>{s}</option>
            {/each}
        </select>
    </div>

    {#if tbLoading}
        <p class="muted">Loading…</p>
    {:else if tbSelectScope}
        <form class="appoint-form system-form" onsubmit={(e) => { e.preventDefault(); saveTableBooking(); }}>
            <label class="check-row">
                <input type="checkbox" bind:checked={tbEnabled} />
                <span>Send table-booking emails for {tbSelectScope}</span>
                <HelpTip label="table-booking emails" text={"Emails an outside venue how many tables to expect.\n\nLeave it off if the club runs its own venue through Venue Admin \u2014 that already works the number out and lays the tables out on the plan."} />
            </label>
            <div class="field-row-break"></div>

            <div class="field field-narrow">
                <label class="field-label" for="tb-venue-name">Venue name</label>
                <input id="tb-venue-name" class="field-input" type="text" bind:value={tbVenueName} placeholder="e.g. EG NWGC" />
            </div>
            <div class="field field-narrow">
                <label class="field-label" for="tb-venue-email">Venue email</label>
                <input id="tb-venue-email" class="field-input" type="email" bind:value={tbVenueEmail} placeholder="bookings@venue.example" />
            </div>
            <div class="field field-narrow">
                <label class="field-label" for="tb-cc-emails">CC emails (comma-separated)</label>
                <input id="tb-cc-emails" class="field-input" type="text" bind:value={tbCcEmailsText} placeholder="manager@venue.example, you@calltoarms.app" />
            </div>
            <div class="field-row-break"></div>

            <div class="field field-narrow">
                <label class="field-label" for="tb-players-per-table">Players per table</label>
                <input id="tb-players-per-table" class="field-input" type="number" min="1" bind:value={tbPlayersPerTable} />
            </div>
            <label class="check-row">
                <input type="checkbox" bind:checked={tbIncludeNames} />
                <span>Include player names in the email</span>
            </label>
            <div class="field-row-break"></div>

            <div class="field field-narrow">
                <label class="field-label" for="tb-send-mode">Send trigger</label>
                <select id="tb-send-mode" class="field-select" bind:value={tbSendMode}>
                    <option value="on_publish">When pairings are published (auto or manual)</option>
                    <option value="cutoff">At a fixed day/time each week</option>
                </select>
            </div>
            {#if tbSendMode === 'cutoff'}
                <div class="field field-narrow">
                    <label class="field-label" for="tb-cutoff-day">Cutoff day</label>
                    <select id="tb-cutoff-day" class="field-select" bind:value={tbCutoffDay}>
                        {#each TABLE_BOOKING_CUTOFF_DAYS as d}
                            <option>{d}</option>
                        {/each}
                    </select>
                </div>
                <div class="field field-narrow">
                    <label class="field-label" for="tb-cutoff-time">Cutoff time
                        <HelpTip label="the cutoff" text={"UK local time.\n\nSent on headcount so far, so the pairings may not exist yet."} /></label>
                    <input id="tb-cutoff-time" class="field-input" type="time" bind:value={tbCutoffTime} />
                </div>
            {/if}
            <div class="field-row-break"></div>

            <div class="field player-edit-wide">
                <label class="field-label" for="tb-subject">Custom subject (optional)</label>
                <input id="tb-subject" class="field-input" type="text" bind:value={tbSubjectTemplate} placeholder="Leave blank for the default subject" />
            </div>
            <div class="field player-edit-wide">
                <label class="field-label" for="tb-notes">Notes (optional, internal)</label>
                <textarea id="tb-notes" class="field-input field-textarea" rows="2" bind:value={tbNotes}></textarea>
            </div>

            {#if tbError}
                <p class="field-error">{tbError}</p>
            {/if}
            {#if tbMessage}
                <p class="pairing-message">{tbMessage}</p>
            {/if}
            <div class="system-form-actions">
                <button type="submit" class="primary-button" disabled={tbSaving || !tbVenueEmail.trim()}>
                    {tbSaving ? 'Saving…' : 'Save'}
                </button>
            </div>
        </form>

        <div class="sub-section">
            <h4 class="a-title">Preview or send a specific week</h4>
            <div class="field field-narrow">
                <label class="field-label" for="tb-preview-week">Week (DD/MM/YYYY)</label>
                <input id="tb-preview-week" class="field-input" type="text" bind:value={tbPreviewWeek} placeholder="e.g. 05/03/2026" />
            </div>
            <div class="system-form-actions">
                <button
                    type="button"
                    class="secondary-button"
                    disabled={tbPreviewLoading || !tbPreviewWeek.trim()}
                    onclick={previewTableBooking}
                >{tbPreviewLoading ? 'Computing…' : 'Preview'}</button>
                <button
                    type="button"
                    class="primary-button"
                    disabled={tbSendLoading || !tbPreviewWeek.trim()}
                    onclick={sendTableBookingNow}
                >{tbSendLoading ? 'Sending…' : 'Send now'}</button>
            </div>

            {#if tbPreviewError}
                <p class="field-error">{tbPreviewError}</p>
            {/if}
            {#if tbSendMessage}
                <p class="pairing-message">{tbSendMessage}</p>
            {/if}
            {#if tbPreview}
                <div class="tb-preview-box">
                    <p>
                        <strong>{tbPreview.tables} table{tbPreview.tables === 1 ? '' : 's'}</strong>
                        for <strong>{tbPreview.headcount} player{tbPreview.headcount === 1 ? '' : 's'}</strong>
                        {#if tbPreview.already_sent}
                            <span class="status-badge status-active">Already sent</span>
                        {/if}
                    </p>
                    <p class="muted small">Subject: {tbPreview.subject}</p>
                    <details>
                        <summary>Email preview</summary>
                        <div class="tb-preview-html">{@html tbPreview.html}</div>
                    </details>
                </div>
            {/if}
        </div>

        <div class="sub-section">
            <h4 class="a-title">Recent sends</h4>
            {#if tbHistoryLoading}
                <p class="muted">Loading…</p>
            {:else if tbHistory.length === 0}
                <p class="muted">No sends yet for this system.</p>
            {:else}
                <ul class="block-list">
                    {#each tbHistory as h}
                        <li class="block-row">
                            <span class="block-names"><strong>{h.week}</strong></span>
                            <span class="block-note">{h.tables} tables, {h.headcount} players</span>
                            <span class="status-badge" class:status-active={h.status === 'sent'} class:status-inactive={h.status !== 'sent'}>
                                {h.status}
                            </span>
                            <span class="muted small">{new Date(h.sent_at).toLocaleString()}</span>
                            {#if h.error}
                                <span class="field-error small">{h.error}</span>
                            {/if}
                        </li>
                    {/each}
                </ul>
            {/if}
        </div>
    {/if}
</section>
    </div>
</div>

<style>
    .tb-preview-box {
        margin-top: 0.75rem;
        padding: 0.75rem 1rem;
        border: 1px solid var(--color-accent-border-soft);
        border-radius: 6px;
        background: var(--color-surface-dark);
    }

    .tb-preview-html {
        margin-top: 0.5rem;
        padding: 0.75rem;
        border: 1px solid rgba(148, 163, 184, 0.25);
        border-radius: 4px;
        max-width: 640px;
    }
</style>
