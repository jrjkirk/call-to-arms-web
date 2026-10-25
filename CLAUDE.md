# Call to Arms — Web Frontend

## Stack & architecture

```
Browser → Vercel (SvelteKit, this repo) → Fly.io (FastAPI, ~/projects/call-to-arms-api) → Supabase Postgres
```

- **Frontend:** SvelteKit (Svelte 5, runes syntax), deployed to Vercel via `@sveltejs/adapter-vercel`
  - Live: https://call-to-arms-web.vercel.app
  - GitHub: github.com/jrjkirk/call-to-arms-web
- **Backend:** FastAPI at https://call-to-arms-api.fly.dev (separate repo `~/projects/call-to-arms-api`)
  - **Never modify the backend from this repo.** The backend is always healthy; assume it works.
  - Key endpoints: `/health` `/auth/me` `/auth/discord/login` `/players` `/league/rankings` `/pairings` `/signups/stats` `/signups` `/signups/mine`
  - Admin pairings endpoints: `/admin/pairings/preview` `/admin/pairings/generate` `/admin/pairings` `/admin/pairings/publish` `/admin/pairings/save` `/admin/pairings/post-discord` `/admin/pairings/signup-list`
  - Interactive docs: https://call-to-arms-api.fly.dev/docs
- **Auth:** Discord OAuth on the backend, `cta_session` cookie. Claim-profile flow links a Discord user to a `players` row.
  - **Planned overhaul:** Google / email sign-in and an account page. The audit lives in the API
    repo at `~/projects/call-to-arms-api/ACCOUNT_OVERHAUL.md` (read-only from here). It lists every
    hardcoded "Sign in with Discord" string and `discord_name` display site in this repo. All login
    links must keep going through `src/lib/loginUrl.ts`; never hand-write the login URL.

## UI copy: no unnecessary descriptors

**Write the label and stop.** A control that is self-evident from its label
and its value does not need a sentence underneath explaining it, and a
sentence that restates what the user can already see is noise they have to
read past every time.

Before adding any hint, caption or helper line, ask what a reader could not
work out without it. If the answer is "nothing", cut it. If the answer is a
genuine non-obvious consequence — where a value shows up, what happens on
save, a limit they'd otherwise hit — put it in a `HelpTip` rather than on the
page, so it's there when wanted and out of the way when not.

Applies equally to section intros: one line, or none. Anything longer belongs
in a tooltip.

## Design rules (Joel's, settled 2026-10-25)

One visual language for player pages and admin alike. The worked examples live
on the "Design cohesion" page of the design canvas
(claude.ai/artifact/Npyc8fdbhdfBhFehgedqAz).

1. **Colour is a standalone bar, never an edge.** A system, vibe, result or
   current item is marked by a 4px bar with rounded ends, sitting *beside* the
   content with a gap, like Home's "This week" rows. Never `border-left`,
   `border-top: 3px`, or an `inset` box-shadow sliver on a card. In CSS: a
   `<span>` or a `::before` with `width: 4px; border-radius: 2px`.
2. **Labels in capitals in the heading face.** Labels, headings, tabs, buttons
   and status words are Barlow Condensed (`var(--font-heading)`), uppercase,
   letter-spaced. Body text and values stay in Barlow, sentence case.
3. **No explanation text** (see the section above). Keep a `HelpTip` only where
   what something does genuinely isn't obvious from its label.
4. **Status is a coloured word, not a pill.** `PUBLISHED` in green, `DRAFTED`
   in gold, `NO PAIRINGS YET` in faint grey. No badges, dots or LEDs.
5. **Numbers are the headline.** A count or score is a big condensed figure
   with a small label under or beside it, not a sentence.
6. **One button language:** gold solid (the main action), gold outline
   (secondary), red outline (destructive), quiet grey outline. No Discord
   blurple, green fills or rounded pills for actions.

Palette: page `#0a0b0e`, panels `#13161e` with a `#232733` border, dividers
`#1c2029`, gold `#c9a14a`, win `#6fae72`, loss `#d4786c`. Dark and gold
always; no added imagery; gender-neutral copy.

Charts (`src/lib/charts`) follow the same rules: one series means one gold hue
and no legend (the card title names it), a big headline number above the
chart, no y-axis, recessive gridlines, the latest value labelled directly and
the rest on hover.

## Conventions

- `PUBLIC_API_URL` env var holds the backend base URL (set in `.env` locally, as a Vercel env var in production).
- All API fetches use `credentials: 'include'` — cross-site session-cookie auth.
- Preserve the dark/gold theme and Svelte 5 runes throughout. Do not switch to Svelte 4 options syntax.
- **The browser tab title lives in `src/lib/pageTitle.ts`, and only `+layout.svelte`
  may render a `<title>`.** Add new routes to `ROUTE_TITLES` there; if the title
  depends on fetched data, call `setPageTitle(page.route.id, ...)` from an
  `$effect` instead. A page that declares its own `<title>` reintroduces the bug
  this replaced: two competing `<title>` elements left the tab stuck on whichever
  page loaded first, and the ten routes that set none inherited it.

## Dev loop

```bash
# Frontend against production backend (most common)
cd ~/projects/call-to-arms-web
npm run dev        # http://localhost:5173

# Frontend against local backend
# In .env: PUBLIC_API_URL=http://localhost:8000
cd ~/projects/call-to-arms-api && source .venv/bin/activate && uvicorn main:app --reload
```

## Build & deploy

```bash
npm run build      # verify locally before pushing
git push           # Vercel auto-deploys in ~1–2 min
```

When a change spans both repos, **deploy the backend first**.

## ⚠️ Critical gotcha — kit.version.name must stay deterministic

`svelte.config.js` sets:

```js
version: { name: process.env.VERCEL_GIT_COMMIT_SHA ?? 'dev' }
```

**Do not change this to `Date.now()` or any other non-deterministic value.**

Why it matters: SvelteKit embeds `version.name` as a global variable name
(`globalThis.__sveltekit_<hash>`) in the main JS chunk. If the version is a
timestamp, every build produces unique content-hashes for every
`/_app/immutable/*` file. On Vercel this causes the SSR function's asset
manifest and the deployed static files to reference different filenames,
returning 404 for every JS and CSS chunk and completely killing client-side
hydration. `VERCEL_GIT_COMMIT_SHA` is set by Vercel during every build and
is stable for a given commit, so each deploy is deterministic and the
manifest always matches the deployed assets.

## When things break

**Hydration dead, console 404s for `/_app/immutable/*`:**
Run `npm run build` locally and check the hashes match; verify `kit.version.name`
is still pinned (see above).

**Build fails on Vercel:** run `npm run build` locally — the real error shows
there. Vercel's build log often truncates it.

**Backend issues:**
```bash
fly logs        # live tracebacks
fly status      # machine health
# Crash loop: fly scale count 0 → fix → commit/push → fly scale count 1 → fly deploy
```
