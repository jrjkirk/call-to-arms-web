<script lang="ts">
    /**
     * The account page (account overhaul Slab 2, see the API repo's
     * ACCOUNT_OVERHAUL.md §7).
     *
     * An account is not a player. It is the person signing in, and it owns one
     * player per club they play at. This page is where the account-level things
     * live: the name the account goes by, the ways in, the player at each club,
     * and ending sessions. Later slabs add Google and email sign-in, and linking.
     *
     * The name here is the ACCOUNT's (users.display_name). A club roster name
     * is Player.name, set by that club's admins, and deliberately not editable
     * here: the pairing engine keys players on it.
     *
     * The "add another way to sign in" nudge renders only when the API lists
     * something in `can_add`. That list is empty while Discord is the only
     * method, so the nudge switches itself on when a second method ships.
     */
    import { onMount } from 'svelte';
    import { fly } from 'svelte/transition';
    import { cubicOut } from 'svelte/easing';
    import { page } from '$app/state';
    import { PUBLIC_API_URL } from '$env/static/public';
    import HelpTip from '$lib/HelpTip.svelte';
    import { getClubSlugFromHostname } from '$lib/clubSlug';

    type Identity = {
        id: number;
        provider: string;
        name: string | null;
        avatar_url: string | null;
        email: string | null;
        is_primary: boolean;
        created_at: string;
        last_used_at: string | null;
    };
    type AccountPlayer = {
        id: number;
        name: string;
        active: boolean;
        club: { id: number; slug: string; name: string };
    };
    type Account = {
        user: {
            id: number;
            name: string;
            display_name: string | null;
            discord_name: string | null;
            avatar_url: string | null;
            created_at: string;
        };
        identities: Identity[];
        players: AccountPlayer[];
        can_add: string[];
    };

    const PROVIDER_LABELS: Record<string, string> = {
        discord: 'Discord',
        google: 'Google',
        email: 'Email'
    };

    let account = $state<Account | null>(null);
    let loadError = $state<string | null>(null);
    const NAME_MAX = 32;
    let editingName = $state(false);
    let nameDraft = $state('');
    let savingName = $state(false);
    let nameError = $state<string | null>(null);
    let confirmingSignOut = $state(false);
    let signingOut = $state(false);
    let signOutError = $state<string | null>(null);

    async function load() {
        try {
            const r = await fetch(`${PUBLIC_API_URL}/auth/account`, { credentials: 'include' });
            if (!r.ok) {
                loadError = r.status === 401 ? 'Sign in to see your account.' : 'Could not load your account.';
                return;
            }
            account = await r.json();
        } catch (_) {
            loadError = 'Network error. Please try again.';
        }
    }

    onMount(load);

    const hereSlug = $derived(getClubSlugFromHostname(page.url.hostname));

    /** A player lives on its club's subdomain; stay on this one when it's here. */
    function profileHref(p: AccountPlayer): string {
        return p.club.slug === hereSlug
            ? `/players/${p.id}`
            : `https://${p.club.slug}.calltoarms.app/players/${p.id}`;
    }

    function providerLabel(provider: string): string {
        return PROVIDER_LABELS[provider] ?? provider;
    }

    function formatDate(iso: string | null): string {
        if (!iso) return '';
        const d = new Date(iso.endsWith('Z') || iso.includes('+') ? iso : `${iso}Z`);
        return d.toLocaleDateString('en-GB');
    }

    /** More than one identity from a provider means one of them is the one that
     *  counts (Discord: the account posts tag), so say which. */
    function sharesProvider(i: Identity): boolean {
        return (account?.identities ?? []).filter((x) => x.provider === i.provider).length > 1;
    }

    function startEditingName() {
        if (!account) return;
        nameDraft = account.user.display_name ?? '';
        nameError = null;
        editingName = true;
    }

    /** Save, or clear when blank: the account then goes by its Discord handle. */
    async function saveName() {
        if (savingName || !account) return;
        savingName = true;
        nameError = null;
        try {
            const r = await fetch(`${PUBLIC_API_URL}/auth/account`, {
                method: 'PATCH',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ display_name: nameDraft })
            });
            const body = await r.json().catch(() => ({}));
            if (!r.ok) {
                nameError = typeof body.detail === 'string' ? body.detail : 'Could not save your name.';
                return;
            }
            account.user = { ...account.user, ...body.user };
            editingName = false;
            // The header greets by this name too.
            const refresh = (window as any).__refreshAuth;
            if (typeof refresh === 'function') refresh();
        } catch (_) {
            nameError = 'Network error. Please try again.';
        } finally {
            savingName = false;
        }
    }

    async function signOutEverywhere() {
        if (signingOut) return;
        signingOut = true;
        signOutError = null;
        try {
            const r = await fetch(`${PUBLIC_API_URL}/auth/logout-everywhere`, {
                method: 'POST',
                credentials: 'include'
            });
            if (!r.ok) {
                signOutError = 'Could not sign out. Please try again.';
                signingOut = false;
                return;
            }
            window.location.href = '/';
        } catch (_) {
            signOutError = 'Network error. Please try again.';
            signingOut = false;
        }
    }
