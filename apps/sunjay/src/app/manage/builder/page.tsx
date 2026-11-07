import Link from "next/link";
import { listPages, HOME_SLUG } from "@/lib/puck/store";
import { NewPageForm } from "@/components/manage/new-page-form";
import { TEMPLATE_SLUGS } from "@/lib/puck/reserved";
import { requireOrgEditor } from "@/lib/auth";

const TEMPLATES = [
  {
    slug: "event-detail",
    title: "Event detail page",
    blurb: "Draws the page of every gathering given a detail page: how-to-join steps, the Talk room, RSVP, materials and description. Switch a gathering on from its own page.",
  },
  {
    slug: "journal-piece",
    title: "Writing piece page",
    blurb: "Draws every piece under /journal/<piece>: the piece, its series and more writing. Pieces appear once they are shown on this site from the writing room.",
  },
];

/**
 * The site's designed pages. The home page and any page an editor adds are
 * documents in the page editor (`/studio/<name>`); everything else on the site
 * stays where it was — content in Content, sections in Pages, the wording of
 * the footer in Site copy, people in People.
 */
export const dynamic = "force-dynamic";

export default async function BuilderPage() {
  // Gate in the page as well as the layout: Next renders the two in parallel, and
  // the layout's redirect did not stop this page's data from streaming to a
  // signed-out visitor (verified on the live sites, 2026-11-06).
  await requireOrgEditor();
  const pages = await listPages();
  const others = pages.filter((p) => p.slug !== HOME_SLUG && !TEMPLATE_SLUGS.has(p.slug));
  const stored = new Map(pages.map((p) => [p.slug, p.updatedAt]));

  return (
    <>
      <h2 className="font-serif text-2xl">Page builder</h2>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Lay out extra pages from blocks. The landing page is built in code (2026-11-02). The sections, people and gatherings
        those blocks show are still managed in the other tabs.
      </p>

      <div className="mt-6 space-y-4">
        <section className="card-natural p-6">
          <h3 className="font-serif text-xl">Other pages</h3>
          {others.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No other pages yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border/70 border-y border-border/70">
              {others.map((p) => (
                <li key={p.slug} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <Link href={`/${p.slug}`} className="font-medium hover:text-[hsl(var(--primary))]">
                      /{p.slug}
                    </Link>
                    <span className="ml-3 text-xs text-muted-foreground">
                      {new Date(p.updatedAt).toLocaleDateString("en-CA")}
                    </span>
                  </div>
                  <Link href={`/studio/${p.slug}`} className="text-sm underline underline-offset-4">
                    Edit
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <NewPageForm />
        </section>

        <section className="card-natural p-6">
          <h3 className="font-serif text-xl">Templates for generated pages</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            One document each. Until one is published, those pages keep their plain layout.
          </p>
          <ul className="mt-3 divide-y divide-border/70 border-y border-border/70">
            {TEMPLATES.map((t) => (
              <li key={t.slug} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0 max-w-xl">
                  <p className="font-medium">{t.title}</p>
                  <p className="text-sm text-muted-foreground">{t.blurb}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {stored.has(t.slug)
                      ? `Published ${new Date(stored.get(t.slug)!).toLocaleDateString("en-CA")}`
                      : "Not published — the plain layout is used"}
                  </p>
                </div>
                <Link href={`/studio/${t.slug}`} className="text-sm underline underline-offset-4">
                  {stored.has(t.slug) ? "Edit" : "Start from the example"}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="p-1 text-sm text-muted-foreground">
          <p>
            Stays outside the editor: the hub, the center, account and sign-in, the forum, each section&rsquo;s
            listing and its posts, and the teachers&rsquo; pages under /about.
          </p>
        </section>
      </div>
    </>
  );
}
