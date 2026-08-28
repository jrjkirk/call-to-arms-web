<script lang="ts">
    import { onMount } from 'svelte';
    import { page } from '$app/state';
    import { PUBLIC_API_URL } from '$env/static/public';

    // Where the link in a booking email lands. The token IS the credential:
    // a guest has no account to sign in to, so holding the link is what proves
    // the booking is theirs. It opens exactly one booking and nothing else.
    const token = $derived(page.url.searchParams.get('token') ?? '');

    let booking = $state<any>(null);
    let canCancel = $state(false);
    let loading = $state(true);
    let notFound = $state(false);
    let cancelling = $state(false);
    let error = $state<string | null>(null);
    let confirmCancel = $state(false);

    async function load() {
        if (!token) { notFound = true; loading = false; return; }
        try {
            const r = await fetch(
                `${PUBLIC_API_URL}/venue/bookings/by-token?token=${encodeURIComponent(token)}`,
                { credentials: 'include' }
            );
            if (!r.ok) { notFound = true; return; }
            const json = await r.json();
            booking = json.booking;
            canCancel = json.can_cancel;
        } catch (_) {
            notFound = true;
        } finally {
            loading = false;
        }
    }
    onMount(load);

    async function cancel() {
        cancelling = true;
        error = null;
        try {
            const r = await fetch(
                `${PUBLIC_API_URL}/venue/bookings/by-token?token=${encodeURIComponent(token)}`,
                { method: 'DELETE', credentials: 'include' }
            );
            if (r.ok) {
                await load();
                confirmCancel = false;
            } else {
                error = (await r.json().catch(() => ({}))).detail || 'Could not cancel that.';
            }
        } catch (_) {
            error = 'Could not reach the venue just now. Try again in a moment.';
        } finally {
            cancelling = false;
        }
    }

    const statusLabel: Record<string, string> = {
        requested: 'Waiting for the venue to confirm',
        confirmed: 'Confirmed',
        cancelled: 'Cancelled',
        no_show: 'Marked as a no-show'
    };
</script>

<svelte:head><title>Your booking · Call to Arms</title></svelte:head>

<div class="container">
    <div class="a-card">
        <div class="a-head"><h1 class="a-title">Your booking</h1></div>

        {#if loading}
            <p class="a-note">Loading…</p>
        {:else if notFound}
            <p class="a-note">
                We couldn't find that booking. The link may have expired, or the booking may
                already have been removed. If you're not sure, contact the venue directly.
            </p>
            <a class="secondary-button" href="/book">Book a table</a>
        {:else}
            <p class="status" class:cancelled={booking.status === 'cancelled'}>
                {statusLabel[booking.status] ?? booking.status}
            </p>

            <dl class="detail">
                <dt>When</dt><dd>{booking.date}, {booking.time}</dd>
                <dt>Table</dt><dd>{booking.table}{booking.table_size ? ` (${booking.table_size})` : ''}</dd>
                <dt>Playing</dt><dd>{booking.game}</dd>
                <dt>Party</dt><dd>{booking.party_size} player{booking.party_size === 1 ? '' : 's'}</dd>
                <dt>Name</dt><dd>{booking.name}</dd>
            </dl>

            {#if error}<p class="field-error">{error}</p>{/if}

            {#if canCancel}
                {#if confirmCancel}
                    <p class="a-note">Cancel this booking? The table goes back on sale straight away.</p>
                    <div class="actions">
                        <button class="primary-button" type="button" disabled={cancelling} onclick={cancel}>
                            {cancelling ? 'Cancelling…' : 'Yes, cancel it'}
                        </button>
                        <button class="secondary-button" type="button" onclick={() => (confirmCancel = false)}>
                            Keep it
                        </button>
                    </div>
                {:else}
                    <button class="secondary-button" type="button" onclick={() => (confirmCancel = true)}>
                        Cancel this booking
                    </button>
                {/if}
            {:else}
                <a class="secondary-button" href="/book">Book another table</a>
            {/if}
        {/if}
    </div>
</div>

<style>
    .status {
        display: inline-block;
        margin: 0 0 1rem;
        padding: 0.25rem 0.7rem;
        border-radius: 999px;
        font-size: 0.8rem;
        font-weight: 700;
        letter-spacing: 0.02em;
        color: var(--color-accent);
        background: color-mix(in srgb, var(--color-accent) 14%, transparent);
        border: 1px solid var(--color-accent-border);
    }
    .status.cancelled {
        color: var(--color-text-dim);
        background: rgba(255, 255, 255, 0.05);
        border-color: var(--color-steel-border);
    }

    .detail {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 0.4rem 1.2rem;
        margin: 0 0 1.25rem;
    }
    .detail dt { color: var(--color-text-dim); font-size: 0.85rem; }
    .detail dd { margin: 0; font-weight: 600; }

    .actions { display: flex; gap: 0.6rem; flex-wrap: wrap; }
</style>
