<script lang="ts">
    import { PUBLIC_API_URL } from '$env/static/public';
    import HelpTip from '$lib/HelpTip.svelte';
    import PieChart from '$lib/charts/PieChart.svelte';

    /**
     * The Weighting tab of the club admin page: how hard the matcher works on
     * each soft factor for one system. Split out of routes/admin/+page.svelte,
     * which now only frames it. Loads its own config when shown; the page used
     * to fetch it for every system at start-up, opened or not.
     *
     * General admin styles (.field, .field-label, .muted…) come from
     * club-admin.css; only this tab's own layout is styled here.
     */
    let { scope }: { scope: string } = $props();

    type PairingWeightConfigData = {
        uses_scenarios: boolean;
        uses_points: boolean;
        /** Whether this system defines faction categories at all. False for
         *  every flat-list system, where the category weight can have no
         *  effect and the slider is therefore not shown. */
        has_faction_groups: boolean;
        default_recent_weeks: number;
        default_extended_weeks: number;
        weight_mirror: number;
        weight_faction_group: number;
        weight_rematch: number;
        weight_vibe: number;
        weight_experience: number;
        weight_eta: number;
        weight_scenario: number;
        weight_points: number;
        recent_weeks: number | null;
        extended_weeks: number | null;
    };

    let config = $state<PairingWeightConfigData | null>(null);
    let loading = $state(false);
    let saving = $state(false);
    let error = $state<string | null>(null);
    let message = $state<string | null>(null);

    // Live "share of total" readout next to each slider — the sliders don't
    // rebalance each other (independent magnitude units, matching the
    // underlying linear-score formula in pairings_engine.py), but seeing
    // each one's share of the current total makes their relative influence
    // visible without that added complexity.
    function pwPercent(cfg: PairingWeightConfigData, field: keyof PairingWeightConfigData): number {
        const fields: (keyof PairingWeightConfigData)[] = [
            'weight_mirror', 'weight_rematch', 'weight_vibe', 'weight_experience', 'weight_eta',
        ];
        if (cfg.uses_scenarios) fields.push('weight_scenario');
        if (cfg.uses_points) fields.push('weight_points');
        if (cfg.has_faction_groups) fields.push('weight_faction_group');
        const total = fields.reduce((sum, f) => sum + (Number(cfg[f]) || 0), 0);
        if (total <= 0) return 0;
        return Math.round((Number(cfg[field]) / total) * 1000) / 10;
    }

    // Validated 7-slot categorical order (dataviz skill) for the live donut —
    // order is the CVD-safety mechanism, not cosmetic; matches the sliders'
    // display order below (mirror, rematch, vibe, experience, eta, scenario,
    // points). Do not reorder without re-validating with the palette script.
    //
    // Slot 8 (faction category) was appended rather than slotted in beside
    // mirror where it belongs conceptually, precisely so the validated
    // seven keep their exact colours and order. It is a dark navy: with
    // seven saturated hues already spent, the eighth is separated by
    // LIGHTNESS rather than hue, which is the one axis every form of colour
    // blindness leaves intact. Re-validate the whole set if the palette
    // script is ever run again.
    const PAIRING_WEIGHT_COLORS = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#1d3f8c'];

    function pairingWeightSlices(cfg: PairingWeightConfigData): { label: string; value: number; color: string }[] {
        const rows: { label: string; value: number }[] = [
            { label: 'Avoid same-faction rematch', value: cfg.weight_mirror },
            { label: 'Avoid recent repeat opponent', value: cfg.weight_rematch },
            { label: 'Vibe match', value: cfg.weight_vibe },
            { label: 'Experience match', value: cfg.weight_experience },
            { label: 'Arrival time (ETA) match', value: cfg.weight_eta },
        ];
        if (cfg.uses_scenarios) rows.push({ label: 'Scenario match', value: cfg.weight_scenario });
        if (cfg.uses_points) rows.push({ label: 'Points closeness', value: cfg.weight_points });
        if (cfg.has_faction_groups) rows.push({ label: 'Avoid same faction category', value: cfg.weight_faction_group });
        return rows.map((r, i) => ({ ...r, color: PAIRING_WEIGHT_COLORS[i] }));
    }

    async function load(forScope: string) {
        loading = true;
        error = null;
        message = null;
        config = null;
        const r = await fetch(`${PUBLIC_API_URL}/admin/pairing-config?system=${encodeURIComponent(forScope)}`, { credentials: 'include' });
        // Switched to another system while this was in flight: that one's load
        // owns the state now.
        if (forScope !== scope) return;
        if (r.ok) {
            config = await r.json();
        } else {
            error = 'Failed to load pairing weighting config.';
        }
        loading = false;
    }

    async function save() {
        if (!config) return;
        saving = true;
        error = null;
        message = null;
        // Empty window inputs → null so the platform default is used.
        const cleanWeeks = (v: number | null) => (v === null || Number.isNaN(v) || v < 1 ? null : Math.round(v));
        const r = await fetch(`${PUBLIC_API_URL}/admin/pairing-config`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...config,
                system: scope,
                recent_weeks: cleanWeeks(config.recent_weeks),
                extended_weeks: cleanWeeks(config.extended_weeks),
            }),
        });
        if (r.ok) {
            message = 'Saved. Takes effect on the next pairings preview/generate.';
        } else {
            const body = await r.json().catch(() => ({}));
            error = body.detail || 'Failed to save.';
        }
        saving = false;
    }

    $effect(() => {
        load(scope);
    });
