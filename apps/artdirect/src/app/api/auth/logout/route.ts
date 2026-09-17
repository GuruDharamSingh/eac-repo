import { handleLogout } from "@elkdonis/auth-server";

/** Clears the session cookie. Posted to by `signOut()` in @elkdonis/auth-client. */
export { handleLogout as POST };
