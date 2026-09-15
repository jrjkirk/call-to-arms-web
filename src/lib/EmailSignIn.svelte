<script lang="ts">
    /**
     * "Email me a sign-in link" (account overhaul Slab 5). Renders only when
     * the API offers email on sign-in screens ($lib/signInProviders).
     *
     * The answer is the same whether or not the address has an account; the
     * API decides the words, so this just shows them.
     */
    import { PUBLIC_API_URL } from '$env/static/public';
    import { signInProviders } from '$lib/signInProviders';

    let { next = null }: { next?: string | null } = $props();

    let email = $state('');
    let sending = $state(false);
    let sent = $state<string | null>(null);
    let error = $state<string | null>(null);

    async function send() {
        if (sending) return;
        sending = true;
        error = null;
        try {
            const r = await fetch(`${PUBLIC_API_URL}/auth/email/start`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                // The front door is where sign-in lands anyway; a next of "/" is noise.
                body: JSON.stringify({ email, next: next && next !== '/' ? next : null })
            });
            const body = await r.json().catch(() => ({}));
            if (!r.ok) {
                error = typeof body.detail === 'string' ? body.detail : 'Could not send a link.';
            } else {
                sent = body.detail;
            }
        } catch (_) {
            error = 'Network error. Please try again.';
        } finally {
            sending = false;
        }
    }
</script>

{#if $signInProviders.includes('email')}
    <div class="email-signin">
        {#if sent}
            <p class="email-signin-sent" role="status">{sent}</p>
        {:else}
            <form onsubmit={(e) => { e.preventDefault(); send(); }}>
                <label class="email-signin-label" for="email-signin">Or get a sign-in link by email</label>
                <div class="email-signin-row">
                    <input id="email-signin" class="field-input" type="email" autocomplete="email"
                           required placeholder="you@example.com" bind:value={email} />
                    <button class="secondary-button" type="submit" disabled={sending}>
                        {sending ? 'Sending…' : 'Email me a link'}
                    </button>
                </div>
                {#if error}<p class="field-error">{error}</p>{/if}
            </form>
        {/if}
    </div>
{/if}

<style>
    .email-signin { margin: 1.4rem auto 0; max-width: 26rem; text-align: left; }
    .email-signin-label { display: block; font-size: 0.85rem; color: var(--color-text-dim); margin-bottom: 0.4rem; text-align: center; }
    .email-signin-row { display: flex; gap: 0.5rem; flex-wrap: wrap; }
    .email-signin-row .field-input { flex: 1 1 12rem; min-width: 0; }
    .email-signin-sent { color: var(--color-text-base); text-align: center; line-height: 1.5; }
</style>
