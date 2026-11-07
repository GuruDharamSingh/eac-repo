import Link from "next/link";
import { listPages } from "@/lib/puck/store";
import { TEMPLATE_SLUGS } from "@/lib/puck/reserved";
import { NewPageForm } from "@/components/manage/new-page-form";
import { requireOrgEditor } from "@/lib/auth";

/**
 * The site's designed pages (2026-11-06): any page an owner or guide adds is a document in the page editor
 * (`/studio/<name>`), served at `/<name>`. The landing page is edited on `/` ("Edit page"); tours and experiences
 * keep their layouts; everything else stays in the other tabs.
 */
export const dynamic = "force-dynamic";

export default async function BuilderPage() {
  // Gate in the page as well as the layout: Next renders the two in parallel.
  await requireOrgEditor();
  const pages = (await listPages()).filter((p) => !TEMPLATE_SLUGS.has(p.slug));

  return (
    <>
      <h2 className="font-serif text-2xl">Page builder</h2>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Lay out extra pages from blocks: headings, text, pictures, video, questions and answers, buttons, and a featured
        person from the site or one of its tours. The tours, places and people those pages show are still managed in the
        other tabs.
      </p>

      <div className="mt-6 space-y-4">
        <section className="card-natural p-6">
          <h3 className="font-serif text-xl">Pages</h3>
          {pages.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No pages yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border/70 border-y border-border/70">
              {pages.map((p) => (
                <li key={p.slug} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <Link href={`/${p.slug}`} className="font-medium hover:text-[hsl(var(--primary))]">/{p.slug}</Link>
                    <span className="ml-3 text-xs text-muted-foreground">{new Date(p.updatedAt).toLocaleDateString("en-CA")}</span>
                  </div>
                  <Link href={`/studio/${p.slug}`} className="text-sm underline underline-offset-4">Edit</Link>
                </li>
              ))}
            </ul>
          )}
          <NewPageForm />
        </section>

        <section className="card-natural p-6">
          <h3 className="font-serif text-xl">Edited elsewhere</h3>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link href="/" className="underline underline-offset-4">Landing page</Link> <span className="text-muted-foreground">— "Edit page" on the page itself.</span></li>
            <li><Link href="/studio/tour-detail" className="underline underline-offset-4">Tour page layout</Link> <span className="text-muted-foreground">— every tour's page.</span></li>
            <li><Link href="/studio/experience-detail" className="underline underline-offset-4">Experience page layout</Link> <span className="text-muted-foreground">— every experience's page.</span></li>
          </ul>
        </section>
      </div>
    </>
  );
}
