import { handleGetSession } from "@elkdonis/auth-server";

/**
 * The current session, for client components.
 *
 * Nothing in ArtDirect calls `useSession()` today — it reads the session on the
 * server. Added anyway: the hook is part of the shared client package, so its
 * endpoint missing here is a trap that only springs when someone adds a client
 * component months from now and gets `{user: null}` from a 404.
 */
export { handleGetSession as GET };
