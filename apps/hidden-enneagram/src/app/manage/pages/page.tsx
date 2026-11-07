import Link from "next/link";
import type { Metadata } from "next";
import { EmptyState, PageHeader } from "@elkdonis/cms-ui/manage";
import { requireOrgEditor } from "@/lib/auth";
import { BUILT_IN_SLUGS, listPages } from "@/lib/puck/store";
import { SILEX_PAGES } from "@/lib/silex-pages";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pages" };

/** The page builder from the back office: what is built, what still comes from Silex. */
export default async function ManagePages() {
  await requireOrgEditor("/manage/pages");
  const pages = await listPages().catch(() => [] as Awaited<ReturnType<typeof listPages>>);
  const stored = new Map(pages.map((p) => [p.slug, p]));
  const builtIn = new Set(BUILT_IN_SLUGS.map((b) => b.slug));
  const others = pages.filter((p) => !builtIn.has(p.slug));
  const silexLeft = [...SILEX_PAGES].filter((s) => !stored.has(s));

  return (
    <>
      <PageHeader
        title="Pages"
        description="Pages are built in the page editor by arranging blocks. Publishing puts a page at its address."
        actions={
          <Link className="he-btn he-primary" href="/studio">
            Open the page editor
          </Link>
        }
      />
      <div className="he-m-cols">
        <section className="he-m-card">
          <h2>Built in the editor</h2>
          <ul className="he-m-plain">
            {BUILT_IN_SLUGS.map((b) => (
              <li key={b.slug}>
                <Link href={`/studio/${b.slug}`}>{b.label}</Link>{" "}
                <span className="he-m-fine">
                  <Link href={b.href}>{b.href}</Link> · {stored.has(b.slug) ? "published" : "the built-in design (not yet published)"}
                </span>
              </li>
            ))}
            {others.map((p) => (
              <li key={p.slug}>
                <Link href={`/studio/${p.slug}`}>{p.slug.replace(/-/g, " ")}</Link>{" "}
                <span className="he-m-fine">
                  <Link href={`/${p.slug}`}>/{p.slug}</Link> · published {new Date(p.updatedAt).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        </section>
        <section className="he-m-card">
          <h2>Still in Silex</h2>
          {silexLeft.length ? (
            <>
              <p>These pages are drawn from the Silex site. Each keeps working; publishing a studio page at the same address replaces it.</p>
              <ul className="he-m-plain he-m-inline">
                {silexLeft.map((s) => (
                  <li key={s}>
                    <Link href={`/${s}`}>/{s}</Link>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <EmptyState title="All moved" body="Every Silex page has a studio page in its place." />
          )}
        </section>
      </div>
    </>
  );
}
