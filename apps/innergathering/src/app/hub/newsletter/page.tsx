import type { Metadata } from "next";
import Link from "next/link";
import { listNewsletters, listRecipients } from "@elkdonis/newsletter/server";
import { requireOrgEditor } from "@/lib/auth";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = { title: "Newsletter" };
export const dynamic = "force-dynamic";

/**
 * Every letter this org has written.
 *
 * A newsletter is the one email here that is composed fresh each time rather
 * than templated, which is why it lives beside /hub/email rather than inside
 * it: the others are letters the system sends, this is a letter you send.
 *
 * Creating one is visiting its address — the form navigates to
 * /hub/newsletter/<slug>, which opens an empty editor. Same choice the Puck
 * studio makes: a page that does not exist yet is an empty canvas, not a 404
 * and a separate creation ceremony.
 */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export default async function NewsletterIndex() {
  await requireOrgEditor("/hub/newsletter");
  const [letters, recipients] = await Promise.all([
    listNewsletters(siteConfig.orgId),
    listRecipients(siteConfig.orgId),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <Link href="/hub/email" className="text-sm text-muted-foreground underline underline-offset-4">
        ← All email
      </Link>

      <h1 className="mt-3 font-serif text-3xl">Newsletter</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        A visual editor for email. {recipients.length}{" "}
        {recipients.length === 1 ? "person has" : "people have"} signed up and not
        unsubscribed.
      </p>

      {recipients.length === 0 && (
        <p className="mt-3 rounded border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
          Nobody to send to yet. Letters can still be written and tested on
          yourself &mdash; the send button stays disabled until someone signs up.
        </p>
      )}

      <form action={createLetter} className="mt-6 flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            New letter
          </span>
          <input
            name="title"
            required
            maxLength={200}
            placeholder="Spring news"
            className="w-64 rounded border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
        <button type="submit" className="rounded bg-foreground px-4 py-2 text-sm text-background">
          Start writing
        </button>
      </form>

      <ul className="mt-8 divide-y divide-border border-t border-border">
        {letters.length === 0 && (
          <li className="py-6 text-sm text-muted-foreground">Nothing written yet.</li>
        )}
        {letters.map((letter) => (
          <li key={letter.slug} className="flex items-baseline justify-between gap-4 py-3">
            <Link
              href={`/hub/newsletter/${letter.slug}`}
              className="font-medium no-underline hover:underline"
            >
              {letter.title}
            </Link>
            <span className="text-xs text-muted-foreground">
              {letter.sentAt
                ? `Sent to ${letter.sentCount} on ${new Date(letter.sentAt).toLocaleDateString()}`
                : "Draft"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

async function createLetter(formData: FormData) {
  "use server";
  const { redirect } = await import("next/navigation");
  await requireOrgEditor("/hub/newsletter");
  const title = String(formData.get("title") ?? "");
  const slug = slugify(title) || `letter-${Date.now()}`;
  redirect(`/hub/newsletter/${slug}?title=${encodeURIComponent(title)}`);
}
