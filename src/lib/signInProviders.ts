/**
 * Which sign-in methods the sign-in screens offer, as the API reports them on
 * /auth/me (account overhaul Slab 4). The layout sets it once per auth refresh.
 *
 * Discord only until the API has Google configured AND switched to "open"
 * (GOOGLE_SIGNIN on the API). Before that, Google can only be added from
 * /account, so a Discord regular can't sign in with Google by accident and
 * find themselves in a second, empty account.
 */
import { writable } from 'svelte/store';

export type SignInProvider = 'discord' | 'google' | 'email';

export const signInProviders = writable<SignInProvider[]>(['discord']);
