import Link from "next/link";
import { redirect } from "next/navigation";
import { isValidSlug } from "@elkdonis/page-builder";
import { requireOrgEditor } from "@/lib/auth";
import { listPages } from "@/lib/puck/store";

/**
 * The list of pages Dana has built by arranging blocks.
 *
 * Editing one opens the visual editor; publishing writes it to its public
 * address. A page that does not exist yet opens as an empty canvas, so the
 * "new page" box below is just a way of typing an address.
 */
export const dynamic = "force-dynamic";

export default async function StudioIndex({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string }>;
}) {
  await requireOrgEditor("/studio");

  // The form submits here rather than to /studio/<slug>, because a form cannot
  // post to a path it has to build. Hand it on.
  const { slug } = await searchParams;
  if (slug && isValidSlug(slug)) redirect(`/studio/${slug}`);

  const pages = await listPages();

  return (
    <div className="content-page">
      <h1 className="page-title">Pages</h1>
      <p>
        Pages built by arranging blocks — text, images, columns. Editing one
        opens the visual editor; publishing puts it at its public address.
      </p>

      {pages.length === 0 ? (
        <p style={{ fontStyle: "italic" }}>No pages yet. Make one below.</p>
      ) : (
        <ul className="hub-list">
          {pages.map((page) => (
            <li key={page.slug}>
              <Link href={`/studio/${page.slug}`}>{page.slug.replace(/-/g, " ")}</Link>{" "}
              <span style={{ fontSize: ".8rem" }}>
                — <Link href={page.slug === "home" ? "/" : `/${page.slug}`}>view</Link>, last published{" "}
                {new Date(page.updatedAt).toLocaleDateString()}
              </span>
            </li>
          ))}
        </ul>
      )}

      <hr />

      <form action="/studio" style={{ display: "flex", gap: ".5rem", flexWrap: "wrap" }}>
        <label htmlFor="slug" style={{ alignSelf: "center" }}>
          New page address
        </label>
        <input
          id="slug"
          name="slug"
          required
          placeholder="about-the-work"
          pattern="[a-z0-9][a-z0-9-]*"
          // Spelled out rather than left to the browser's default message,
          // which says only "match the requested format".
          title="Lower-case letters, numbers and hyphens."
          style={{ padding: ".4rem .6rem", border: "1px solid var(--ink)", background: "transparent", color: "var(--ink)" }}
        />
        <button
          type="submit"
          style={{ padding: ".4rem 1rem", border: "1px solid var(--ink)", background: "var(--cyan)", color: "var(--ink)", cursor: "pointer" }}
        >
          Open editor
        </button>
      </form>
    </div>
  );
}
