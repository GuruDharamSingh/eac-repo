import Link from "next/link";
import { getServerSession } from "@elkdonis/auth-server";

/**
 * Unobtrusive top-right auth link overlaid on the published site. The enneagram
 * nav keeps its mark centered + hamburger left, so the right corner is free.
 */
export async function AuthNav() {
  let signedIn = false;
  try {
    const { user } = await getServerSession();
    signedIn = Boolean(user);
  } catch {
    signedIn = false;
  }

  return (
    <div
      style={{
        position: "fixed",
        top: 20,
        right: 26,
        zIndex: 60,
        display: "flex",
        gap: 18,
        fontFamily: "var(--font-eb-garamond), Georgia, serif",
        fontSize: 12,
        letterSpacing: "0.18em",
        textTransform: "uppercase",
      }}
    >
      {signedIn ? (
        <Link href="/account" style={{ color: "#ece7dd", textDecoration: "none" }}>
          Account
        </Link>
      ) : (
        <Link href="/login" style={{ color: "#ece7dd", textDecoration: "none" }}>
          Sign in
        </Link>
      )}
    </div>
  );
}
