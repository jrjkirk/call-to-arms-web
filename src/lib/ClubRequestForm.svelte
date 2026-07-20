<script lang="ts">
    import { PUBLIC_API_URL } from '$env/static/public';

    let requesterName = $state('');
    let requesterEmail = $state('');
    let clubName = $state('');
    let clubLocation = $state('');
    let notes = $state('');

    let submitting = $state(false);
    let error = $state<string | null>(null);
    let submitted = $state(false);

    async function submit() {
        error = null;
        if (!requesterName.trim() || !requesterEmail.trim() || !clubName.trim() || !clubLocation.trim() || !notes.trim()) {
            error = 'Your name, email, club name, location, and club details are all required.';
            return;
        }
        submitting = true;
        try {
            const r = await fetch(`${PUBLIC_API_URL}/club-requests`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    requester_name: requesterName.trim(),
                    requester_email: requesterEmail.trim(),
                    club_name: clubName.trim(),
                    club_location: clubLocation.trim(),
                    notes: notes.trim(),
                }),
            });
            if (r.ok) {
                submitted = true;
            } else {
                const body = await r.json().catch(() => ({}));
                error = body.detail || 'Something went wrong — try again in a moment.';
            }
        } catch (_) {
            error = 'Something went wrong — try again in a moment.';
        } finally {
            submitting = false;
        }
    }
</script>

<div class="request-section">
    <div class="request-heading">Don't see your club?</div>
    <p class="request-tagline">Tell us about it and we'll get you set up.</p>

    {#if submitted}
        <div class="request-card request-success">
            <p>Thanks — your request is in. We'll be in touch at <strong>{requesterEmail}</strong> once it's reviewed.</p>
        </div>
    {:else}
        <form class="request-card" onsubmit={(e) => { e.preventDefault(); submit(); }}>
            <div class="request-grid">
                <div class="field">
                    <label class="field-label" for="req-name">Your name</label>
                    <input id="req-name" class="field-input" type="text" bind:value={requesterName} required />
                </div>
                <div class="field">
                    <label class="field-label" for="req-email">Your email</label>
                    <input id="req-email" class="field-input" type="email" bind:value={requesterEmail} required />
                </div>
                <div class="field">
                    <label class="field-label" for="req-club-name">Club name</label>
                    <input id="req-club-name" class="field-input" type="text" bind:value={clubName} required />
                </div>
                <div class="field">
                    <label class="field-label" for="req-club-location">Club location</label>
                    <input id="req-club-location" class="field-input" type="text" placeholder="Town/city, country" bind:value={clubLocation} required />
                </div>
            </div>
            <div class="field">
                <label class="field-label" for="req-notes">Tell us about your club</label>
                <textarea id="req-notes" class="field-input" rows="2" bind:value={notes} placeholder="How many players, which systems you play…" required></textarea>
            </div>
            {#if error}<p class="request-error">{error}</p>{/if}
            <button class="request-button" type="submit" disabled={submitting}>
                {submitting ? 'Sending…' : 'Request my club'}
            </button>
        </form>
    {/if}
</div>

<style>
    .request-section {
        width: 100%;
        margin-top: clamp(2.2rem, 5vw, 3rem);
        text-align: center;
    }

    .request-heading {
        color: var(--color-accent);
        font-size: 0.82rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 1.5px;
        margin-bottom: 0.3rem;
    }

    .request-tagline {
        margin: 0 0 1rem;
        color: var(--color-text-dim);
        font-size: 0.88rem;
    }

    .request-card {
        text-align: left;
        background: var(--color-surface-dark);
        border: 1px solid var(--color-steel-border);
        border-radius: var(--radius);
        padding: 1.1rem 1.2rem 1.3rem;
    }

    .request-success {
        text-align: center;
        color: var(--color-text-muted);
        font-size: 0.92rem;
    }

    .request-success p {
        margin: 0;
    }

    .request-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 0.75rem;
        margin-bottom: 0.85rem;
    }

    .field {
        margin-bottom: 0.85rem;
    }

    .field:last-of-type {
        margin-bottom: 0;
    }

    .field-label {
        display: block;
        color: var(--color-text-muted);
        font-size: 0.85rem;
        margin-bottom: 0.32rem;
    }

    .field-input {
        width: 100%;
        background: var(--color-surface);
        border: 1px solid var(--color-steel-border);
        border-radius: var(--radius);
        color: var(--color-text-base);
        padding: 0.55rem 0.75rem;
        font-family: inherit;
        font-size: 0.92rem;
        box-sizing: border-box;
    }

    .field-input:focus {
        outline: none;
        border-color: var(--color-accent);
        box-shadow: 0 0 0 3px var(--color-accent-glow);
    }

    .request-error {
        color: var(--color-loss);
        font-size: 0.82rem;
        margin: 0.6rem 0 0;
    }

    .request-button {
        margin-top: 1rem;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: var(--color-accent);
        border: 1px solid var(--color-accent);
        color: #1b1206;
        font-weight: 700;
        font-size: 0.9rem;
        padding: 0.65rem 1.6rem;
        border-radius: var(--radius);
        cursor: pointer;
        transition: background 0.18s ease;
    }

    .request-button:hover:not(:disabled) {
        background: var(--color-accent-soft);
    }

    .request-button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
</style>