</script>

{#if loading}
    <p class="muted small">Loading…</p>
{:else if error && !config}
    <p class="field-error">{error}</p>
{:else if config}
    <div class="league-settings-details">
        <div class="a-head">
            <div class="a-title">Matchmaking weights</div>
            <HelpTip
                label="matchmaking weights"
                text="How hard the matcher works to satisfy each factor when pairing this system. Higher means it matters more; set one to 0 to ignore it entirely. Admin blocks and “don't repeat last week's opponent” are always enforced first, whatever these say."
            />
        </div>
        <div class="league-settings-body">

            <div class="pairing-weight-layout">
            <div class="league-config-form pairing-weight-form">
                <div class="field">
                    <label class="field-label" for="pw-mirror-{scope}">Avoid same-faction rematch: {config.weight_mirror} ({pwPercent(config, 'weight_mirror')}%)</label>
                    <input id="pw-mirror-{scope}" type="range" min="0" max="10" step="0.5" bind:value={config.weight_mirror} />
                </div>
                <div class="field">
                    <label class="field-label" for="pw-rematch-{scope}">Avoid recent repeat opponent: {config.weight_rematch} ({pwPercent(config, 'weight_rematch')}%)</label>
                    <input id="pw-rematch-{scope}" type="range" min="0" max="10" step="0.5" bind:value={config.weight_rematch} />
                </div>
                <div class="field">
                    <label class="field-label" for="pw-vibe-{scope}">Match by vibe (casual/competitive): {config.weight_vibe} ({pwPercent(config, 'weight_vibe')}%)</label>
                    <input id="pw-vibe-{scope}" type="range" min="0" max="10" step="0.5" bind:value={config.weight_vibe} />
                </div>
                <div class="field">
                    <label class="field-label" for="pw-exp-{scope}">Match by experience: {config.weight_experience} ({pwPercent(config, 'weight_experience')}%)</label>
                    <input id="pw-exp-{scope}" type="range" min="0" max="10" step="0.5" bind:value={config.weight_experience} />
                </div>
                <div class="field">
                    <label class="field-label" for="pw-eta-{scope}">Match by arrival time (ETA): {config.weight_eta} ({pwPercent(config, 'weight_eta')}%)</label>
                    <input id="pw-eta-{scope}" type="range" min="0" max="10" step="0.5" bind:value={config.weight_eta} />
                </div>
                {#if config.uses_scenarios}
                    <div class="field">
                        <label class="field-label" for="pw-scen-{scope}">Match by scenario pick: {config.weight_scenario} ({pwPercent(config, 'weight_scenario')}%)</label>
                        <input id="pw-scen-{scope}" type="range" min="0" max="10" step="0.5" bind:value={config.weight_scenario} />
                    </div>
                {/if}
                {#if config.uses_points}
                    <div class="field">
                        <label class="field-label" for="pw-pts-{scope}">Match by points closeness: {config.weight_points} ({pwPercent(config, 'weight_points')}%)</label>
                        <input id="pw-pts-{scope}" type="range" min="0" max="10" step="0.5" bind:value={config.weight_points} />
                    </div>
                {/if}
                {#if config.has_faction_groups}
                    <div class="field">
                        <label class="field-label" for="pw-group-{scope}">Avoid same faction category: {config.weight_faction_group} ({pwPercent(config, 'weight_faction_group')}%)
                            <HelpTip label="faction categories" text={"Pushes the matcher towards games across this system's categories: Good against Evil, Axis against Allies.\n\nOnly a nudge. A block, a recent rematch or a vibe mismatch all outrank it, and it never stops a game happening."} /></label>
                        <input id="pw-group-{scope}" type="range" min="0" max="10" step="0.5" bind:value={config.weight_faction_group} />
                    </div>
                {/if}

                <div class="pw-window-block">
                    <div class="pw-window-title">Rematch windows
                        <HelpTip label="rematch windows" text={"How far back a repeat opponent counts as a rematch.\n\n• Inside the first window, a pair is skipped on the first pass\n• Inside the wider one, it is discouraged but allowed\n• Leave blank to use the system default"} /></div>
                    <div class="pw-window-row">
                        <div class="field field-narrow">
                            <label class="field-label" for="pw-recent-{scope}">Don't rematch within (weeks)</label>
                            <input id="pw-recent-{scope}" class="field-input" type="number" min="1" placeholder={String(config.default_recent_weeks)} bind:value={config.recent_weeks} />
                        </div>
                        <div class="field field-narrow">
                            <label class="field-label" for="pw-extended-{scope}">Soft-avoid within (weeks)</label>
                            <input id="pw-extended-{scope}" class="field-input" type="number" min="1" placeholder={String(config.default_extended_weeks)} bind:value={config.extended_weeks} />
                        </div>
                    </div>
                </div>

                {#if message}<p class="pairing-message">{message}</p>{/if}
                {#if error}<p class="field-error">{error}</p>{/if}
                <button
                    class="primary-button"
                    type="button"
                    disabled={saving}
                    onclick={save}
                >{saving ? 'Saving…' : 'Save weighting'}</button>
            </div>

            <div class="pairing-weight-chart">
                <div class="chart-card-title">Share of total weighting</div>
                <PieChart data={pairingWeightSlices(config)} />
            </div>
            </div>
        </div>
    </div>
{/if}

<style>
    /* ── Pairing weighting: sliders + live donut side by side ────────────── */
    .pairing-weight-layout {
        display: grid;
        grid-template-columns: minmax(280px, 420px) minmax(260px, 1fr);
        gap: 1.75rem;
        align-items: start;
    }

    .pw-window-block {
        margin-top: 0.6rem;
        padding-top: 0.75rem;
        border-top: 1px solid var(--color-steel-border-soft);
    }

    .pw-window-title {
        text-transform: uppercase;
        font-size: 0.72rem;
        font-weight: 700;
        letter-spacing: 1.4px;
        color: var(--color-accent);
        margin-bottom: 0.35rem;
    }

    .pw-window-row {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
        margin-top: 0.4rem;
    }

    .pairing-weight-form {
        min-width: 0;
    }

    .pairing-weight-chart {
        min-width: 0;
        background: var(--color-surface-dark);
        border: 1px solid var(--color-steel-border-soft);
        border-radius: var(--radius);
        padding: 0.95rem 1.05rem 1.05rem;
        position: sticky;
        top: 1rem;
    }

    @media (max-width: 760px) {
        .pairing-weight-layout {
            grid-template-columns: 1fr;
        }

        .pairing-weight-chart {
            position: static;
        }
    }
</style>