</script>

<h2 class="page-heading">Account</h2>

{#if loadError}
    <p class="account-muted">{loadError}</p>
{:else if !account}
    <p class="account-muted">Loading…</p>
{:else}
<div class="account" in:fly={{ y: 24, duration: 550, easing: cubicOut }}>

    <section class="a-card account-identity">
        {#if account.user.avatar_url}
            <img class="account-avatar" src={account.user.avatar_url} alt="" />
        {/if}
        <div class="account-identity-main">
            {#if editingName}
                <form class="account-name-form" onsubmit={(e) => { e.preventDefault(); saveName(); }}>
                    <label class="field-label" for="account-name">Name</label>
                    <div class="account-name-row">
                        <input
                            id="account-name"
                            class="field-input"
                            type="text"
                            maxlength={NAME_MAX}
                            placeholder={account.user.discord_name ?? ''}
                            bind:value={nameDraft}
                        />
                        <button class="primary-button" type="submit" disabled={savingName}>
                            {savingName ? 'Saving…' : 'Save'}
                        </button>
                        <button class="secondary-button" type="button" disabled={savingName}
                                onclick={() => (editingName = false)}>Cancel</button>
                    </div>
                    {#if nameError}
                        <p class="field-error">{nameError}</p>
                    {/if}
                </form>
            {:else}
                <div class="account-name-line">
                    <span class="account-name">{account.user.name}</span>
                    <button class="account-edit" type="button" onclick={startEditingName}>Edit</button>
                    <HelpTip
                        label="About your name"
                        text="The name Call to Arms greets you by, and shows club admins beside your Discord handle. Your name on each club's roster is set by that club's admins. Leave it blank to use your Discord name."
                    />
                </div>
                <div class="account-muted">Since {formatDate(account.user.created_at)}</div>
            {/if}
        </div>
    </section>

    <section class="a-card">
        <div class="a-head">
            <h3 class="a-title">Sign-in methods</h3>
        </div>
        <ul class="account-list">
            {#each account.identities as i (i.id)}
                <li class="account-row">
                    {#if i.avatar_url}
                        <img class="account-row-avatar" src={i.avatar_url} alt="" />
                    {:else}
                        <span class="account-row-avatar account-row-avatar-empty"></span>
                    {/if}
                    <div class="account-row-main">
                        <div class="account-row-title">{providerLabel(i.provider)} · {i.name ?? i.email ?? 'Unnamed'}</div>
                        {#if i.last_used_at}
                            <div class="account-muted">Last used {formatDate(i.last_used_at)}</div>
                        {/if}
                    </div>
                    {#if sharesProvider(i) && i.is_primary}
                        <span class="a-state is-on">Tagged in posts</span>
                        <HelpTip
                            label="Which {providerLabel(i.provider)} account is tagged"
                            text="Club posts tag this {providerLabel(i.provider)} account. Your other {providerLabel(i.provider)} accounts still sign you in."
                        />
                    {/if}
                </li>
            {/each}
        </ul>

        {#if account.can_add.length > 0}
            <div class="account-nudge">
                <div class="a-subtitle">Add another way to sign in</div>
                <div class="account-nudge-row">
                    {#each account.can_add as provider}
                        <a class="secondary-button" href={`${PUBLIC_API_URL}/auth/${provider}/link`}>
                            Add {providerLabel(provider)}
                        </a>
                    {/each}
                    <HelpTip
                        label="Why add another way to sign in"
                        text="If you lose access to one, the other still gets you into your games, level and league record."
                    />
                </div>
            </div>
        {/if}
    </section>

    <section class="a-card">
        <div class="a-head">
            <h3 class="a-title">Player profiles</h3>
            <HelpTip
                label="About player profiles"
                text="You have one player at each club you play at. Your name on a club's roster is set by that club's admins."
            />
        </div>
        {#if account.players.length === 0}
            <p class="account-muted">No player profiles yet.</p>
        {:else}
            <ul class="account-list">
                {#each account.players as p (p.id)}
                    <li class="account-row">
                        <div class="account-row-main">
                            <a class="account-row-title account-link" href={profileHref(p)}>{p.name}</a>
                            <div class="account-muted">{p.club.name}</div>
                        </div>
                        {#if !p.active}
                            <span class="a-state">Archived</span>
                        {/if}
                    </li>
                {/each}
            </ul>
        {/if}
    </section>

    <section class="a-card">
        <div class="a-head">
            <h3 class="a-title">Sessions</h3>
            <HelpTip
                label="About signing out everywhere"
                text="Ends every session on every device, including this one. Use it if you signed in somewhere you no longer control."
            />
        </div>
        {#if confirmingSignOut}
            <div class="account-confirm">
                <span>Sign out on every device?</span>
                <button class="danger-button" type="button" disabled={signingOut} onclick={signOutEverywhere}>
                    {signingOut ? 'Signing out…' : 'Sign out everywhere'}
                </button>
                <button class="secondary-button" type="button" disabled={signingOut}
                        onclick={() => (confirmingSignOut = false)}>Cancel</button>
            </div>
        {:else}
            <button class="danger-button" type="button" onclick={() => (confirmingSignOut = true)}>
                Sign out everywhere
            </button>
        {/if}
        {#if signOutError}
            <p class="field-error">{signOutError}</p>
        {/if}
    </section>
</div>
{/if}

<style>
    .page-heading { font-size: 1.5rem; margin: 0 0 1rem; }

    .account { max-width: 640px; }

    .account-muted {
        color: var(--color-text-dim);
        font-size: 0.84rem;
        margin: 0;
    }

    .account-identity {
        display: flex;
        align-items: center;
        gap: 0.9rem;
    }
    .account-avatar {
        width: 56px;
        height: 56px;
        border-radius: 50%;
        object-fit: cover;
        flex: 0 0 auto;
    }
    .account-identity-main {
        flex: 1 1 auto;
        min-width: 0;
    }
    .account-name {
        font-size: 1.15rem;
        font-weight: 700;
        color: var(--color-text-bright);
        overflow-wrap: anywhere;
    }
    .account-name-line {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex-wrap: wrap;
    }
    .account-edit {
        background: none;
        border: none;
        padding: 0;
        color: var(--color-accent);
        font: inherit;
        font-size: 0.84rem;
        cursor: pointer;
    }
    .account-edit:hover { text-decoration: underline; }
    .account-name-form .field-label { margin-bottom: 0.3rem; }
    .account-name-row {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex-wrap: wrap;
    }
    .account-name-row .field-input {
        flex: 1 1 12rem;
        min-width: 0;
    }

    .account-list {
        list-style: none;
        margin: 0.4rem 0 0;
        padding: 0;
    }
    .account-row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.4rem 0.7rem;
        padding: 0.6rem 0;
        border-top: 1px solid var(--color-steel-border-soft);
    }
    .account-row:first-child { border-top: none; }
    /* Wide enough to keep a name on one line; a status pill beside it wraps
       underneath on a phone instead of squeezing the name into a column. */
    .account-row-main {
        flex: 1 1 11rem;
        min-width: 0;
    }
    .account-row-title {
        color: var(--color-text-bright);
        font-weight: 600;
        overflow-wrap: anywhere;
    }
    .account-row-avatar {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        object-fit: cover;
        flex: 0 0 auto;
    }
    .account-row-avatar-empty {
        display: inline-block;
        background: var(--color-steel-border);
    }
    .account-link {
        text-decoration: none;
    }
    .account-link:hover { text-decoration: underline; }

    .account-nudge {
        border-top: 1px solid var(--color-steel-border-soft);
        margin-top: 0.4rem;
        padding-top: 0.2rem;
    }
    .account-nudge-row,
    .account-confirm {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        flex-wrap: wrap;
    }
    .account-confirm span {
        color: var(--color-text-base);
        font-size: 0.9rem;
    }
</style>
