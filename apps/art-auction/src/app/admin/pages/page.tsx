import Link from "next/link";
import type { Metadata } from "next";
import { listPages } from "@/lib/puck/store";
import { TEMPLATE_SLUGS } from "@/lib/puck/reserved";
import { requirePagesEditor } from "@/lib/puck/auth";
import { NewPageForm } from "@/components/pages/new-page-form";
import { listStores } from "@elkdonis/commerce/queries";
import { loadHeroSettings } from "@/lib/home-hero";
import { loadLoftPointer } from "@/lib/landing-loft";
import { HeroForm } from "./hero-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pages" };

/**
 * The site's designed pages: the featured page, the silent auction page and
 * any other an editor adds, plus the template every article is drawn from. The
 * catalogue at `/` is not one of them; it stays code.
 */
export default async function AdminPagesPage() {
  await requirePagesEditor("/admin/pages");
  const [stores, hero, loft] = await Promise.all([
    listStores({ limit: 60 }).catch(() => []),
    loadHeroSettings(),
    loadLoftPointer().catch(() => ({ installationId: null, published: null })),
  ]);
  const heroArtists = stores.filter((st) => st.ownerKind === "user" && st.displayName).map((st) => ({ id: st.id, name: st.displayName! }));
  const pages = await listPages();
  const stored = new Map(pages.map((p) => [p.slug, p.updatedAt]));
  const others = pages.filter((p) => !TEMPLATE_SLUGS.has(p.slug));

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-border p-6">
        <h2 className="font-serif text-2xl">Home page hero</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          The band at the top of the home page rotates between the current auction series and featured artists. Choose
          which artists appear and in what order; each shows with their newest pictured work.
        </p>
        <div className="mt-4">
          <HeroForm artists={heroArtists} initial={hero.featuredStoreIds} />
        </div>
      </section>

      <section className="rounded-lg border border-border p-6">
        <h2 className="font-serif text-2xl">Home page loft</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          The virtual scene under the hero: works from anywhere on the market, their size, framing and lamps, the room&apos;s
          light, the view visitors open on, and a free spot visitors fill. Edited in the scene editor; changes reach the home
          page when you put them on it. The welcome letter above the hero is edited on the home page itself.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          {loft.published
            ? `On the page since ${new Date(loft.published.at).toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" })}.`
            : "Visitors see the starting hang: the two newest pictured works and the free spot."}
        </p>
        <Link href="/admin/loft" className="mt-3 inline-block text-sm underline underline-offset-4">
          Edit the loft scene
        </Link>
      </section>

      <section className="rounded-lg border border-border p-6">
        <h2 className="font-serif text-2xl">Designed pages</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Pages built from blocks: live lots, a closing timeline, bid tickers, articles and cards you can restyle. They sit
          beside the catalogue, which stays at <code>/</code>.
        </p>
        {others.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No pages yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-border border-y border-border">
            {others.map((p) => (
              <li key={p.slug} className="flex items-center justify-between gap-3 py-2.5">
                <span className="min-w-0">
                  <Link href={`/${p.slug}`} className="font-medium hover:text-primary">
                    /{p.slug}
                  </Link>
                  <span className="ml-3 text-xs text-muted-foreground">{new Date(p.updatedAt).toLocaleDateString("en-CA")}</span>
                </span>
                <Link href={`/edit/${p.slug}`} className="text-sm underline underline-offset-4">
                  Edit
                </Link>
              </li>
            ))}
          </ul>
        )}
        <NewPageForm />
      </section>

      <section className="rounded-lg border border-border p-6">
        <h3 className="font-serif text-xl">Article page template</h3>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Draws every article under <code>/read/&lt;slug&gt;</code>: a public forum topic of this marketplace, read as an article, with
          its live discussion. Until it is published, articles use a plain layout.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          {stored.has("article-detail")
            ? `Published ${new Date(stored.get("article-detail")!).toLocaleDateString("en-CA")}.`
            : "Not published."}
        </p>
        <Link href="/edit/article-detail" className="mt-3 inline-block text-sm underline underline-offset-4">
          {stored.has("article-detail") ? "Edit the template" : "Start from the example"}
        </Link>
      </section>
    </div>
  );
}
