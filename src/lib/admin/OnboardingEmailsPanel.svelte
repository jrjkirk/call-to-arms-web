<script lang="ts">
    import { onMount } from 'svelte';
    import { PUBLIC_API_URL } from '$env/static/public';
    import HelpTip from '$lib/HelpTip.svelte';

    /**
     * The Onboarding Emails tab of the platform admin page: the three emails a
     * club organiser gets, edited, previewed and test-sent. Split out of
     * routes/platform-admin/+page.svelte; loads them when opened. Shared styles come
     * from platform-admin.css.
     */
    // Onboarding Emails — the three messages a club organiser gets. Editable
    // here because onboarding copy is the sort of thing you tune after the
    // third club, not the third release.
    type ClubEmail = {
        kind: string; label: string; when: string; tokens: string[];
        subject: string; body: string;
        default_subject: string; default_body: string; customised: boolean;
    };
    let clubEmails = $state<ClubEmail[]>([]);
    let clubEmailsLoading = $state(false);
    let clubEmailError = $state<string | null>(null);
    let clubEmailMessage = $state<string | null>(null);
    let clubEmailPreview = $state<{ kind: string; subject: string; html: string; text: string; unknown_tokens: string[] } | null>(null);
    let clubEmailTestTo = $state('');

    async function loadClubEmails() {
        clubEmailsLoading = true;
        clubEmailError = null;
        const r = await fetch(`${PUBLIC_API_URL}/admin/platform/club-emails`, { credentials: 'include' });
        if (r.ok) clubEmails = await r.json();
        else clubEmailError = 'Could not load the email templates.';
        clubEmailsLoading = false;
    }

    async function saveClubEmail(e: ClubEmail) {
        clubEmailError = null;
        clubEmailMessage = null;
        const r = await fetch(`${PUBLIC_API_URL}/admin/platform/club-emails`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ kind: e.kind, subject: e.subject, body: e.body })
        });
        if (r.ok) {
            clubEmailMessage = `Saved: ${e.label}.`;
            await loadClubEmails();
        } else {
            const b = await r.json().catch(() => ({}));
            clubEmailError = b.detail || 'Could not save.';
        }
    }

    /** Put the built-in wording back in the boxes. Saving is still explicit, so
     *  a mis-click is one Cancel away rather than a lost rewrite. */
    function resetClubEmail(e: ClubEmail) {
        e.subject = e.default_subject;
        e.body = e.default_body;
    }

    async function previewClubEmail(e: ClubEmail) {
        clubEmailError = null;
        const r = await fetch(`${PUBLIC_API_URL}/admin/platform/club-emails/preview`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ kind: e.kind, subject: e.subject, body: e.body })
        });
        if (r.ok) clubEmailPreview = { kind: e.kind, ...(await r.json()) };
        else clubEmailError = 'Could not render a preview.';
    }

    async function testSendClubEmail(e: ClubEmail) {
        clubEmailError = null;
        clubEmailMessage = null;
        if (!clubEmailTestTo.trim()) {
            clubEmailError = 'Put an address in first.';
            return;
        }
        const r = await fetch(`${PUBLIC_API_URL}/admin/platform/club-emails/test`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ kind: e.kind, to: clubEmailTestTo.trim(), subject: e.subject, body: e.body })
        });
        const b = await r.json().catch(() => ({}));
        if (r.ok && b.outcome === 'sent') clubEmailMessage = `Test sent to ${clubEmailTestTo.trim()}.`;
        else clubEmailError = b.detail || `Test send failed (${b.outcome ?? r.status}).`;
    }

    onMount(loadClubEmails);
</script>

