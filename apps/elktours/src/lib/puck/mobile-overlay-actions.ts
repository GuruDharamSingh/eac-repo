"use server";

import { getPlacePublic, listPlacePhotos } from "@/lib/places-public";
import { placeBusinessesFor } from "@/lib/places";
import { getFeedPost } from "@/lib/feed";
import { getViewer } from "@/lib/auth";
import { readMobilePlaces, readMobileFeed, whenLabel } from "./mobile-places";
import type { MobileFeedData, MobilePlaces, PlaceSheetData, PostSheetData } from "@/blocks/mobile/types";

// Reads for the phone overlays (place sheet, post sheet) and the editors' copies of the Places and Feed resolvers
// (G5/G6). All public data, read through Jay's modules; no writes here.

export async function placeSheetAction(slugOrId: string): Promise<PlaceSheetData | null> {
  if (typeof slugOrId !== "string" || !slugOrId || slugOrId.length > 200) return null;
  try {
    const p = await getPlacePublic(slugOrId);
    if (!p) return null;
    const businesses = await placeBusinessesFor([p.id]).catch(() => new Map());
    const website = p.links.find((l) => l.kind === "website")?.url ?? null;
    const mapsUrl = p.lat != null && p.lng != null
      ? `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([p.title, p.address].filter(Boolean).join(" "))}`;
    const plain = (p.excerpt ?? p.body ?? "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
    return {
      id: p.id,
      slug: p.slug,
      name: p.title,
      img: p.imageUrl,
      kind: p.tags[0] ?? "Place",
      blurb: plain ? (plain.length > 420 ? `${plain.slice(0, 420).replace(/\s+\S*$/, "")}…` : plain) : null,
      tags: p.tags,
      favouriteBy: p.featuredBy.map((f) => f.name).filter((n): n is string => !!n),
      address: p.address,
      // PublicPlace has no opening hours yet (ask for Jay): the row stays hidden until it does.
      hours: ((p as unknown as { hours?: string | null }).hours ?? null) || null,
      website,
      mapsUrl,
      // `stop` is the 1-based stop number once Jay adds it to PublicPlace.tours; until then the line has no number.
      tours: p.tours.map((t) => ({ slug: t.slug, title: t.title, stop: Number((t as unknown as { stop?: number }).stop) || null })),
      hasBusiness: (businesses.get(p.id) ?? []).length > 0,
    };
  } catch {
    return null;
  }
}

export async function postSheetAction(id: string): Promise<PostSheetData | null> {
  if (typeof id !== "string" || !/^[0-9a-f-]{8,64}$/i.test(id)) return null;
  try {
    const [res, viewer] = await Promise.all([getFeedPost(id), getViewer().catch(() => null)]);
    if (!res) return null;
    const { post, replies, canComment } = res;
    return {
      id: post.id,
      slug: post.slug,
      title: post.title,
      bodyHtml: post.body,
      author: post.author.name ?? "A guide",
      initial: (post.author.name ?? "G").slice(0, 1).toUpperCase(),
      whenLabel: whenLabel(post.publishedAt ?? post.createdAt),
      link: post.link ? { url: post.link.url, host: post.link.host, title: post.link.title, description: post.link.description, imageUrl: post.link.imageUrl } : null,
      forumHref: post.forumHref,
      replyCount: post.replyCount,
      replies: replies.map((r) => ({ id: r.id, author: r.author.name ?? "Someone", initial: (r.author.name ?? "?").slice(0, 1).toUpperCase(), whenLabel: whenLabel(r.createdAt), html: r.contentHtml })),
      canComment,
      signedIn: Boolean(viewer),
    };
  } catch {
    return null;
  }
}

/** The editors' copies of the m-places-catalogue and m-feed-list resolvers (public data, as the page gets it). */
export async function mobilePlacesAction(): Promise<MobilePlaces> {
  return readMobilePlaces();
}
export async function mobileFeedAction(): Promise<MobileFeedData> {
  return readMobileFeed();
}

/** Photos for the Discover lightbox (Jay's listPlacePhotos); the place's own picture goes first when not already listed. */
export async function placePhotosAction(placeId: string, img: string | null): Promise<{ url: string; caption: string | null }[]> {
  if (typeof placeId !== "string" || !/^[0-9a-f-]{36}$/i.test(placeId)) return img ? [{ url: img, caption: null }] : [];
  const list = await listPlacePhotos(placeId).catch(() => []);
  const out = list.map((x) => ({ url: x.url, caption: x.caption }));
  if (img && !out.some((x) => x.url === img)) out.unshift({ url: img, caption: null });
  return out;
}
