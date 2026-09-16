<script lang="ts">
    /**
     * Email and password sign-in (account overhaul Slab 8). Renders only when
     * the API offers it ($lib/signInProviders).
     *
     * The API answers a wrong address and a wrong password identically, and
     * this shows what it says rather than guessing at a friendlier message
     * that would give away who has an account.
     */
    import { PUBLIC_API_URL } from '$env/static/public';
    import { signInProviders } from '$lib/signInProviders';

    let { next = null }: { next?: string | null } = $props();

    let email = $state('');
    let password = $state('');
    let working = $state(false);
    let error = $state<string | null>(null);

    const forgotHref = $derived(`/signin/forgot${next && next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`);
    const newHref = $derived(`/signin/new${next && next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`);

    async function signIn() {
        if (working) return;
        working = true;
        error = null;
        try {
            const r = await fetch(`${PUBLIC_API_URL}/auth/password/signin`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, next: next && next !== '/' ? next : null })
            });
            const body = await r.json().catch(() => ({}));
            if (!r.ok) {
                error = typeof body.detail === 'string' ? body.detail : 'Could not sign in.';
                working = false;
                return;
            }
            // A full navigation, so the app starts again signed in.
            window.location.href = body.redirect;
        } catch (_) {
            error = 'Network error. Please try again.';
            working = false;
        }
    }
</script>

{#if $signInProviders.includes('password')}
    <form class="pw-form" onsubmit={(e) => { e.preventDefault(); signIn(); }}>
        <label class="pw-label" for="pw-email">Or sign in with an email and password</label>
        <input id="pw-email" class="field-input" type="email" autocomplete="email" required
               placeholder="you@example.com" bind:value={email} />
        <input id="pw-password" class="field-input" type="password" autocomplete="current-password"
               required placeholder="Password" bind:value={password} />
        <button class="secondary-button pw-submit" type="submit" disabled={working}>
            {working ? 'Signing in…' : 'Sign in'}
        </button>
        {#if error}<p class="field-error">{error}</p>{/if}
        <p class="pw-links">
            <a href={newHref}>Create an account</a>
            <span aria-hidden="true">·</span>
            <a href={forgotHref}>Forgotten your password?</a>
        </p>
    </form>
{/if}

<style>
    .pw-form { margin: 1.4rem auto 0; max-width: 26rem; display: flex; flex-direction: column; gap: 0.5rem; text-align: left; }
    .pw-label { font-size: 0.85rem; color: var(--color-text-dim); text-align: center; }
    .pw-submit { align-self: stretch; }
    .pw-links { margin: 0.2rem 0 0; text-align: center; font-size: 0.85rem; display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; }
    .pw-links a { color: var(--color-accent); }
</style>
