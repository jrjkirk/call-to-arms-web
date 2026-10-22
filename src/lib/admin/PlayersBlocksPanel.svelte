<script lang="ts">
    import { onMount } from 'svelte';
    import { PUBLIC_API_URL } from '$env/static/public';
    import HelpTip from '$lib/HelpTip.svelte';
    import { page } from '$app/state';
    import type { BlockEntry, BlockPlayer } from '$lib/admin/types';

    /**
     * The Players & blocks tab of the club admin page: editing a player's
     * profile (super-admin only) and the club-wide pairing blocks. Split out of
     * routes/admin/+page.svelte. The blocks themselves stay in the page, because the
     * Pairings tab reads them too, and come in as props; the editable player list
     * is this tab's own and loads when the tab opens. General admin styles come from
     * club-admin.css.
     */
    let { isSuperAdmin, blocks, blocksLoading, blockPlayers, loadBlocks }: { isSuperAdmin: boolean; blocks: BlockEntry[]; blocksLoading: boolean; blockPlayers: BlockPlayer[]; loadBlocks: () => Promise<void> } = $props();

    // Add block form state
    let addBlockP1Str = $state('');
    let addBlockP2Str = $state('');
    let addBlockNote = $state('');
    let addingBlock = $state(false);
    let addBlockError = $state<string | null>(null);

    // Edit Player Profile state
    type PlayerListItem = { id: number; name: string; titles: string[]; active: boolean; league_visible: boolean; claimed: boolean; account_name?: string | null; admin_notes: string | null };
    let editPlayerList = $state<PlayerListItem[]>([]);
    let editPlayerIdStr = $state('');
    let editPlayerName = $state('');
    let editPlayerTitlesText = $state('');
    let editPlayerActive = $state(true);
    let editPlayerLeagueVisible = $state(true);
    let editPlayerClaimed = $state(false);
    let editPlayerDeleting = $state(false);
    let editPlayerAdminNotes = $state('');
    let editPlayerSaving = $state(false);
    let editPlayerMessage = $state<string | null>(null);
    let editPlayerError = $state<string | null>(null);

    async function loadEditPlayerList() {
        const r = await fetch(`${PUBLIC_API_URL}/admin/players`, { credentials: 'include' });
        if (r.ok) editPlayerList = await r.json();
    }

    function onEditPlayerChange() {
        editPlayerMessage = null;
        editPlayerError = null;
        const player = editPlayerList.find(p => String(p.id) === editPlayerIdStr);
        if (!player) return;
        editPlayerName = player.name;
        editPlayerTitlesText = (player.titles ?? []).join('\n');
        editPlayerActive = player.active ?? true;
        editPlayerLeagueVisible = player.league_visible ?? true;
        editPlayerClaimed = player.claimed ?? false;
        editPlayerAdminNotes = player.admin_notes ?? '';
    }

    async function saveEditPlayer() {
        if (!editPlayerIdStr) return;
        editPlayerSaving = true;
        editPlayerMessage = null;
        editPlayerError = null;
        const titles = editPlayerTitlesText.split('\n').map(t => t.trim()).filter(Boolean);
        const r = await fetch(`${PUBLIC_API_URL}/admin/players/${editPlayerIdStr}`, {
            method: 'PATCH',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: editPlayerName,
                titles,
                active: editPlayerActive,
                league_visible: editPlayerLeagueVisible,
                admin_notes: editPlayerAdminNotes.trim() || null,
            }),
        });
        if (r.ok) {
            const updated = await r.json();
            editPlayerMessage = 'Saved.';
            editPlayerList = editPlayerList.map(p =>
                p.id === updated.id
                    ? { ...p, name: updated.name, titles: updated.titles, active: updated.active, league_visible: updated.league_visible, admin_notes: updated.admin_notes }
                    : p
            );
        } else {
            const body = await r.json().catch(() => ({}));
            editPlayerError = body.detail || 'Save failed.';
        }
        editPlayerSaving = false;
    }

    const editPlayerAccountName = $derived(
        editPlayerList.find((p) => String(p.id) === editPlayerIdStr)?.account_name ?? null
    );
    let accountNameResetting = $state(false);

    /** Clear the name the player's account chose; it goes back to their Discord name. */
    async function resetAccountName() {
        if (!editPlayerIdStr || accountNameResetting) return;
        accountNameResetting = true;
        editPlayerMessage = null;
        editPlayerError = null;
        const r = await fetch(`${PUBLIC_API_URL}/admin/players/${editPlayerIdStr}/reset-account-name`, {
            method: 'POST',
            credentials: 'include',
        });
        if (r.ok) {
            editPlayerList = editPlayerList.map((p) =>
                String(p.id) === editPlayerIdStr ? { ...p, account_name: null } : p
            );
            editPlayerMessage = 'Account name reset.';
        } else {
            const body = await r.json().catch(() => ({}));
            editPlayerError = body.detail || 'Reset failed.';
        }
        accountNameResetting = false;
    }

    async function deleteEditPlayer() {
        if (!editPlayerIdStr) return;
        const player = editPlayerList.find(p => String(p.id) === editPlayerIdStr);
        if (!player) return;
        if (!confirm(`Permanently delete ${player.name}? This cannot be undone.`)) return;
        editPlayerDeleting = true;
        editPlayerMessage = null;
        editPlayerError = null;
        const r = await fetch(`${PUBLIC_API_URL}/admin/players/${editPlayerIdStr}`, {
            method: 'DELETE',
            credentials: 'include',
        });
        if (r.ok) {
            editPlayerList = editPlayerList.filter(p => String(p.id) !== editPlayerIdStr);
            editPlayerIdStr = '';
            editPlayerMessage = `${player.name} deleted.`;
        } else {
            // The API refuses to delete anyone with games behind them and says
            // why — that message is the whole point, so show it verbatim
            // rather than a generic failure.
            const body = await r.json().catch(() => ({}));
            editPlayerError = body.detail || 'Delete failed.';
        }
        editPlayerDeleting = false;
    }

    async function addBlock() {
        if (!addBlockP1Str || !addBlockP2Str || addBlockP1Str === addBlockP2Str) return;
        addingBlock = true;
        addBlockError = null;
        const r = await fetch(`${PUBLIC_API_URL}/admin/blocks`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                player_a_id: Number(addBlockP1Str),
                player_b_id: Number(addBlockP2Str),
                note: addBlockNote.trim() || null,
            }),
        });
        if (!r.ok) {
            const body = await r.json().catch(() => ({}));
            addBlockError = body.detail || 'Failed to add block.';
        } else {
            addBlockP1Str = '';
            addBlockP2Str = '';
            addBlockNote = '';
            await loadBlocks();
        }
        addingBlock = false;
    }

    async function removeBlock(playerAId: number, playerBId: number, system: string | null = null) {
        const params = new URLSearchParams({
            player_a_id: String(playerAId),
            player_b_id: String(playerBId),
        });
        // Uniqueness is per (pair, system) now. Without this the delete looks
        // for a club-wide row that does not exist and quietly removes nothing.
        if (system) params.set('system', system);
        const r = await fetch(`${PUBLIC_API_URL}/admin/blocks?${params}`, {
            method: 'DELETE',
            credentials: 'include',
        });
        if (r.ok) await loadBlocks();
    }

    // Only a super-admin sees the profile editor, so only they need the list.
    onMount(() => {
        if (isSuperAdmin) loadEditPlayerList();
    });
