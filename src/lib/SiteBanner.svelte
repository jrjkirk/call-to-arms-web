<script lang="ts">
    import { onMount } from 'svelte';
    import { PUBLIC_API_URL } from '$env/static/public';

    type Banner = { active: boolean; message: string; severity: string };

    let banner = $state<Banner | null>(null);
    let dismissed = $state(false);

    const DISMISS_KEY = 'cta_banner_dismissed';

    onMount(async () => {
        try {
            const r = await fetch(`${PUBLIC_API_URL}/platform-banner`);
            if (r.ok) banner = await r.json();
        } catch (_) {
            banner = null;
        }
        // Dismissal is keyed on the message text itself — editing the banner
        // (even just re-saving the same text with a new severity) is treated
        // as a new message, so a visitor who dismissed yesterday's notice
        // still sees a genuinely new one instead of it staying hidden.
        if (banner?.message && sessionStorage.getItem(DISMISS_KEY) === banner.message) {
            dismissed = true;
        }
    });

    function dismiss() {
        if (banner?.message) sessionStorage.setItem(DISMISS_KEY, banner.message);
        dismissed = true;
    }
</script>

{#if banner?.active && !dismissed}
    <div class="site-banner" class:severity-warning={banner.severity === 'warning'} class:severity-critical={banner.severity === 'critical'}>
        <span class="site-banner-message">{banner.message}</span>
        <button type="button" class="site-banner-dismiss" onclick={dismiss} aria-label="Dismiss">&times;</button>
    </div>
{/if}

<style>
    .site-banner {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 1rem;
        padding: 0.55rem 1rem;
        background: var(--color-surface-hover);
        border-bottom: 1px solid var(--color-accent-border);
        color: var(--color-text-base);
        font-size: 0.85rem;
        text-align: center;
    }

    .site-banner.severity-warning {
        background: rgba(201, 161, 74, 0.14);
        border-bottom-color: var(--color-accent);
    }

    .site-banner.severity-critical {
        background: rgba(207, 90, 84, 0.14);
        border-bottom-color: var(--color-loss);
    }

    .site-banner-message {
        line-height: 1.4;
    }

    .site-banner-dismiss {
        flex: 0 0 auto;
        background: transparent;
        border: none;
        color: var(--color-text-faint);
        font-size: 1.1rem;
        line-height: 1;
        cursor: pointer;
        padding: 0 0.2rem;
    }

    .site-banner-dismiss:hover {
        color: var(--color-text-bright);
    }
</style>
