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
        has_password: boolean;
    };

    const PROVIDER_LABELS: Record<string, string> = {
        discord: 'Discord',
        google: 'Google',
        email: 'Email',
        password: 'Password'
    };

    let account = $state<Account | null>(null);
    let loadError = $state<string | null>(null);
    const NAME_MAX = 32;
    let editingName = $state(false);
    let nameDraft = $state('');
    let savingName = $state(false);
    let nameError = $state<string | null>(null);
    // Adding an email address: it can't be a redirect like Google, because the
    // address has to be typed and then confirmed from its own inbox.
    let addingEmail = $state(false);
    let emailDraft = $state('');
    let emailSending = $state(false);
    let emailMessage = $state<string | null>(null);
    let emailError = $state<string | null>(null);

    async function sendEmailLink() {
        if (emailSending) return;
        emailSending = true;
        emailError = null;
        try {
            const r = await fetch(`${PUBLIC_API_URL}/auth/email/link`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: emailDraft })
            });
            const body = await r.json().catch(() => ({}));
            if (!r.ok) {
                emailError = typeof body.detail === 'string' ? body.detail : 'Could not send the link.';
            } else {
                emailMessage = body.detail;
                addingEmail = false;
            }
        } catch (_) {
            emailError = 'Network error. Please try again.';
        } finally {
            emailSending = false;
        }
    }

    // ---- A password of their own (Slab 8) --------------------------------
    // Setting one needs a confirmed address to sign in with and to recover
    // through; the API refuses with that explanation if there isn't one.
    let editingPassword = $state(false);
    let currentPassword = $state('');
    let newPassword = $state('');
    let confirmPassword = $state('');
    let passwordSaving = $state(false);
    let passwordMessage = $state<string | null>(null);
    let passwordError = $state<string | null>(null);

    async function savePassword() {
        if (passwordSaving) return;
        if (newPassword !== confirmPassword) {
            passwordError = 'Those passwords don\'t match.';
            return;
        }
        passwordSaving = true;
        passwordError = null;
        try {
            const r = await fetch(`${PUBLIC_API_URL}/auth/password/set`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    password: newPassword,
                    current_password: account?.has_password ? currentPassword : null
                })
            });
            const body = await r.json().catch(() => ({}));
            if (!r.ok) {
                passwordError = typeof body.detail === 'string' ? body.detail : 'Could not save that password.';
                return;
            }
            passwordMessage = account?.has_password ? 'Password changed. Your other devices are signed out.' : 'Password set.';
            editingPassword = false;
            currentPassword = newPassword = confirmPassword = '';
            await load();
        } catch (_) {
            passwordError = 'Network error. Please try again.';
        } finally {
            passwordSaving = false;
        }
    }

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

    /** What came back from adding a sign-in method (/auth/<provider>/link
     *  returns here with ?linked= or ?link_error=). Read once, then taken off
     *  the address so a refresh doesn't say it again. */
    const LINK_ERRORS: Record<string, string> = {
        taken: 'That account is already on a different Call to Arms account, so it wasn\'t added.',
        signed_out: 'You were signed out before that finished. Sign in and try again.',
        cancelled: 'Nothing was added.',
        unavailable: 'Adding that isn\'t available right now.'
    };
    let linkNotice = $state<{ ok: boolean; text: string } | null>(null);

    onMount(() => {
        const params = page.url.searchParams;
        const linked = params.get('linked');
        const linkError = params.get('link_error');
        if (linked) {
            linkNotice = { ok: true, text: `${providerLabel(linked)} added to your account.` };
        } else if (linkError) {
            linkNotice = { ok: false, text: LINK_ERRORS[linkError] ?? 'That didn\'t work. Please try again.' };
        }
        if (params.get('merge') === 'pending') loadMerge(params.get('provider'));
        if (linked || linkError || params.get('merge')) {
            history.replaceState(history.state, '', page.url.pathname);
        }
        load();
    });

    // ---- Merging an account that turned out to be yours (Slab 6) ----------
    // Adding a sign-in method that already has its own account lands here with
    // ?merge=pending. The API holds the offer in a short-lived cookie bound to
    // this account and session; this shows what would move and lets them say.
    type MergePreview = {
        other: {
            name: string;
            created_at: string;
            identities: { provider: string; name: string | null; email: string | null }[];
            players: { name: string; club: string }[];
        };
        problems: string[];
    };
    let merge = $state<MergePreview | null>(null);
    let mergeProvider = $state<string | null>(null);
    let merging = $state(false);
    let mergeError = $state<string | null>(null);

    async function loadMerge(provider: string | null) {
        mergeProvider = provider;
        try {
            const r = await fetch(`${PUBLIC_API_URL}/auth/merge`, { credentials: 'include' });
            if (r.ok) merge = await r.json();
            else linkNotice = { ok: false, text: 'That offer to merge has expired. Add it again to see it.' };
        } catch (_) {
            /* the page still loads without it */
        }
    }

    async function confirmMerge() {
        if (merging) return;
        merging = true;
        mergeError = null;
        try {
            const r = await fetch(`${PUBLIC_API_URL}/auth/merge/confirm`, { method: 'POST', credentials: 'include' });
            const body = await r.json().catch(() => ({}));
            if (!r.ok) {
                mergeError = typeof body.detail === 'string' ? body.detail : 'Could not merge.';
                return;
            }
            merge = null;
            linkNotice = { ok: true, text: 'Accounts merged. Everything is on this account now.' };
            await load();
            const refresh = (window as any).__refreshAuth;
            if (typeof refresh === 'function') refresh();
        } catch (_) {
            mergeError = 'Network error. Please try again.';
        } finally {
            merging = false;
        }
    }

    async function cancelMerge() {
        merge = null;
        await fetch(`${PUBLIC_API_URL}/auth/merge/cancel`, { method: 'POST', credentials: 'include' }).catch(() => {});
    }

    // ---- Choosing and removing sign-in methods (Slab 6) ---------------------
    let removingId = $state<number | null>(null);
    let identityBusy = $state(false);
    let identityError = $state<string | null>(null);

    async function identityAction(url: string, method: 'POST' | 'DELETE') {
        if (identityBusy) return;
        identityBusy = true;
        identityError = null;
        try {
            const r = await fetch(url, { method, credentials: 'include' });
            const body = await r.json().catch(() => ({}));
            if (!r.ok) {
                identityError = typeof body.detail === 'string' ? body.detail : 'That didn\'t work.';
                return;
            }
            removingId = null;
            await load();
            const refresh = (window as any).__refreshAuth;
            if (typeof refresh === 'function') refresh();
        } catch (_) {
            identityError = 'Network error. Please try again.';
        } finally {
            identityBusy = false;
        }
    }

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

    {#if merge}
        <section class="a-card account-merge">
            <div class="a-head">
                <h3 class="a-title">That {providerLabel(mergeProvider ?? '')} account has its own account here</h3>
            </div>
            <p class="a-note">Merge it into this one and everything below moves here. Both ways in keep working.</p>
            <div class="account-merge-other">
                <div class="account-row-title">{merge.other.name}</div>
                <div class="account-muted">
                    {merge.other.identities.map((x) => `${providerLabel(x.provider)} · ${x.name ?? x.email ?? ''}`).join(', ')}
                </div>
                {#if merge.other.players.length}
                    <div class="account-muted">
                        Players: {merge.other.players.map((p) => `${p.name} (${p.club})`).join(', ')}
                    </div>
                {/if}
            </div>
            {#if merge.problems.length}
                <p class="field-error">These can't be merged yet: {merge.problems.join('; ')}. A club admin can help.</p>
                <button class="secondary-button" type="button" onclick={cancelMerge}>Close</button>
            {:else}
                <div class="account-confirm">
                    <button class="primary-button" type="button" disabled={merging} onclick={confirmMerge}>
                        {merging ? 'Merging…' : 'Merge into this account'}
                    </button>
                    <button class="secondary-button" type="button" disabled={merging} onclick={cancelMerge}>Not now</button>
                </div>
            {/if}
            {#if mergeError}<p class="field-error">{mergeError}</p>{/if}
        </section>
    {/if}

    {#if linkNotice}
        <p class="account-notice {linkNotice.ok ? 'pairing-message' : 'field-error'}" role="status">{linkNotice.text}</p>
    {/if}

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
                        {#if i.email && i.provider !== 'email'}
                            <div class="account-muted">{i.email}</div>
                        {/if}
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
                    <div class="account-row-actions">
                        {#if removingId === i.id}
                            <span class="account-muted">Remove this way in? Your other devices will be signed out.</span>
                            <button class="danger-button" type="button" disabled={identityBusy}
                                    onclick={() => identityAction(`${PUBLIC_API_URL}/auth/identities/${i.id}`, 'DELETE')}>Remove</button>
                            <button class="secondary-button" type="button" disabled={identityBusy}
                                    onclick={() => (removingId = null)}>Cancel</button>
                        {:else}
                            {#if i.provider === 'discord' && sharesProvider(i) && !i.is_primary}
                                <button class="account-edit" type="button" disabled={identityBusy}
                                        onclick={() => identityAction(`${PUBLIC_API_URL}/auth/identities/${i.id}/primary`, 'POST')}>Use for posts</button>
                            {/if}
                            {#if account.identities.length > 1}
                                <button class="account-edit" type="button" onclick={() => (removingId = i.id)}>Remove</button>
                            {/if}
                        {/if}
                    </div>
                </li>
            {/each}
        </ul>
        {#if identityError}
            <p class="field-error">{identityError}</p>
        {/if}
        {#if account.identities.some((i) => i.provider === 'discord')}
            <p class="account-another">
                <a href={`${PUBLIC_API_URL}/auth/discord/link`}>Add another Discord account</a>
                <HelpTip
                    label="Adding another Discord account"
                    text="For when you're in your club's Discord under a different account. Log in to that account on discord.com in this browser first: Discord adds whichever account is logged in there. Then choose it to be tagged in posts."
                />
            </p>
        {/if}

        <div class="account-password">
            <button class="account-edit" type="button"
                    onclick={() => { editingPassword = !editingPassword; passwordMessage = null; passwordError = null; }}>
                {account.has_password ? 'Change password' : 'Set a password'}
            </button>
            <HelpTip
                label="about passwords"
                text={"We never store your password, only a scrambled form of it that can't be turned back. Nobody here can read it, and nobody is ever emailed it.\n\nAt least 10 characters, and anything found in a known data breach is refused.\n\nChanging it signs you out on your other devices."}
            />
        </div>
        {#if editingPassword}
            <form class="account-password-form" onsubmit={(e) => { e.preventDefault(); savePassword(); }}>
                {#if account.has_password}
                    <div class="field">
                        <label class="field-label" for="pw-current">Current password</label>
                        <input id="pw-current" class="field-input" type="password" autocomplete="current-password"
                               required bind:value={currentPassword} />
                    </div>
                {/if}
                <div class="field">
                    <label class="field-label" for="pw-new">New password</label>
                    <input id="pw-new" class="field-input" type="password" autocomplete="new-password"
                           required bind:value={newPassword} />
                </div>
                <div class="field">
                    <label class="field-label" for="pw-again">New password again</label>
                    <input id="pw-again" class="field-input" type="password" autocomplete="new-password"
                           required bind:value={confirmPassword} />
                </div>
                {#if passwordError}<p class="field-error">{passwordError}</p>{/if}
                <button class="primary-button" type="submit" disabled={passwordSaving}>
                    {passwordSaving ? 'Saving…' : 'Save password'}
                </button>
            </form>
        {/if}
        {#if passwordMessage}
            <p class="pairing-message" role="status">{passwordMessage}</p>
        {/if}

        {#if account.can_add.length > 0}
            <div class="account-nudge">
                <div class="a-subtitle">Add another way to sign in</div>
                <div class="account-nudge-row">
                    {#each account.can_add.filter((p) => p !== 'password') as provider}
                        {#if provider === 'email'}
                            <button class="secondary-button" type="button"
                                    onclick={() => { addingEmail = !addingEmail; emailMessage = null; }}>Add email</button>
                        {:else}
                            <a class="secondary-button" href={`${PUBLIC_API_URL}/auth/${provider}/link`}>
                                Add {providerLabel(provider)}
                            </a>
                        {/if}
                    {/each}
                    <HelpTip
                        label="Why add another way to sign in"
                        text="If you lose access to one, the other still gets you into your games, level and league record."
                    />
                </div>
                {#if addingEmail}
                    <form class="account-email-form" onsubmit={(e) => { e.preventDefault(); sendEmailLink(); }}>
                        <label class="field-label" for="account-email">Email address</label>
                        <div class="account-name-row">
                            <input id="account-email" class="field-input" type="email" autocomplete="email"
                                   required bind:value={emailDraft} />
                            <button class="primary-button" type="submit" disabled={emailSending}>
                                {emailSending ? 'Sending…' : 'Send confirmation link'}
                            </button>
                        </div>
                        {#if emailError}<p class="field-error">{emailError}</p>{/if}
                    </form>
                {/if}
                {#if emailMessage}
                    <p class="pairing-message" role="status">{emailMessage}</p>
                {/if}
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
    .account-notice { margin: 0 0 0.9rem; }

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
    .account-name-form .field-label,
    .account-email-form .field-label { margin-bottom: 0.3rem; }
    .account-email-form { margin-top: 0.8rem; }
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

    .account-row-actions {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        flex-wrap: wrap;
        margin-left: auto;
    }
    .account-another {
        margin: 0.3rem 0 0;
        font-size: 0.84rem;
        display: flex;
        align-items: center;
        gap: 0.4rem;
    }
    .account-another a { color: var(--color-accent); }
    .account-password {
        margin: 0.5rem 0 0;
        display: flex;
        align-items: center;
        gap: 0.4rem;
    }
    .account-password-form { margin-top: 0.7rem; max-width: 22rem; }
    .account-password-form .field-label { margin-bottom: 0.3rem; }
    .account-merge { --panel-accent: var(--color-accent-bright); }
    .account-merge-other { margin: 0 0 0.9rem; }

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
