<script lang="ts">
    /** Ask for a link to choose a new password (Slab 8). The API answers the
     *  same whether or not the address has an account. */
    import { page } from '$app/state';
    import { PUBLIC_API_URL } from '$env/static/public';

    const next = $derived(page.url.searchParams.get('next'));

    let email = $state('');
    let working = $state(false);
    let error = $state<string | null>(null);
    let sent = $state<string | null>(null);

    async function submit() {
        if (working) return;
        working = true;
        error = null;
        try {
            const r = await fetch(`${PUBLIC_API_URL}/auth/password/forgot`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            const body = await r.json().catch(() => ({}));
            if (!r.ok) error = typeof body.detail === 'string' ? body.detail : 'Could not send a link.';
            else sent = body.detail;
        } catch (_) {
            error = 'Network error. Please try again.';
        } finally {
            working = false;
        }
    }
</script>

<div class="forgot">
    <h2 class="page-heading">Forgotten your password</h2>
    {#if sent}
        <p class="forgot-sent" role="status">{sent}</p>
    {:else}
        <form onsubmit={(e) => { e.preventDefault(); submit(); }}>
            <div class="field">
                <label class="field-label" for="fp-email">Your email address</label>
                <input id="fp-email" class="field-input" type="email" autocomplete="email" required bind:value={email} />
            </div>
            {#if error}<p class="field-error">{error}</p>{/if}
            <button class="primary-button" type="submit" disabled={working}>
                {working ? 'Sending…' : 'Email me a link'}
            </button>
        </form>
        <p class="forgot-back">
            <a href={`/signin${next ? `?next=${encodeURIComponent(next)}` : ''}`}>Back to signing in</a>
        </p>
    {/if}
</div>

<style>
    .forgot { max-width: 26rem; margin: clamp(1.5rem, 6vh, 4rem) auto; }
    .page-heading { font-size: 1.5rem; margin: 0 0 1rem; }
    .forgot-sent { color: var(--color-text-base); line-height: 1.6; }
    .forgot-back { margin: 1rem 0 0; font-size: 0.85rem; }
    .forgot-back a { color: var(--color-accent); }
</style>
