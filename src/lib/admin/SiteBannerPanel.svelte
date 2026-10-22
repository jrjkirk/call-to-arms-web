<script lang="ts">
    import { onMount } from 'svelte';
    import { PUBLIC_API_URL } from '$env/static/public';
    import HelpTip from '$lib/HelpTip.svelte';

    /**
     * The Site Banner tab of the platform admin page: the announcement shown
     * at the top of every club's pages, and the community Discord link shown on
     * every club's admin page. Split out of routes/platform-admin/+page.svelte;
     * loads both when opened. Shared styles come from platform-admin.css.
     */
    // Site Banner
    let siteBannerMessage = $state('');
    let siteBannerSeverity = $state('info');
    let siteBannerActive = $state(false);
    let siteBannerLoading = $state(false);
    let siteBannerSaving = $state(false);
    let siteBannerError = $state<string | null>(null);
    let siteBannerMessageOk = $state<string | null>(null);

    async function loadSiteBanner() {
        siteBannerLoading = true;
        const r = await fetch(`${PUBLIC_API_URL}/admin/platform/banner`, { credentials: 'include' });
        if (r.ok) {
            const data = await r.json();
            siteBannerMessage = data.message ?? '';
            siteBannerSeverity = data.severity ?? 'info';
            siteBannerActive = data.active ?? false;
        }
        siteBannerLoading = false;
    }

    async function saveSiteBanner() {
        siteBannerSaving = true;
        siteBannerError = null;
        siteBannerMessageOk = null;
        const r = await fetch(`${PUBLIC_API_URL}/admin/platform/banner`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: siteBannerMessage,
                severity: siteBannerSeverity,
                active: siteBannerActive,
            }),
        });
        if (r.ok) {
            siteBannerMessageOk = 'Saved.';
        } else {
            const body = await r.json().catch(() => ({}));
            siteBannerError = body.detail || 'Save failed.';
        }
        siteBannerSaving = false;
    }

    // Community / support Discord link (global; shown on every admin page)
    let communityDiscordUrl = $state('');
    let communityDiscordSaving = $state(false);
    let communityDiscordError = $state<string | null>(null);
    let communityDiscordOk = $state<string | null>(null);

    async function loadCommunityDiscord() {
        const r = await fetch(`${PUBLIC_API_URL}/admin/platform/community-discord`, { credentials: 'include' });
        if (r.ok) communityDiscordUrl = (await r.json()).url ?? '';
    }

    async function saveCommunityDiscord() {
        communityDiscordSaving = true;
        communityDiscordError = null;
        communityDiscordOk = null;
        const r = await fetch(`${PUBLIC_API_URL}/admin/platform/community-discord`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: communityDiscordUrl.trim() || null }),
        });
        if (r.ok) {
            communityDiscordOk = 'Saved.';
        } else {
            const body = await r.json().catch(() => ({}));
            communityDiscordError = body.detail || 'Save failed.';
        }
        communityDiscordSaving = false;
    }

    onMount(() => {
        loadSiteBanner();
        loadCommunityDiscord();
    });
</script>

<!-- ══ Site Banner ══ -->
<div class="dash-group">
    <div class="dash-group-header static">
        <span class="dash-group-title">Site Banner</span>
            <HelpTip label="site banner" text={"A message across the top of every page, for every club. Platform-wide, so use it for outages and releases, not for one club's news."} />
    </div>
    <div class="dash-group-body">
        <section class="admin-section">
            <h3 class="section-heading">Announcement Banner</h3>
            {#if siteBannerLoading}
                <p class="muted">Loading…</p>
            {:else}
                <div class="field">
                    <label class="field-label" for="banner-message">Message</label>
                    <textarea id="banner-message" class="field-input" rows="2" bind:value={siteBannerMessage}></textarea>
                </div>
                <div class="form-grid">
                    <div class="field">
                        <label class="field-label" for="banner-severity">Severity</label>
                        <select id="banner-severity" class="field-select" bind:value={siteBannerSeverity}>
                            <option value="info">Info</option>
                            <option value="warning">Warning</option>
                            <option value="critical">Critical</option>
                        </select>
                    </div>
                    <label class="check-row ap-toggle">
                        <input type="checkbox" bind:checked={siteBannerActive} />
                        <span>Active (visible to everyone)</span>
                    </label>
                </div>
                {#if siteBannerError}<p class="field-error">{siteBannerError}</p>{/if}
                {#if siteBannerMessageOk}<p class="pairing-message">{siteBannerMessageOk}</p>{/if}
                <button class="primary-button" type="button" disabled={siteBannerSaving} onclick={saveSiteBanner}>
                    {siteBannerSaving ? 'Saving…' : 'Save'}
                </button>
            {/if}
        </section>
    </div>
</div>

<div class="dash-group">
    <div class="dash-group-header static">
        <span class="dash-group-title">Community Discord link</span>
            <HelpTip label="community discord link" text={"The platform's own Discord:\n\n\u2022 Offered to players who haven't joined a club yet\n\u2022 Shown as a button on every club admin page\n\u2022 Leave blank to hide it\n\nNothing to do with any club's own server."} />
    </div>
    <div class="dash-group-body">
        <section class="admin-section">
            <div class="field">
                <label class="field-label" for="community-discord">Invite URL</label>
                <input id="community-discord" class="field-input" type="text" placeholder="https://discord.gg/…" bind:value={communityDiscordUrl} />
            </div>
            {#if communityDiscordError}<p class="field-error">{communityDiscordError}</p>{/if}
            {#if communityDiscordOk}<p class="pairing-message">{communityDiscordOk}</p>{/if}
            <button class="primary-button" type="button" disabled={communityDiscordSaving} onclick={saveCommunityDiscord}>
                {communityDiscordSaving ? 'Saving…' : 'Save'}
            </button>
        </section>
    </div>
</div>