</script>

<!-- ══ Players & Blocks ══ -->
<div class="dash-group">
        <div class="dash-group-header static">
            <span class="dash-group-title">Players &amp; Blocks</span>
        </div>
    <div class="dash-group-body">
{#if isSuperAdmin}
    <!-- ── Edit Player Profile ───────────────────────────────────────────── -->
    <section class="admin-section">
        <h3 class="section-heading">Edit Player Profile</h3>
        <div class="player-edit-form">
            <div class="field">
                <label class="field-label" for="edit-player-picker">Choose a Player to Edit</label>
                <select
                    id="edit-player-picker"
                    class="field-select"
                    bind:value={editPlayerIdStr}
                    onchange={onEditPlayerChange}
                >
                    <option value="">Select player</option>
                    {#each editPlayerList as p}
                        <option value={String(p.id)}>{p.name} (#{p.id})</option>
                    {/each}
                </select>
            </div>

            {#if editPlayerIdStr}
                <div class="field player-edit-wide">
                    <label class="field-label" for="edit-player-name">Roster name</label>
                    <input id="edit-player-name" class="field-input" type="text" bind:value={editPlayerName} />
                </div>
                {#if editPlayerAccountName}
                    <div class="field player-edit-wide">
                        <span class="field-label">
                            Account name <HelpTip label="account name" text={"The name this player chose for their account. It greets them and shows in admin lists, not on the roster or in Discord posts.\n\nReset puts their Discord name back."} />
                        </span>
                        <div class="account-name-reset">
                            <span>{editPlayerAccountName}</span>
                            <button class="secondary-button" type="button" disabled={accountNameResetting} onclick={resetAccountName}>
                                {accountNameResetting ? 'Resetting…' : 'Reset'}
                            </button>
                        </div>
                    </div>
                {/if}
                <div class="field player-edit-wide">
                    <label class="field-label" for="edit-player-titles">Titles (one per line)</label>
                    <textarea
                        id="edit-player-titles"
                        class="field-input field-textarea"
                        rows="3"
                        bind:value={editPlayerTitlesText}
                    ></textarea>
                </div>
                <div class="player-edit-wide">
                    <label class="check-row">
                        <input type="checkbox" bind:checked={editPlayerActive} />
                        <span>On the roster</span>
                        <HelpTip
                            label="roster"
                            text={"Off = archived, for someone who has left.\n\nThey disappear from signup, pairings and the league, but every game they played stays on record. If they come back, turning this on returns them to their own profile.\n\nArchiving never unlinks their account. Don't delete a player who has left; archive them."}
                        />
                    </label>
                    <label class="check-row">
                        <input type="checkbox" bind:checked={editPlayerLeagueVisible} />
                        <span>List in the league</span>
                        <HelpTip
                            label="league listing"
                            text={"Off = they play and get paired as normal, but don't appear in league standings.\n\nFor casuals, or anyone who asked not to be ranked. Archived players are out of the league either way."}
                        />
                    </label>
                </div>
                <div class="field player-edit-wide">
                    <label class="field-label" for="edit-player-notes">
                        Admin Notes <HelpTip label="admin notes" text={"Only ever seen by your club's admins. Never shown to the player or on any public page."} />
                    </label>
                    <textarea
                        id="edit-player-notes"
                        class="field-input field-textarea"
                        rows="3"
                        bind:value={editPlayerAdminNotes}
                    ></textarea>
                </div>
                {#if editPlayerError}
                    <p class="field-error">{editPlayerError}</p>
                {/if}
                {#if editPlayerMessage}
                    <p class="pairing-message">{editPlayerMessage}</p>
                {/if}
                <div class="player-edit-actions player-edit-wide">
                    <button
                        class="primary-button"
                        type="button"
                        disabled={editPlayerSaving}
                        onclick={saveEditPlayer}
                    >{editPlayerSaving ? 'Saving…' : 'Save'}</button>
                    <button
                        class="danger-button"
                        type="button"
                        disabled={editPlayerDeleting}
                        onclick={deleteEditPlayer}
                    >{editPlayerDeleting ? 'Deleting…' : 'Delete'}</button>
                    <HelpTip
                        label="delete"
                        text={"Only for a row that should never have existed: a duplicate, a typo, a test entry.\n\nA player with games behind them can't be deleted; the club would keep their old pairings and league results with nobody attached to them. Archive those instead.\n\n" + (editPlayerClaimed ? "This player has a Discord account linked to them." : "No Discord account is linked to this player.")}
                    />
                </div>
            {/if}
        </div>
    </section>
{/if}
<section class="admin-section">
    <div class="a-head">
        <h3 class="section-heading">Pairing blocks</h3>
        <HelpTip label="player blocks" text={"A block stops the matcher ever pairing those two players.\n\n\u2022 Added here it covers every system your club runs\n\u2022 A system's own admin can add one that covers only their game night, from that system's Players tab\n\u2022 Both kinds are listed here"} />
        <span class="a-head-end">
            <span class="a-state" class:is-on={blocks.length > 0}>{blocks.length} active</span>
        </span>
    </div>
    {#if isSuperAdmin}
        <div class="sub-section">
            <h4 class="a-title">Add a block</h4>
            <form class="appoint-form" onsubmit={(e) => { e.preventDefault(); addBlock(); }}>
                <div class="field">
                    <label class="field-label" for="block-p1">Player A</label>
                    <select id="block-p1" class="field-select" bind:value={addBlockP1Str}>
                        <option value="">Select</option>
                        {#each blockPlayers as p}
                            <option value={String(p.id)}>{p.name}</option>
                        {/each}
                    </select>
                </div>
                <div class="field">
                    <label class="field-label" for="block-p2">Player B</label>
                    <select id="block-p2" class="field-select" bind:value={addBlockP2Str}>
                        <option value="">Select</option>
                        {#each blockPlayers as p}
                            <option value={String(p.id)}>{p.name}</option>
                        {/each}
                    </select>
                </div>
                <div class="field">
                    <label class="field-label" for="block-note">Note</label>
                    <input
                        id="block-note"
                        class="field-input"
                        type="text"
                        bind:value={addBlockNote}
                        placeholder="optional reason…"
                    />
                </div>
                {#if addBlockP1Str && addBlockP2Str && addBlockP1Str === addBlockP2Str}
                    <p class="field-error">Players must be different.</p>
                {/if}
                {#if addBlockError}
                    <p class="field-error">{addBlockError}</p>
                {/if}
                <button
                    type="submit"
                    class="primary-button"
                    disabled={!addBlockP1Str || !addBlockP2Str || addBlockP1Str === addBlockP2Str || addingBlock}
                >
                    {addingBlock ? 'Adding…' : 'Add Block'}
                </button>
            </form>
        </div>
    {/if}

    <div class="sub-section">
        {#if blocksLoading}
            <p class="muted">Loading…</p>
        {:else if blocks.length === 0}
            <p class="muted">No blocks configured.</p>
        {:else}
            <ul class="block-list">
                {#each blocks as block}
                    <li class="block-row">
                        <span class="block-names">
                            <strong>{block.player_a_name}</strong>
                            <span class="block-x">✕</span>
                            <strong>{block.player_b_name}</strong>
                            <span class="sp-tag">{block.club_wide ? 'club-wide' : block.system}</span>
                        </span>
                        {#if block.note}
                            <span class="block-note">{block.note}</span>
                        {/if}
                        {#if isSuperAdmin}
                            <button
                                class="remove-btn block-remove"
                                type="button"
                                title={block.club_wide ? 'Remove block' : `Remove this ${block.system} block`}
                                onclick={() => removeBlock(block.player_a_id, block.player_b_id, block.system)}
                            >×</button>
                        {/if}
                    </li>
                {/each}
            </ul>
        {/if}
    </div>

    {#if !isSuperAdmin}
        <p class="muted small">Block list is managed by the lead admin.</p>
    {/if}
</section>
    </div>
</div>

<style>
    .account-name-reset {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        flex-wrap: wrap;
        color: var(--color-text-base);
    }

    /* ── Edit Player Profile ────────────────────────────────────────────── */
    .player-edit-form {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        max-width: 480px;
    }

    .player-edit-actions {
        display: flex;
        align-items: center;
        gap: 0.6rem;
    }

    /* Push the destructive action away from Save so the two are never one
    mis-aimed click apart. */
    .player-edit-actions .danger-button {
        margin-left: auto;
    }
</style>