<!-- ══ Onboarding Emails ══ -->
<div class="dash-group">
    <div class="dash-group-header static">
        <span class="dash-group-title">Onboarding Emails</span>
            <HelpTip label="onboarding emails" text={"The three messages a club organiser gets: acknowledgement, welcome, decline.\n\n\u2022 Write plain text, not HTML\n\u2022 A blank line starts a new paragraph\n\u2022 Links are made automatically\n\u2022 {tokens} in curly braces are filled in on send\n\nClear a field to go back to the built-in wording."} />
    </div>
    <div class="dash-group-body">
        <section class="admin-section">
            {#if clubEmailsLoading}
                <p class="muted">Loading…</p>
            {:else}
                {#each clubEmails as e (e.kind)}
                    <div class="sub-section">
                        <div class="a-head">
                            <h4 class="a-title">{e.label}</h4>
                            <span class="a-head-end">
                                <span class="status-badge" class:status-active={e.customised} class:status-inactive={!e.customised}>
                                    {e.customised ? 'edited' : 'default'}
                                </span>
                            </span>
                        </div>
                        <p class="muted small">{e.when}</p>
                        <p class="muted small">
                            Tokens: {#each e.tokens as t (t)}<code class="token-chip">{'{' + t + '}'}</code>{/each}
                        </p>
                        <div class="field">
                            <label class="field-label" for={`ce-subject-${e.kind}`}>Subject</label>
                            <input id={`ce-subject-${e.kind}`} class="field-input" type="text" bind:value={e.subject} />
                        </div>
                        <div class="field">
                            <label class="field-label" for={`ce-body-${e.kind}`}>Message</label>
                            <textarea id={`ce-body-${e.kind}`} class="field-input" rows="10" bind:value={e.body}></textarea>
                        </div>
                        <div class="provision-actions">
                            <button class="primary-button" type="button" onclick={() => saveClubEmail(e)}>Save</button>
                            <button class="secondary-button" type="button" onclick={() => previewClubEmail(e)}>Preview</button>
                            <button class="secondary-button" type="button" onclick={() => resetClubEmail(e)}>Reset to default</button>
                        </div>
                        <div class="field test-send">
                            <label class="field-label" for={`ce-test-${e.kind}`}>Send a test to</label>
                            <div class="slug-input-wrap">
                                <input id={`ce-test-${e.kind}`} class="field-input" type="email" placeholder="you@example.com" bind:value={clubEmailTestTo} />
                                <button class="secondary-button" type="button" onclick={() => testSendClubEmail(e)}>Send test</button>
                            </div>
                        </div>

                        {#if clubEmailPreview && clubEmailPreview.kind === e.kind}
                            <div class="email-preview">
                                {#if clubEmailPreview.unknown_tokens.length}
                                    <p class="field-error">
                                        Unknown token{clubEmailPreview.unknown_tokens.length > 1 ? 's' : ''}:
                                        {clubEmailPreview.unknown_tokens.join(', ')}. These will appear in the
                                        email exactly as written.
                                    </p>
                                {/if}
                                <p class="muted small">Subject: <strong>{clubEmailPreview.subject}</strong></p>
                                <!--
                                    Safe by construction, not by trust: club_emails.render_body
                                    escapes the ENTIRE filled template before adding any markup,
                                    so neither the editor's own text nor a club name off a public
                                    form can introduce a tag. The only markup that reaches here is
                                    the paragraphs and links we generate ourselves, and the
                                    linkifier runs on already-escaped text so it cannot break out.
                                    Asserted by the "an editor cannot inject markup" case in
                                    tests/test_club_onboarding.py.
                                -->
                                <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                                <div class="email-preview-body">{@html clubEmailPreview.html}</div>
                            </div>
                        {/if}
                    </div>
                {/each}
            {/if}
            {#if clubEmailError}<p class="field-error">{clubEmailError}</p>{/if}
            {#if clubEmailMessage}<p class="pairing-message">{clubEmailMessage}</p>{/if}
        </section>
    </div>
</div>

<style>
    .token-chip {
        display: inline-block;
        background: var(--color-surface);
        border: 1px solid var(--color-steel-border);
        border-radius: var(--radius);
        padding: 0.05rem 0.35rem;
        margin-right: 0.3rem;
        font-size: 0.78rem;
    }

    .test-send {
        margin-top: 0.9rem;
    }

    .email-preview {
        margin-top: 1rem;
        border-top: 1px solid var(--color-steel-border);
        padding-top: 0.9rem;
    }

    /* The preview now contains a whole email, which brings its own background,
    logo and button. So this only has to hold it — anything styled here would
    be styling that no recipient sees, which is the opposite of the point. */
    .email-preview-body {
        border-radius: var(--radius);
        overflow: hidden;
    }
</style>
