import { permanentRedirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * The catalogue moved to the site root — the front page used to be a hero
 * whose only job was to send people here.
 *
 * Kept as a permanent redirect rather than deleted: this path is in the
 * header, in other apps' links, in bookmarks and in whatever search engines
 * have indexed. The query string comes along so a filtered or searched URL
 * still lands on the same results.
 *
 * `/artworks/[id]` is a different route and is unaffected.
 */
export default async function ArtworksIndexRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (typeof value === "string") params.set(key, value);
    else if (Array.isArray(value)) for (const v of value) params.append(key, v);
  }
  const query = params.toString();
  permanentRedirect(query ? `/?${query}` : "/");
}
