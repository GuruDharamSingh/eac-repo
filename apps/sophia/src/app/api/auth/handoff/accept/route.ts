import { handleHandoffAccept } from "@elkdonis/auth-server";

/**
 * Arrive on Sophia carrying a sign-in from the network site (or any
 * allowed origin) — see handleHandoffAccept. Sophia has no login form of
 * its own: /login forwards to the network site, which signs the person in
 * and hands them back here through this route with a session for THIS host.
 */
export const dynamic = "force-dynamic";
export { handleHandoffAccept as GET };
