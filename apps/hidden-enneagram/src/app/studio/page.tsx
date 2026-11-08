import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { isValidSlug } from "@elkdonis/page-builder/server";
import { listOrgFeeds } from "@elkdonis/services";
import { requireOrgEditor } from "@/lib/auth";
import { BUILT_IN_SLUGS, listPages, ROUTE_SLUGS } from "@/lib/puck/store";
import { siteConfig } from "@/config/site";
import { readingSlug } from "@/lib/reading-privacy";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pages", robots: { index: false, follow: false } };

/**
 * The pages built in the studio (katie's index). The two built-in pages are
 * always listed: until published they draw their code default, and opening
 * one starts from that design.
 */
export default async function StudioIndex({ searchParams }: { searchParams: Promise<{ slug?: string; reading?: string }> }) {
  await requireOrgEditor("/studio");

  // "Start a reading": a fresh, unguessable address, opened on the starter.
  if ((await searchParams).reading === "new") redirect(`/studio/${readingSlug()}?template=reading`);

  const [{ slug }, all, feeds] = await Promise.all([
    searchParams,
    listPages(),
    listOrgFeeds(siteConfig.orgId, { includePrivate: true }).catch(() => []),
  ]);
  const taken = new Set([...ROUTE_SLUGS, ...feeds.map((f) => f.slug)]);
  let refused: string | null = null;
  if (slug) {
    if (isValidSlug(slug) && !taken.has(slug)) redirect(`/studio/${slug}`);
    refused = taken.has(slug) ? `“${slug}” belongs to another part of the site.` : "Use lower-case letters, numbers and hyphens.";
  }

  const stored = new Map(all.map((p) => [p.slug, p]));
  const builtIn = new Set(BUILT_IN_SLUGS.map((b) => b.slug));
  const others = all.filter((p) => !builtIn.has(p.slug));

  return (
    <div className="he-page">
      <p className="he-eyebrow">Page builder</p>
      <h1>Pages</h1>
      <p>
        Pages built by arranging blocks. Opening one starts the studio; publishing puts it at its public address. Click
        into a block to change the look of its parts, or double-click it to open it alone.
      </p>

      <ul className="he-list">
        {BUILT_IN_SLUGS.map((b) => {
          const page = stored.get(b.slug);
          return (
            <li key={b.slug}>
              <Link href={`/studio/${b.slug}`}>{b.label}</Link>{" "}
              <span className="he-note">
                — <Link href={b.href}>{b.href}</Link>,{" "}
                {page ? `last published ${new Date(page.updatedAt).toLocaleDateString()}` : "not yet published (drawn from the built-in design)"}
              </span>
            </li>
          );
        })}
        {others.map((page) => (
          <li key={page.slug}>
            <Link href={`/studio/${page.slug}`}>{page.slug.replace(/-/g, " ")}</Link>{" "}
            <span className="he-note">
              — <Link href={`/${page.slug}`}>/{page.slug}</Link>
              {page.slug.startsWith("reading-") ? " (a reading: private link, not in search engines)" : ""}, last published{" "}
              {new Date(page.updatedAt).toLocaleDateString()}
            </span>
          </li>
        ))}
      </ul>

      <section className="he-studio-reading" style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: "1.2rem", margin: "0 0 .4rem" }}>A reading for one person</h2>
        <p className="he-note">
          Opens a copy of “A reading for …” at a new address nobody could guess (reading- and twelve random letters).
          Write the steps on the figure, publish, then send the address only to the person it is for. Pages with a
          reading are kept out of search engines and listed nowhere public; anyone with the link can read it.
        </p>
        <form action="/studio">
          <input type="hidden" name="reading" value="new" />
          <button type="submit" className="he-btn">
            Start a reading
          </button>
        </form>
      </section>

      <form action="/studio" style={{ display: "flex", gap: ".5rem", flexWrap: "wrap", alignItems: "center", marginTop: 24 }}>
        <label htmlFor="slug">New page address</label>
        <input id="slug" name="slug" required placeholder="about-the-work" pattern="[a-z0-9][a-z0-9-]*" title="Lower-case letters, numbers and hyphens." className="he-input" />
        <button type="submit" className="he-btn he-primary">
          Open the studio
        </button>
      </form>
      {refused ? (
        <p className="he-note" role="alert">
          {refused}
        </p>
      ) : null}
    </div>
  );
}
