<script lang="ts">
    /**
     * The "don't see your club?" call to action.
     *
     * This used to BE the form, inline and anonymous. Requesting a club now
     * needs a Discord sign-in, and a sign-in needs somewhere to come back to,
     * so the form lives at /request-club and this is the doorway to it. Both
     * callers (the landing hero and /find) keep the same shape they had.
     */
</script>

<div class="request-section">
    <div class="request-heading">Don't see your club?</div>
    <p class="request-tagline">Tell us about it and we'll get you set up.</p>
    <a class="request-button" href="/request-club">Add your club</a>
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

    .request-button {
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
        text-decoration: none;
        transition: background 0.18s ease;
    }

    .request-button:hover {
        background: var(--color-accent-soft);
    }
</style>
