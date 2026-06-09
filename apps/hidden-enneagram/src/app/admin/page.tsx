import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@elkdonis/db";
import { requireUser, isOrgOwner, ORG_SLUG } from "@/lib/session";

export const dynamic = "force-dynamic";

const wrap: React.CSSProperties = {
  minHeight: "100vh",
  background: "#0a0a0c",
  color: "#ece7dd",
  padding: "96px 24px",
  fontFamily: "var(--font-eb-garamond), Georgia, serif",
};

type ContactRow = {
  id: string;
  email: string;
  name: string | null;
  message: string | null;
  created_at: string;
};

async function recentContacts(): Promise<ContactRow[]> {
  try {
    return await db<ContactRow[]>`
      SELECT id, email, name, message, created_at
      FROM contacts
      WHERE org_id = ${ORG_SLUG}
      ORDER BY created_at DESC
      LIMIT 20
    `;
  } catch {
    return [];
  }
}

export default async function AdminPage() {
  const user = await requireUser();
  const owner = await isOrgOwner(user);
  if (!owner) notFound();

  const contacts = await recentContacts();
  const artsUrl =
    process.env.NEXT_PUBLIC_ARTS_COLLECTIVE_URL ?? "http://localhost:3007";

  return (
    <main style={wrap}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <p
          style={{
            margin: "0 0 12px",
            fontSize: 12,
            letterSpacing: "0.28em",
            textTransform: "uppercase",
            color: "#8a857b",
          }}
        >
          Admin · {ORG_SLUG}
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
          Manage your site
        </h1>

        <section style={{ marginTop: 40 }}>
          <h2
            style={{
              fontFamily: "var(--font-cormorant), Georgia, serif",
              fontWeight: 500,
              fontSize: 28,
              margin: "0 0 12px",
            }}
          >
            Edit visually
          </h2>
          <p style={{ color: "#bcb6aa", fontSize: 17, margin: "0 0 16px" }}>
            Your pages are built with the Silex editor. Open it from the
            collective hub (sign in there with the same email), then publish to
            update this site.
          </p>
          <a
            href={`${artsUrl}/hub`}
            target="_blank"
            rel="noopener"
            style={{
              display: "inline-block",
              padding: "12px 28px",
              border: "1px solid #3aa99c",
              borderRadius: 999,
              color: "#3aa99c",
              textDecoration: "none",
              fontSize: 12,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
            }}
          >
            Open the editor →
          </a>
        </section>

        <section style={{ marginTop: 48 }}>
          <h2
            style={{
              fontFamily: "var(--font-cormorant), Georgia, serif",
              fontWeight: 500,
              fontSize: 28,
              margin: "0 0 12px",
            }}
          >
            Recent inquiries
          </h2>
          {contacts.length === 0 ? (
            <p style={{ color: "#8a857b", fontSize: 16 }}>No inquiries yet.</p>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 12 }}>
              {contacts.map((c) => (
                <li
                  key={c.id}
                  style={{
                    padding: "16px 18px",
                    border: "1px solid rgba(236,231,221,0.12)",
                    borderRadius: 10,
                    background: "#131319",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <strong style={{ color: "#ece7dd" }}>{c.name || c.email}</strong>
                    <span style={{ color: "#8a857b", fontSize: 13 }}>
                      {new Date(c.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div style={{ color: "#8a857b", fontSize: 14, marginTop: 2 }}>{c.email}</div>
                  {c.message && (
                    <p style={{ color: "#bcb6aa", fontSize: 15, marginTop: 8, whiteSpace: "pre-wrap" }}>
                      {c.message}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <p style={{ marginTop: 40 }}>
          <Link href="/account" style={{ color: "#3aa99c" }}>
            ← Back to account
          </Link>
        </p>
      </div>
    </main>
  );
}
