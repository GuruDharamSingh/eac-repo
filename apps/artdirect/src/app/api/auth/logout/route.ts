import { handleLogout, handleLogoutRedirect } from "@elkdonis/auth-server";

/** Clears the session cookie. Posted to by `signOut()` in @elkdonis/auth-client. */
export { handleLogout as POST };
/** The same sign-out for the header's plain link (`/api/auth/logout?next=/`). */
export { handleLogoutRedirect as GET };
