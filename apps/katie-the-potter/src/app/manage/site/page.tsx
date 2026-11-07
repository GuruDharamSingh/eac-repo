import Link from "next/link";
import type { Metadata } from "next";
import { loadManageCtx } from "@/lib/manage";
import { listPages, HOME_SLUG, PIECE_TEMPLATE } from "@/lib/puck/store";
import { PageHeader } from "@elkdonis/cms-ui/manage";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Site" };

/** The public site's own controls: pages (the Puck studio), and a way to look at it. */
export default async function ManageSite() {
  await loadManageCtx("/manage/site");
  const pages = await listPages().catch(() => []);
  const published = new Set(pages.map((p) => p.slug));

  return (
    <>
    <PageHeader title="Site" description="The public site: its pages and how it looks." actions={<Link className="ktp-btn" href="/studio">Open the page editor</Link>} />
    <div className="ktp-m-cols">
      <section className="ktp-m-card">
        <h2>Pages</h2>
        <p>Build and edit pages by arranging blocks: the landing, an About page, anything else.</p>
        <ul className="ktp-m-plain">
          <li>
            <Link href={`/studio/${HOME_SLUG}`}>Home</Link> <span className="ktp-m-fine">{published.has(HOME_SLUG) ? "published" : "the built-in design (not yet published)"}</span>
          </li>
          {pages
            .filter((p) => p.slug !== HOME_SLUG && p.slug !== PIECE_TEMPLATE)
            .map((p) => (
              <li key={p.slug}>
                <Link href={`/studio/${p.slug}`}>{p.slug.replace(/-/g, " ")}</Link>{" "}
                <span className="ktp-m-fine">
                  <Link href={`/${p.slug}`}>view</Link>
                </span>
              </li>
            ))}
        </ul>
        <p className="ktp-m-actions">
          <Link className="ktp-btn" href="/studio">
            All pages
          </Link>
        </p>
      </section>

      <section className="ktp-m-card">
        <h2>Site style</h2>
        <p>
          Colours, fonts and corners for the whole site: the header and footer, every block and every piece card follow it. Press{" "}
          <b>Site style</b> at the bottom left of any page of the public site (it shows for editors, not here in Manage), change a value, and see the page change before you save.
        </p>
        <p className="ktp-m-actions">
          <Link className="ktp-btn" href="/">
            Open the site to style it
          </Link>
        </p>
      </section>

      <section className="ktp-m-card">
        <h2>A piece's page</h2>
        <p>
          Every piece has its own page (/pieces/&hellip;), drawn from one template. Rearrange it in the page editor; each page then shows its own piece.
          {published.has(PIECE_TEMPLATE) ? " (Published.)" : " (Using the built-in layout.)"}
        </p>
        <p className="ktp-m-actions">
          <Link className="ktp-btn ktp-btn--ghost" href={`/studio/${PIECE_TEMPLATE}`}>
            Edit the piece template
          </Link>
        </p>
      </section>

      <section className="ktp-m-card">
        <h2>The public site</h2>
        <ul className="ktp-m-plain">
          <li>
            <Link href="/">The site</Link>
          </li>
          <li>
            <Link href="/preview">Preview with sample pieces</Link> <span className="ktp-m-fine">(not indexed)</span>
          </li>
          <li>
            <Link href="/cart">The cart</Link>
          </li>
        </ul>
        <p className="ktp-m-fine">Each block also has its own look in the page editor: select it, then pick a part (a title, a price) in the Look panel, or use &ldquo;Edit look&rdquo;.</p>
      </section>
    </div>
    </>
  );
}
