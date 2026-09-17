import Link from "next/link";
import { requireOrgEditor } from "@/lib/auth";
import { redirect } from "next/navigation";
import { isValidSlug } from "@elkdonis/page-builder";
import { listPages } from "@/lib/puck/store";

/**
 * The list of visually-edited pages.
 *
 * Exists because the editor had no way in: the routes are /studio/<slug> and
 * /p/<slug>, and nothing anywhere linked to either, so using it meant knowing
 * to type a URL. A page builder nobody can find is a page builder nobody uses.
 */
export const dynamic = "force-dynamic";

export default async function StudioIndex({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string }>;
}) {
  await requireOrgEditor("/studio");

  // The "new page" form submits here rather than to /studio/<slug>, because a
  // form cannot post to a path it has to build. Hand it on.
  const { slug } = await searchParams;
  if (slug && isValidSlug(slug)) redirect(`/studio/${slug}`);

  const pages = await listPages();

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "2.5rem 1.25rem" }}>
      <h1 style={{ fontSize: "1.6rem", margin: "0 0 .35rem" }}>Pages</h1>
      <p style={{ color: "var(--muted-foreground, #666)", margin: "0 0 2rem" }}>
        Pages built by arranging blocks. Editing one opens the visual editor;
        publishing writes it to its public address.
      </p>

      {pages.length === 0 ? (
        <p style={{ fontStyle: "italic" }}>No pages yet — make one below.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: "0 0 2rem", display: "grid", gap: ".5rem" }}>
          {pages.map((page) => (
            <li
              key={page.slug}
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: "1rem",
                flexWrap: "wrap",
                border: "1px solid var(--border, #ddd)",
                borderRadius: 8,
                padding: ".75rem 1rem",
              }}
            >
              <div>
                <Link href={`/studio/${page.slug}`} style={{ fontWeight: 600 }}>
                  {page.slug}
                </Link>
                <div style={{ fontSize: ".8rem", color: "var(--muted-foreground, #666)" }}>
                  Last published {new Date(page.updatedAt).toLocaleString()}
                </div>
              </div>
              <span style={{ display: "flex", gap: "1rem", fontSize: ".85rem" }}>
                <Link href={`/studio/${page.slug}`}>Edit</Link>
                <Link href={`/p/${page.slug}`}>View</Link>
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* A new page is just an address nobody has published yet, so creating
          one is navigating to it — no separate "create" step to get wrong. */}
      <form action="/studio" style={{ display: "flex", gap: ".5rem", flexWrap: "wrap" }}>
        <label htmlFor="new-slug" style={{ alignSelf: "center" }}>
          New page:
        </label>
        <input
          id="new-slug"
          name="slug"
          placeholder="about-us"
          pattern="[a-z0-9][a-z0-9-]*"
          title="Lower-case letters, numbers and dashes."
          required
          style={{ padding: ".4rem .6rem", border: "1px solid var(--border, #ddd)", borderRadius: 6 }}
        />
        <button type="submit" style={{ padding: ".4rem .9rem", borderRadius: 6 }}>
          Open editor
        </button>
      </form>
    </div>
  );
}
