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

## Conventions

- `PUBLIC_API_URL` env var holds the backend base URL (set in `.env` locally, as a Vercel env var in production).
- All API fetches use `credentials: 'include'` — cross-site session-cookie auth.
- Preserve the dark/gold theme and Svelte 5 runes throughout. Do not switch to Svelte 4 options syntax.

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
