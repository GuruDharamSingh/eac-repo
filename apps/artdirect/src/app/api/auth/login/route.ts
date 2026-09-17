import { handleLogin } from "@elkdonis/auth-server";

/**
 * Email + password sign-in.
 *
 * ArtDirect was the only app of the sixteen without this route, so
 * `signInWithPassword()` in @elkdonis/auth-client — which posts here — 404'd on
 * directory.arts-collective.com and nobody could sign in with a password. Only
 * the Google flow worked, because that one goes through ./callback, which did
 * exist.
 */
export { handleLogin as POST };
