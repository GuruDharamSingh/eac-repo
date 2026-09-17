import Link from "next/link";
import { listNewsletters, listRecipients } from "@elkdonis/newsletter/server";
import { requireOrgEditor } from "@/lib/auth";
import { siteConfig } from "@/config/site";

/**
 * Every letter this org has written.
 *
 * Creating one is visiting its address — the "New letter" form posts nowhere,
 * it just navigates to /manage/newsletter/<slug>, which opens an empty
 * editor. Same choice the Puck studio makes: a page that does not exist yet
 * is an empty canvas, not a 404 and a separate creation ceremony.
 */
export const dynamic = "force-dynamic";

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
}

export default async function NewsletterIndex() {
  await requireOrgEditor("/manage/newsletter");
  const [letters, recipients] = await Promise.all([
    listNewsletters(siteConfig.orgId),
    listRecipients(siteConfig.orgId),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <h1 className="font-serif text-3xl">Newsletter</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        A visual editor for email. {recipients.length}{" "}
        {recipients.length === 1 ? "person has" : "people have"} signed up and not
        unsubscribed.
      </p>

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
        <button
          type="submit"
          className="rounded bg-foreground px-4 py-2 text-sm text-background"
        >
          Start writing
        </button>
      </form>

      <ul className="mt-8 divide-y divide-border border-t border-border">
        {letters.length === 0 && (
          <li className="py-6 text-sm text-muted-foreground">
            Nothing written yet.
          </li>
        )}
        {letters.map((letter) => (
          <li key={letter.slug} className="flex items-baseline justify-between gap-4 py-3">
            <Link
              href={`/manage/newsletter/${letter.slug}`}
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
  await requireOrgEditor("/manage/newsletter");
  const slug = slugify(String(formData.get("title") ?? "")) || `letter-${Date.now()}`;
  redirect(`/manage/newsletter/${slug}?title=${encodeURIComponent(String(formData.get("title") ?? ""))}`);
}
