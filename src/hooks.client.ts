import type { HandleClientError } from '@sveltejs/kit';

// A failed dynamic import (a JS "chunk" 404) almost always means a new build was
// deployed while this tab still held an old document — the chunk filenames
// changed. Rather than dead-ending on the 500 error page, reload once to pull
// the fresh build. Guarded by sessionStorage so a genuinely-missing chunk (or
// an extension that keeps aborting the request) can't cause a reload loop — at
// most one reload, then the normal error surfaces.
const IMPORT_FAILURE =
    /dynamically imported module|Importing a module script failed|error loading dynamically imported|Failed to fetch/i;

const RELOAD_FLAG = 'cta_reloaded_for_stale_chunk';

export const handleError: HandleClientError = ({ error, message }) => {
    const text = String((error as { message?: string } | null)?.message ?? message ?? '');
    if (typeof window !== 'undefined' && IMPORT_FAILURE.test(text)) {
        try {
            if (!sessionStorage.getItem(RELOAD_FLAG)) {
                sessionStorage.setItem(RELOAD_FLAG, '1');
                location.reload();
                return;
            }
        } catch (_) {
            /* sessionStorage unavailable — fall through to the error page */
        }
    }
};
