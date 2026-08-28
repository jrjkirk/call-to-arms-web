<script lang="ts">
    /**
     * An on/off switch for a section header.
     *
     * A real switch rather than the `.a-state` pill it replaces in some
     * headers: the pill only ever reported, and "is this on?" and "turn this
     * off" were two different places. Keeps the pill's position (`.a-head-end`)
     * so the answer stays where people already look for it.
     */
    let { checked, label, busy = false, disabled = false, onchange }: {
        checked: boolean;
        /** For screen readers: what this switches, e.g. "pairings posts". */
        label: string;
        busy?: boolean;
        disabled?: boolean;
        onchange: (next: boolean) => void;
    } = $props();
</script>

<button
    type="button"
    class="tgl"
    class:on={checked}
    role="switch"
    aria-checked={checked}
    aria-label="{label}: {checked ? 'on' : 'off'}"
    disabled={busy || disabled}
    onclick={() => onchange(!checked)}
>
    <span class="tgl-track"><span class="tgl-knob"></span></span>
    <span class="tgl-text">{busy ? '…' : checked ? 'On' : 'Off'}</span>
</button>

<style>
    .tgl {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        background: transparent;
        border: none;
        padding: 0;
        cursor: pointer;
        font-family: inherit;
        font-size: 0.7rem;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--color-text-faint);
    }
    .tgl:disabled { cursor: default; opacity: 0.6; }
    .tgl:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 3px; border-radius: 3px; }

    .tgl-track {
        width: 2rem;
        height: 1.1rem;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.09);
        border: 1px solid var(--color-steel-border);
        position: relative;
        transition: background 0.15s, border-color 0.15s;
        flex: none;
    }
    .tgl-knob {
        position: absolute;
        top: 1px;
        left: 1px;
        width: 0.85rem;
        height: 0.85rem;
        border-radius: 50%;
        background: var(--color-text-faint);
        transition: transform 0.15s, background 0.15s;
    }
    .tgl.on .tgl-track {
        background: color-mix(in srgb, var(--color-win) 30%, transparent);
        border-color: var(--color-win);
    }
    .tgl.on .tgl-knob { transform: translateX(0.9rem); background: var(--color-win); }
    .tgl.on .tgl-text { color: var(--color-win); }

    @media (prefers-reduced-motion: reduce) {
        .tgl-track, .tgl-knob { transition: none; }
    }
</style>
