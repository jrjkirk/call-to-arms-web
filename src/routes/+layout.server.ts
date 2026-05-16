import type { LayoutServerLoad } from './$types';

// Reserved for future server-only data. Auth is fetched client-side in +layout.svelte
// because it needs to update reactively after the user claims their profile.
export const load: LayoutServerLoad = async () => {
    return {};
};