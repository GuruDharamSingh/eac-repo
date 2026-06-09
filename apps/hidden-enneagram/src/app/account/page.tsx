import Link from "next/link";
import { requireUser, isOrgOwner } from "@/lib/session";
import { LogoutButton } from "@/components/logout-button";

export const dynamic = "force-dynamic";

const wrap: React.CSSProperties = {
  minHeight: "100vh",
  background: "#0a0a0c",
  color: "#ece7dd",
  padding: "96px 24px",
  fontFamily: "var(--font-eb-garamond), Georgia, serif",
};

export default async function AccountPage() {
  const user = await requireUser();
  const owner = await isOrgOwner(user);

  return (
    <main style={wrap}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <p
          style={{
            margin: "0 0 12px",
            fontSize: 12,
            letterSpacing: "0.28em",
            textTransform: "uppercase",
            color: "#8a857b",
          }}
        >
          Your account
        </p>
        <h1
          style={{
            margin: 0,
            fontFamily: "var(--font-cormorant), Georgia, serif",
            fontWeight: 500,
            fontSize: 48,
            lineHeight: 1.05,
          }}
        >
          Welcome
        </h1>
        <p style={{ marginTop: 14, fontSize: 18, color: "#bcb6aa" }}>
          Signed in as {user.email}. This is your member area — booking history
          and member content will live here.
        </p>

        <div style={{ marginTop: 36, display: "flex", gap: 16, flexWrap: "wrap" }}>
          <Link
            href="/"
            style={{
              padding: "10px 24px",
              border: "1px solid rgba(236,231,221,0.18)",
              borderRadius: 999,
              color: "#ece7dd",
              textDecoration: "none",
              fontSize: 12,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
            }}
          >
            ← Back to site
          </Link>
          {owner && (
            <Link
              href="/admin"
              style={{
                padding: "10px 24px",
                border: "1px solid #3aa99c",
                borderRadius: 999,
                color: "#3aa99c",
                textDecoration: "none",
                fontSize: 12,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
              }}
            >
              Manage site
            </Link>
          )}
          <LogoutButton />
        </div>
      </div>
    </main>
  );
}
