import { db } from "@elkdonis/db";
import { requireOrgEditor } from "@/lib/auth";
import { siteConfig } from "@/config/site";

// ============================================================================
// The inbox.
//
// Built at the same time as the form, deliberately. A contact form whose
// messages have nowhere to be read is a form that loses them, and the site
// sends no mail — the network's SendGrid key is still a placeholder — so this
// page is the ONLY place a message exists. Shipping the form without it would
// have quietly turned the contact page into a drain.
// ============================================================================

export const dynamic = "force-dynamic";
export const metadata = { title: "Messages" };

interface Row {
  id: string;
  name: string | null;
  email: string;
  message: string | null;
  source: string | null;
  created_at: string;
}

export default async function MessagesPage() {
  await requireOrgEditor("/manage/messages");

  const rows = await db<Row[]>`
    SELECT id, name, email, message, source, created_at
    FROM contacts
    WHERE org_id = ${siteConfig.orgId}
    ORDER BY created_at DESC
    LIMIT 200
  `;

  return (
    <article className="content-page">
      <h1 className="page-title">Messages</h1>
      <p>
        Everything sent through a contact form on this site. Nothing is emailed
        on — this page is where they arrive.
      </p>

      {rows.length === 0 ? (
        <p style={{ fontStyle: "italic" }}>Nothing yet.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: "2rem 0 0" }}>
          {rows.map((row) => (
            <li
              key={row.id}
              style={{
                borderTop: "1px solid color-mix(in srgb, var(--ink) 28%, var(--violet))",
                padding: "1.1rem 0",
              }}
            >
              <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "baseline" }}>
                <strong>{row.name || "Someone"}</strong>
                {/* A mailto is the reply button until mail is wired up. */}
                <a href={`mailto:${row.email}`}>{row.email}</a>
                <span style={{ fontSize: ".8rem" }}>
                  {new Date(row.created_at).toLocaleString()}
                  {row.source ? ` · ${row.source}` : ""}
                </span>
              </div>
              {row.message ? (
                // Preserving the author's own line breaks, and still plain text
                // — never markup.
                <p style={{ whiteSpace: "pre-wrap", margin: ".5rem 0 0", lineHeight: 1.6 }}>
                  {row.message}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
