import Link from "next/link";
import { redirect } from "next/navigation";
import { isValidSlug } from "@elkdonis/page-builder/server";
import { requireOrgEditor } from "@/lib/auth";
import { HOME_SLUG, listPages, PIECE_TEMPLATE, TEMPLATE_SLUGS } from "@/lib/puck/store";

/**
 * The pages built in the studio. The home page is always listed, even before
 * it has been published: until then `/` draws the code default, and opening
 * it here starts from that design.
 */
export const dynamic = "force-dynamic";

export default async function StudioIndex({ searchParams }: { searchParams: Promise<{ slug?: string }> }) {
  await requireOrgEditor("/studio");

  const { slug } = await searchParams;
  if (slug && isValidSlug(slug)) redirect(`/studio/${slug}`);

  const all = await listPages();
  // Templates are edited here like pages but never served at /<slug>; they get their own list.
  const pages = all.filter((p) => !TEMPLATE_SLUGS.has(p.slug));
  const template = all.find((p) => p.slug === PIECE_TEMPLATE) ?? null;
  const hasHome = pages.some((p) => p.slug === HOME_SLUG);

  return (
    <div className="ktp-page">
      <h1>Pages</h1>
      <p>Pages built by arranging blocks. Editing one opens the studio; publishing puts it at its public address.</p>

      <ul className="ktp-list">
        {!hasHome ? (
          <li>
            <Link href={`/studio/${HOME_SLUG}`}>home</Link> <span style={{ fontSize: ".85rem" }}>— the landing, not yet published (drawn from the built-in design)</span>
          </li>
        ) : null}
        {pages.map((page) => (
          <li key={page.slug}>
            <Link href={`/studio/${page.slug}`}>{page.slug.replace(/-/g, " ")}</Link>{" "}
            <span style={{ fontSize: ".85rem" }}>
              — <Link href={page.slug === HOME_SLUG ? "/" : `/${page.slug}`}>view</Link>, last published{" "}
              {new Date(page.updatedAt).toLocaleDateString()}
            </span>
          </li>
        ))}
      </ul>

      <h2 style={{ marginTop: "28px" }}>Templates</h2>
      <p>A template draws many pages at once: every piece&rsquo;s own page uses the same arrangement, filled with that piece.</p>
      <ul className="ktp-list">
        <li>
          <Link href={`/studio/${PIECE_TEMPLATE}`}>a piece&rsquo;s page</Link>{" "}
          <span style={{ fontSize: ".85rem" }}>
            — /pieces/…,{" "}
            {template ? `last published ${new Date(template.updatedAt).toLocaleDateString()}` : "not yet published (drawn from the built-in design)"}
          </span>
        </li>
      </ul>

      <hr style={{ margin: "24px 0", border: 0, borderTop: "1px solid hsl(var(--border))" }} />

      <form action="/studio" style={{ display: "flex", gap: ".5rem", flexWrap: "wrap", alignItems: "center" }}>
        <label htmlFor="slug">New page address</label>
        <input
          id="slug"
          name="slug"
          required
          placeholder="about"
          pattern="[a-z0-9][a-z0-9-]*"
          title="Lower-case letters, numbers and hyphens."
          className="ktp-input"
        />
        <button type="submit" className="ktp-btn">
          Open the studio
        </button>
      </form>
    </div>
  );
}
