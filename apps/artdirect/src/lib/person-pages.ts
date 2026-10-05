import type { Data } from "@puckeditor/core";
import {
  FEATURED_PAGE_BLOCKS,
  PROFILE_PAGE_BLOCKS,
  personPageResolvers,
  type PersonBlockContext,
} from "@elkdonis/blocks";
import { loadPersonBlockContext } from "@elkdonis/blocks/server";
import { buildPuckConfig } from "@elkdonis/page-builder";
import { PERSONAL_ORG_ID } from "@elkdonis/services";

// ============================================================================
// A person's two designed pages on ArtDirect (developer's decision,
// 2026-09-26): the profile page (their root page, /<slug>) and the featured
// page (/<slug>/featured). Puck documents in user_pages, org `oad`.
//
// Storage, one row per key (no schema change):
//   profile, featured             what is live (status `published`)
//   profiledraft, featureddraft   the editor's saved work (status `draft`)
// A draft has its own row because saveUserPage turns an edited published row
// back to `draft`, which here would take the live page down. Publishing
// writes both rows, so the editor reopens on what is live.
// ============================================================================

export type PersonPageKind = "profile" | "featured";

export const PERSON_PAGE_KINDS: readonly PersonPageKind[] = ["profile", "featured"];

export function isPersonPageKind(v: unknown): v is PersonPageKind {
  return v === "profile" || v === "featured";
}

/** The live document's key. */
export function liveKey(kind: PersonPageKind): string {
  return kind;
}

/** The saved-draft document's key (same CHECK shape as user_pages.key). */
export function draftKey(kind: PersonPageKind): string {
  return `${kind}draft`;
}

export const PERSON_PAGE_ORG = PERSONAL_ORG_ID;

const NETWORK_URL = process.env.NEXT_PUBLIC_ARTS_COLLECTIVE_URL ?? "http://localhost:3007";
// Gallery pages are served by IFAC today; same target as the plain page.
const IFAC_URL = process.env.NEXT_PUBLIC_IFAC_URL ?? "http://localhost:3008";
const MARKETPLACE_URL = process.env.NEXT_PUBLIC_ART_AUCTION_URL ?? "http://localhost:3009";

/** Everything the person blocks draw for `slug`, as `viewerId` may see it. */
export function loadPersonContext(slug: string, viewerId: string | null | undefined): Promise<PersonBlockContext | null> {
  return loadPersonBlockContext(slug, {
    viewerId: viewerId ?? null,
    networkUrl: NETWORK_URL,
    marketplaceUrl: MARKETPLACE_URL,
    from: "artdirect",
    writingBase: (key) => `/${key}/writing`,
    galleryHref: (key, gallery) => `${IFAC_URL}/artists/${key}/galleries/${gallery}`,
    // Personal services are booked on ArtDirect itself.
    serviceHref: (key, service) => `/${key}/services/${service}`,
  });
}

/** The published configs: no field controls, resolvers read `metadata.person`. */
export const profileServerConfig = buildPuckConfig({
  resolvers: personPageResolvers(),
  blocks: PROFILE_PAGE_BLOCKS,
});

export const featuredServerConfig = buildPuckConfig({
  resolvers: personPageResolvers(),
  blocks: FEATURED_PAGE_BLOCKS,
});

export function serverConfigFor(kind: PersonPageKind) {
  return kind === "profile" ? profileServerConfig : featuredServerConfig;
}

export function knownTypesFor(kind: PersonPageKind): Set<string> {
  return new Set(Object.keys(serverConfigFor(kind).components));
}

/** The document's own title (the editor's "Page title"), if one was typed. */
export function documentTitle(data: unknown): string {
  const root = (data as { root?: { props?: { title?: unknown } } } | null)?.root;
  const title = root?.props?.title;
  return typeof title === "string" ? title.trim() : "";
}

type Node = { type?: unknown; props?: Record<string, unknown>; readOnly?: Record<string, boolean> };

/**
 * Drop what resolvers filled in before a document is stored.
 *
 * Puck keeps each resolver's result in the node's props and marks those keys
 * in `readOnly` (page-builder config.tsx). They are re-read at every render,
 * so storing them only stores a stale copy of the person's data — in the
 * editor, the owner's view, drafts included.
 */
export function stripResolved(data: Data): Data {
  const clean = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(clean);
    if (!value || typeof value !== "object") return value;
    const node = value as Node;
    if (typeof node.type !== "string" || !node.props) return value;
    const props: Record<string, unknown> = {};
    const owned = node.readOnly ?? {};
    for (const [key, v] of Object.entries(node.props)) {
      if (owned[key]) continue;
      // Slots hold arrays of nodes.
      props[key] = Array.isArray(v) ? v.map(clean) : v;
    }
    const { readOnly: _owned, ...rest } = node;
    return { ...rest, props };
  };
  const zones = (data as { zones?: Record<string, unknown[]> }).zones;
  return {
    ...data,
    content: (data.content ?? []).map(clean) as Data["content"],
    ...(zones
      ? { zones: Object.fromEntries(Object.entries(zones).map(([k, v]) => [k, (v ?? []).map(clean)])) as Data["zones"] }
      : {}),
  };
}
