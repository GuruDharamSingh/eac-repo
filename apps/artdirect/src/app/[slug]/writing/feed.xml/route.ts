import { headers } from "next/headers";
import { getProfileBySlug, getWritingPost, listWriting } from "@elkdonis/services";
import { publicOriginFrom } from "@elkdonis/checkout/booking";

/**
 * RSS 2.0 feed of one person's published writing: `/<slug>/writing/feed.xml`.
 *
 * Read by feed readers and by services that import a feed (Substack's import,
 * Ghost, WordPress); the canonical copy stays on the piece's page here. Only
 * published pieces of a listed person, never drafts: the feed is anonymous.
 * Full bodies go in `content:encoded` so an importer gets the piece, not a
 * teaser; the lede is the `description`.
 */
export const dynamic = "force-dynamic";

const LIMIT = 30;

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function cdata(s: string): string {
  return `<![CDATA[${s.replace(/\]\]>/g, "]]]]><![CDATA[>")}]]>`;
}

function rfc822(iso: string | null): string {
  const d = iso ? new Date(iso) : new Date();
  return (Number.isNaN(d.getTime()) ? new Date() : d).toUTCString();
}

function absolute(origin: string, url: string | null): string | null {
  if (!url) return null;
  if (/^https?:\/\//.test(url)) return url;
  return `${origin}${url.startsWith("/") ? "" : "/"}${url}`;
}

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const profile = await getProfileBySlug(slug);
  if (!profile || !profile.directoryListed) return new Response("Not found", { status: 404 });

  const origin = publicOriginFrom(await headers(), process.env.NEXT_PUBLIC_APP_URL);
  const key = profile.slug ?? profile.userId;
  const shelfUrl = `${origin}/${key}/writing`;
  const feedUrl = `${shelfUrl}/feed.xml`;

  const summaries = await listWriting(profile.userId, { limit: LIMIT });
  const posts = await Promise.all(summaries.map((s) => getWritingPost(profile.userId, s.slug)));

  const items = summaries
    .map((s, i) => {
      const post = posts[i];
      const link = `${shelfUrl}/${s.slug}`;
      const cover = absolute(origin, s.coverImageUrl);
      // Relative media links inside the body would point nowhere in a reader.
      const body = (post?.bodyHtml ?? "")
        .replace(/\s(?:srcset|sizes)="[^"]*"/g, "")
        .replace(/(src|href)="\/(?!\/)/g, `$1="${origin}/`);
      return [
        "<item>",
        `<title>${esc(s.title)}</title>`,
        `<link>${esc(link)}</link>`,
        `<guid isPermaLink="true">${esc(link)}</guid>`,
        `<pubDate>${rfc822(s.publishedAt ?? s.updatedAt)}</pubDate>`,
        `<dc:creator>${esc(profile.displayName)}</dc:creator>`,
        s.series ? `<category>${esc(s.series)}</category>` : "",
        s.lede ? `<description>${esc(s.lede)}</description>` : "",
        cover ? `<enclosure url="${esc(cover)}" type="image/jpeg" length="0" />` : "",
        body ? `<content:encoded>${cdata(body)}</content:encoded>` : "",
        "</item>",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");

  const xml = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:atom="http://www.w3.org/2005/Atom">`,
    "<channel>",
    `<title>${esc(profile.displayName)} — Writing</title>`,
    `<link>${esc(shelfUrl)}</link>`,
    `<atom:link href="${esc(feedUrl)}" rel="self" type="application/rss+xml" />`,
    `<description>${esc(`Writing by ${profile.displayName} on ArtDirect, the Elkdonis Arts Collective directory.`)}</description>`,
    `<language>en</language>`,
    `<lastBuildDate>${rfc822(summaries[0]?.publishedAt ?? summaries[0]?.updatedAt ?? null)}</lastBuildDate>`,
    items,
    "</channel>",
    "</rss>",
  ].join("\n");

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
