import { db } from "@elkdonis/db";
import { siteConfig } from "@/config/site";

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
  const contacts = await recentContacts();
  const artsUrl = process.env.NEXT_PUBLIC_ARTS_COLLECTIVE_URL ?? "http://localhost:3007";

  return (
    <div>
      <h2 className="font-serif text-xl">Contacts</h2>

      <p className="mt-2 text-sm text-muted-foreground">
        Pages are built with the Silex editor.{" "}
        <a
          href={`${artsUrl}/hub`}
          target="_blank"
          rel="noopener"
          className="underline underline-offset-4"
        >
          Open the editor
        </a>{" "}
        to change site copy — sign in there with the same email.
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
