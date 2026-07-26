import adapter from '@sveltejs/adapter-vercel';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	kit: {
		adapter: adapter(),
		// Absolute asset paths (/_app/...) instead of the SvelteKit-2 default of
		// relative ones (./_app/...). The app is always served at the domain
		// root, and relative paths resolve differently per route / trailing
		// slash, which can leave a browser wedged on a stale document referencing
		// dead asset URLs. Absolute paths are unambiguous everywhere.
		paths: { relative: false },
		version: {
			// Use commit SHA on Vercel for a stable, per-commit hash; fall back to
			// a fixed string locally so repeated builds don't get new file names.
			name: process.env.VERCEL_GIT_COMMIT_SHA ?? 'dev'
		}
	}
};

export default config;
