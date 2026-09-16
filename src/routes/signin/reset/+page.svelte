<script lang="ts">
    /** Choose a new password from an emailed link (Slab 8).
     *
     *  The token comes off the address bar on load and the page sends no
     *  Referer, as on /signin/email: while it is unused it is as good as a
     *  password. Resetting signs them in and ends their other sessions. */
    import { onMount } from 'svelte';
    import { page } from '$app/state';
    import { PUBLIC_API_URL } from '$env/static/public';

    let token = $state<string | null>(null);
    let password = $state('');
    let confirm = $state('');
    let working = $state(false);
    let error = $state<string | null>(null);

    onMount(() => {
        token = page.url.searchParams.get('token');
        if (token) history.replaceState(history.state, '', page.url.pathname);
    });

    async function submit() {
        if (working || !token) return;
        if (password !== confirm) {
            error = 'Those passwords don\'t match.';
            return;
        }
        working = true;
        error = null;
        try {
            const r = await fetch(`${PUBLIC_API_URL}/auth/password/reset`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, password })
            });
            const body = await r.json().catch(() => ({}));
            if (!r.ok) {
                error = typeof body.detail === 'string' ? body.detail : 'Could not set that password.';
                working = false;
                return;
            }
            window.location.href = body.redirect;
        } catch (_) {
            error = 'Network error. Please try again.';
            working = false;
        }
    }
</script>

<svelte:head>
    <meta name="referrer" content="no-referrer" />
</svelte:head>

<div class="reset">
    <h2 class="page-heading">Choose a new password</h2>
    {#if !token}
        <p class="reset-muted">This link is missing its code. <a href="/signin/forgot">Ask for a new one</a>.</p>
    {:else}
        <form onsubmit={(e) => { e.preventDefault(); submit(); }}>
            <div class="field">
                <label class="field-label" for="rs-password">New password</label>
                <input id="rs-password" class="field-input" type="password" autocomplete="new-password" required bind:value={password} />
            </div>
            <div class="field">
                <label class="field-label" for="rs-confirm">New password again</label>
                <input id="rs-confirm" class="field-input" type="password" autocomplete="new-password" required bind:value={confirm} />
            </div>
            {#if error}
                <p class="field-error">{error}</p>
                <p class="reset-muted"><a href="/signin/forgot">Ask for a new link</a></p>
            {/if}
            <button class="primary-button" type="submit" disabled={working}>
                {working ? 'Saving…' : 'Save and sign in'}
            </button>
        </form>
        <p class="reset-muted reset-note">This signs you out on your other devices.</p>
    {/if}
</div>

<style>
    .reset { max-width: 26rem; margin: clamp(1.5rem, 6vh, 4rem) auto; }
    .page-heading { font-size: 1.5rem; margin: 0 0 1rem; }
    .reset-muted { color: var(--color-text-dim); font-size: 0.85rem; }
    .reset-muted a { color: var(--color-accent); }
    .reset-note { margin: 0.9rem 0 0; }
</style>
