<script lang="ts">
    /**
     * The shell both in-app handbooks render into.
     *
     * One component rather than two pages of markup, because the club and
     * system guides are the same document at different scopes and they have to
     * look like one thing. Sections are data, so adding a step is a list entry
     * rather than a block of copy pasted markup that drifts from its neighbour.
     */
    import HelpTip from './HelpTip.svelte';

    export type Block =
        | { p: string }
        | { list: string[] }
        | { where: string }
        | { fig: string; caption: string }
        | { note: string }          // quiet aside
        | { warn: string }          // the thing that bites you
        | { proof: string }         // how you know it worked
        | { table: { head: string[]; rows: string[][] } };

    export type Section = { id: string; title: string; lede?: string; blocks: Block[] };

    let { title, standfirst, sections, onnavigate }: {
        title: string;
        standfirst: string;
        sections: Section[];
        /** Jump the reader to the tab a step is about. */
        onnavigate?: (nav: string) => void;
    } = $props();

    let open = $state<string | null>(sections[0]?.id ?? null);

    /** A "Club admin › Systems" crumb, with its last part linkable. */
    function navTarget(where: string): string | null {
        const m = /›\s*([^›]+)$/.exec(where);
        return m ? m[1].trim() : null;
    }
</script>

<div class="hb">
    <header class="hb-head">
        <h2 class="a-title">{title}</h2>
        <p class="a-note">{standfirst}</p>
    </header>

    <nav class="hb-toc" aria-label="Contents">
        {#each sections as s, i}
            <button class="hb-toc-item" class:active={open === s.id}
                    type="button" onclick={() => (open = s.id)}>
                <span class="hb-n">{String(i + 1).padStart(2, '0')}</span>
                <span>{s.title}</span>
            </button>
        {/each}
    </nav>

    {#each sections as s, i}
        {#if open === s.id}
            <article class="hb-body" id="hb-{s.id}">
                <h3 class="hb-title"><span class="hb-n big">{String(i + 1).padStart(2, '0')}</span>{s.title}</h3>
                {#if s.lede}<p class="hb-lede">{s.lede}</p>{/if}

                {#each s.blocks as b}
                    {#if 'p' in b}
                        <p class="hb-p">{@html b.p}</p>
                    {:else if 'list' in b}
                        <ul class="hb-list">{#each b.list as li}<li>{@html li}</li>{/each}</ul>
                    {:else if 'where' in b}
                        {@const target = navTarget(b.where)}
                        <p class="hb-where">
                            <span class="hb-crumb">{b.where}</span>
                            {#if target && onnavigate}
                                <button class="hb-jump" type="button"
                                        onclick={() => onnavigate(target)}>Take me there</button>
                            {/if}
                        </p>
                    {:else if 'fig' in b}
                        <figure class="hb-fig">
                            <img src="/help/{b.fig}.png" alt={b.caption} loading="lazy" />
                            <figcaption>{b.caption}</figcaption>
                        </figure>
                    {:else if 'note' in b}
                        <p class="hb-note">{@html b.note}</p>
                    {:else if 'warn' in b}
                        <p class="hb-warn">{@html b.warn}</p>
                    {:else if 'proof' in b}
                        <p class="hb-proof"><span class="hb-proof-tag">Worked when</span>{@html b.proof}</p>
                    {:else if 'table' in b}
                        <div class="hb-tscroll">
                            <table class="hb-table">
                                <thead><tr>{#each b.table.head as h}<th>{h}</th>{/each}</tr></thead>
                                <tbody>
                                    {#each b.table.rows as row}
                                        <tr>{#each row as cell}<td>{@html cell}</td>{/each}</tr>
                                    {/each}
                                </tbody>
                            </table>
                        </div>
                    {/if}
                {/each}

                <div class="hb-foot">
                    {#if i > 0}
                        <button class="secondary-button" type="button"
                                onclick={() => (open = sections[i - 1].id)}>← {sections[i - 1].title}</button>
                    {/if}
                    {#if i < sections.length - 1}
                        <button class="primary-button" type="button"
                                onclick={() => (open = sections[i + 1].id)}>{sections[i + 1].title} →</button>
                    {/if}
                </div>
            </article>
        {/if}
    {/each}
</div>

<style>
    .hb-head { margin-bottom: 1rem; }
    .hb-head .a-note { max-width: 44rem; }

    /* Contents: a rail on wide screens, a wrapping row on narrow ones. */
    .hb-toc {
        display: flex;
        flex-wrap: wrap;
        gap: 0.3rem;
        padding-bottom: 0.9rem;
        margin-bottom: 1.2rem;
        border-bottom: 1px solid var(--color-steel-border);
    }
    .hb-toc-item {
        display: inline-flex;
        align-items: baseline;
        gap: 0.45rem;
        background: transparent;
        border: 1px solid var(--color-steel-border);
        border-radius: var(--radius);
        color: var(--color-text-muted);
        font-family: inherit;
        font-size: 0.78rem;
        padding: 0.28rem 0.6rem;
        cursor: pointer;
        text-align: left;
    }
    .hb-toc-item:hover { color: var(--color-text-bright); border-color: var(--color-accent); }
    .hb-toc-item.active {
        color: var(--color-accent);
        border-color: var(--color-accent);
        background: color-mix(in srgb, var(--color-accent) 10%, transparent);
    }
    .hb-n { font-size: 0.7rem; color: var(--color-text-faint); font-variant-numeric: tabular-nums; }
    .hb-toc-item.active .hb-n { color: var(--color-accent); }
    .hb-n.big { margin-right: 0.6rem; font-size: 0.85rem; }

    .hb-body { max-width: 44rem; }
    .hb-title { font-size: 1.15rem; font-weight: 700; color: var(--color-text-bright); margin: 0 0 0.5rem; }
    .hb-lede { color: var(--color-text-muted); margin: 0 0 1rem; }
    .hb-p { margin: 0 0 0.9rem; }
    .hb-list { margin: 0 0 0.9rem; padding-left: 1.2rem; }
    .hb-list li { margin-bottom: 0.35rem; }

    .hb-where { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin: 0 0 0.9rem; }
    .hb-crumb {
        font-family: ui-monospace, monospace;
        font-size: 0.74rem;
        background: color-mix(in srgb, var(--color-accent) 12%, transparent);
        color: var(--color-accent);
        border-radius: 2px;
        padding: 0.22rem 0.5rem;
    }
    .hb-jump {
        background: transparent; border: none; padding: 0;
        color: var(--color-text-faint); font-family: inherit; font-size: 0.74rem;
        text-decoration: underline; cursor: pointer;
    }
    .hb-jump:hover { color: var(--color-accent); }

    .hb-fig {
        margin: 0 0 1.1rem;
        border: 1px solid var(--color-steel-border);
        border-radius: 6px;
        overflow: hidden;
        background: rgba(0, 0, 0, 0.25);
    }
    .hb-fig img { display: block; width: 100%; height: auto; }
    .hb-fig figcaption {
        font-size: 0.78rem;
        color: var(--color-text-faint);
        padding: 0.5rem 0.7rem;
        border-top: 1px solid var(--color-steel-border);
    }

    .hb-note {
        border-left: 2px solid var(--color-steel-border);
        padding-left: 0.8rem;
        color: var(--color-text-faint);
        font-size: 0.9rem;
        margin: 0 0 0.9rem;
    }
    .hb-warn {
        border-left: 3px solid var(--color-loss);
        background: color-mix(in srgb, var(--color-loss) 8%, transparent);
        border-radius: 0 4px 4px 0;
        padding: 0.7rem 0.85rem;
        margin: 0 0 0.9rem;
        font-size: 0.92rem;
    }
    .hb-proof {
        border-left: 3px solid var(--color-win);
        background: color-mix(in srgb, var(--color-win) 9%, transparent);
        border-radius: 0 4px 4px 0;
        padding: 0.7rem 0.85rem;
        margin: 0 0 0.9rem;
        font-size: 0.92rem;
    }
    .hb-proof-tag {
        display: block;
        font-size: 0.62rem;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--color-win);
        margin-bottom: 0.2rem;
    }

    .hb-tscroll { overflow-x: auto; margin: 0 0 1rem; }
    .hb-table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
    .hb-table th {
        text-align: left;
        font-size: 0.64rem;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--color-text-faint);
        font-weight: 400;
        padding: 0 0.9rem 0.4rem 0;
        border-bottom: 1px solid var(--color-steel-border);
        white-space: nowrap;
    }
    .hb-table td {
        padding: 0.5rem 0.9rem 0.5rem 0;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        vertical-align: top;
    }

    .hb-foot {
        display: flex;
        justify-content: space-between;
        gap: 0.6rem;
        margin-top: 1.6rem;
        padding-top: 1rem;
        border-top: 1px solid var(--color-steel-border);
    }
    .hb-foot :only-child { margin-left: auto; }
</style>
