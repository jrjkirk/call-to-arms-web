<script lang="ts">
    /** Create an account with an email address and a password (Slab 8).
     *
     *  Nothing exists until the address is confirmed, so this ends on "check
     *  your inbox" whether or not the address already had an account: the API
     *  will not say which, and neither does this page. */
    import { page } from '$app/state';
    import { PUBLIC_API_URL } from '$env/static/public';
    import HelpTip from '$lib/HelpTip.svelte';

    const next = $derived.by(() => {
        const n = page.url.searchParams.get('next');
        return n && n.startsWith('/') && !n.startsWith('//') ? n : null;
    });

    let email = $state('');
    let password = $state('');
    let confirm = $state('');
    let working = $state(false);
    let error = $state<string | null>(null);
    let sent = $state<string | null>(null);

    async function submit() {
        if (working) return;
        if (password !== confirm) {
            error = 'Those passwords don\'t match.';
            return;
        }
        working = true;
        error = null;
        try {
            const r = await fetch(`${PUBLIC_API_URL}/auth/password/signup`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, next })
            });
            const body = await r.json().catch(() => ({}));
            if (!r.ok) error = typeof body.detail === 'string' ? body.detail : 'Could not sign up.';
            else sent = body.detail;
        } catch (_) {
            error = 'Network error. Please try again.';
        } finally {
            working = false;
        }
    }
</script>

<div class="signup">
    <h2 class="page-heading">Create an account</h2>
    {#if sent}
        <p class="signup-sent" role="status">{sent}</p>
    {:else}
        <p class="signup-lead">
            Most players sign in with Discord. <a href={`/signin${next ? `?next=${encodeURIComponent(next)}` : ''}`}>Use that instead</a>
            if you have it.
        </p>
        <form onsubmit={(e) => { e.preventDefault(); submit(); }}>
            <div class="field">
                <label class="field-label" for="su-email">Email address</label>
                <input id="su-email" class="field-input" type="email" autocomplete="email" required bind:value={email} />
            </div>
            <div class="field">
                <label class="field-label" for="su-password">
                    Password <HelpTip label="password rules" text={"At least 10 characters. Anything found in a known data breach is refused, so a passphrase of a few words is both easier to remember and safer than a short one with symbols in it."} />
                </label>
                <input id="su-password" class="field-input" type="password" autocomplete="new-password" required bind:value={password} />
            </div>
            <div class="field">
                <label class="field-label" for="su-confirm">Password again</label>
                <input id="su-confirm" class="field-input" type="password" autocomplete="new-password" required bind:value={confirm} />
            </div>
            {#if error}<p class="field-error">{error}</p>{/if}
            <button class="primary-button" type="submit" disabled={working}>
                {working ? 'Sending…' : 'Create account'}
            </button>
        </form>
    {/if}
</div>

<style>
    .signup { max-width: 26rem; margin: clamp(1.5rem, 6vh, 4rem) auto; }
    .page-heading { font-size: 1.5rem; margin: 0 0 0.6rem; }
    .signup-lead { color: var(--color-text-dim); font-size: 0.9rem; line-height: 1.5; margin: 0 0 1.2rem; }
    .signup-lead a { color: var(--color-accent); }
    .signup-sent { color: var(--color-text-base); line-height: 1.6; }
</style>
