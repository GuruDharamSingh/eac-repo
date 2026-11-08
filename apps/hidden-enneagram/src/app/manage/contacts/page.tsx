import { db } from "@elkdonis/db";
import { PageHeader } from "@elkdonis/cms-ui/manage";
import { siteConfig } from "@/config/site";
import { requireOrgEditor } from "@/lib/auth";

export const metadata = { title: "Contacts" };

interface ContactRow {
  id: string;
  email: string;
  name: string | null;
  message: string | null;
  created_at: string;
}

async function recentContacts(): Promise<ContactRow[]> {
  try {
    return await db<ContactRow[]>`
      SELECT id, email, name, message, created_at
      FROM contacts
      WHERE org_id = ${siteConfig.orgId}
      ORDER BY created_at DESC
      LIMIT 50
    `;
  } catch {
    return [];
  }
}

export default async function ManageContactsPage() {
  // Gate in the page as well as the layout: Next renders the two in parallel, and
  // the layout's redirect did not stop this page's data from streaming to a
  // signed-out visitor (verified on the live sites, 2026-11-06).
  await requireOrgEditor();
  const contacts = await recentContacts();

  return (
    <div>
      <PageHeader title="Contacts" description="Inquiries sent from the site's contact form." />

      <p className="mt-2 text-sm text-muted-foreground">
        Every page, the contact form&rsquo;s words included, is built in the{" "}
        <a href="/studio" className="underline underline-offset-4">
          page editor
        </a>
        .
      </p>

      <h3 className="mt-8 font-serif text-lg">Recent inquiries</h3>
      {contacts.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No inquiries yet.</p>
      ) : (
        <ul className="mt-3 grid gap-3">
          {contacts.map((c) => (
            <li key={c.id} className="rounded-md border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-3">
                <strong>{c.name || c.email}</strong>
                <span className="text-xs text-muted-foreground">
                  {new Date(c.created_at).toLocaleDateString()}
                </span>
              </div>
              <div className="text-sm text-muted-foreground">{c.email}</div>
              {c.message && (
                <p className="mt-2 whitespace-pre-wrap text-sm">{c.message}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
