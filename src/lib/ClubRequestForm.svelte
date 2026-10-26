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

<!-- "Not here? / ADD YOUR CLUB", the same as at the foot of the Clubs page. -->
<div class="request-section">
    <span class="request-heading">Not here?</span>
    <a class="request-button" href="/request-club">Add your club</a>
</div>

<style>
    .request-section {
        width: 100%;
        margin-top: clamp(2.2rem, 5vw, 3rem);
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 1rem;
        flex-wrap: wrap;
    }

    .request-heading {
        font-family: var(--font-heading);
        color: var(--color-text-dim);
        font-size: 1.1rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.1em;
    }

    .request-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 2.8rem;
        padding: 0 1.6rem;
        background: var(--color-accent);
        border: 1px solid var(--color-accent);
        color: #1b1206;
        font-family: var(--font-heading);
        font-weight: 700;
        font-size: 1.05rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        border-radius: var(--radius);
        text-decoration: none;
        transition: background 0.18s ease;
    }

    .request-button:hover {
        background: var(--color-accent-soft);
    }
</style>
