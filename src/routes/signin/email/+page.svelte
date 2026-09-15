<script lang="ts">
    /**
     * Where an emailed sign-in or confirm-email link lands (account overhaul
     * Slab 5).
     *
     * The link does NOT sign anyone in by being opened. Mail scanners (Outlook
     * Safe Links and similar) open every link in a message, and a link that
     * signed you in on opening would be spent by the scanner before you saw it.
     * So this page waits for a person to press Continue, and only that POST
     * uses the token.
     *
     * The token is taken off the address bar as soon as the page loads and the
     * page sends no Referer, so it can't leak to anything the page loads while
     * it's still live.
     */
    import { onMount } from 'svelte';
    import { page } from '$app/state';
    import { PUBLIC_API_URL } from '$env/static/public';

    let token = $state<string | null>(null);
    let working = $state(false);
    let error = $state<string | null>(null);

    onMount(() => {
        token = page.url.searchParams.get('token');
        if (token) history.replaceState(history.state, '', page.url.pathname);
    });

    async function continueSignIn() {
        if (!token || working) return;
        working = true;
        error = null;
        try {
            const r = await fetch(`${PUBLIC_API_URL}/auth/email/verify`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token })
            });
            const body = await r.json().catch(() => ({}));
            if (!r.ok) {
                error = typeof body.detail === 'string' ? body.detail : 'That link didn\'t work. Ask for a new one.';
                working = false;
                return;
            }
            // A full navigation, so the whole app starts again signed in.
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

<div class="email-continue">
    <h2 class="page-heading">Continue to Call to Arms</h2>
    {#if error}
        <p class="field-error">{error}</p>
        <p><a href="/signin">Get a new link</a></p>
    {:else if token}
        <button class="primary-button" type="button" disabled={working} onclick={continueSignIn}>
            {working ? 'Signing in…' : 'Continue'}
        </button>
    {:else}
        <p class="email-muted">This link is missing its code. <a href="/signin">Get a new link</a>.</p>
    {/if}
</div>

<style>
    .email-continue { max-width: 30rem; margin: clamp(2rem, 8vh, 5rem) auto; text-align: center; }
    .page-heading { font-size: 1.5rem; margin: 0 0 1.2rem; }
    .email-muted { color: var(--color-text-dim); }
    .email-continue a { color: var(--color-accent); }
</style>
