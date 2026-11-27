// ============================================================================
// The Content hub card's server half (CONTRACT.md §8, §10.7): load(site, viewer) -> ContentFaceData.
// Server only: it reads the database through searchContent. Import from `@elkdonis/content/hub/server`.
//
//   export const artworksServer = contentServer({ host, preset: { id: "artworks", title: "Artworks",
//     scope: { kind: "site" }, types: ["artwork"], groupBy: "store" } });
//   export const libraryServer = contentServer({ host, preset: { id: "library", title: "Content library" } });
//
// The gate (the card does not re-derive it): the site and org scopes need an owner or guide (or a network admin);
// mine and network are open to any signed-in viewer. The routes check rights again from the session
// (contentReadSql), so this gate is for the face, not the data.
// ============================================================================

import { defineHubCardServer, type HubCardServerDef, type HubViewer } from "@elkdonis/hub/contract";
import type { ContentHost } from "../host";
import type { ContentIdentity } from "../model";
import { searchContent } from "../server/search";
import {
  DEFAULT_CONTENT_PRESET,
  type ContentCardPreset,
  type ContentDetailData,
  type ContentFaceData,
  type ResolvedContentPreset,
} from "./model";

export interface ContentServerOptions {
  host: ContentHost;
  preset?: ContentCardPreset;
  /** Where this app mounted contentRoutes. Defaults /api/content/search and /api/content/folders. */
  endpoints?: { search?: string; folders?: string | null };
}

export function resolvePreset(p?: ContentCardPreset): ResolvedContentPreset {
  return {
    ...DEFAULT_CONTENT_PRESET,
    ...(p?.id ? { id: p.id } : {}),
    ...(p?.title ? { title: p.title } : {}),
    ...(p?.scope ? { scope: p.scope } : {}),
    ...(p?.types?.length ? { types: p.types } : {}),
    ...(p?.view ? { view: p.view } : {}),
    ...(p?.groupBy ? { groupBy: p.groupBy } : {}),
  };
}

const isEditor = (v: HubViewer) => v.isNetworkAdmin || v.role === "owner" || v.role === "guide";

/** May this viewer use this lens? */
export function contentGate(scope: ResolvedContentPreset["scope"], viewer: HubViewer): boolean {
  if (scope.kind === "site" || scope.kind === "org") return isEditor(viewer);
  return true; // mine, network, person: any signed-in viewer (the cards are only drawn for one)
}

const initialsOf = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";

export function contentServer(opts: ContentServerOptions): HubCardServerDef<ContentFaceData, ContentDetailData> {
  const preset = resolvePreset(opts.preset);
  const endpoints = { search: opts.endpoints?.search ?? "/api/content/search", folders: opts.endpoints?.folders === undefined ? "/api/content/folders" : opts.endpoints.folders };

  async function build(viewer: HubViewer): Promise<ContentFaceData> {
    const { host } = opts;
    const identity: ContentIdentity = {
      id: `user:${viewer.userId}`,
      kind: "user",
      name: viewer.name,
      shortName: "You",
      initials: initialsOf(viewer.name),
    };
    const base: ContentFaceData = {
      preset,
      allowed: contentGate(preset.scope, viewer),
      endpoints,
      sources: [],
      identities: [identity],
      timeZone: host.site.timeZone,
      siteName: host.site.name,
      total: 0,
      byType: {},
      latest: [],
      actions: host.actions,
    };
    if (!base.allowed) return base;

    const contentViewer = { userId: viewer.userId };
    const [result, sources] = await Promise.all([
      searchContent(contentViewer, { scope: preset.scope, types: preset.types, view: preset.view, limit: 4 }, host),
      endpoints.folders && host.fileSources ? host.fileSources(contentViewer).catch(() => []) : Promise.resolve([]),
    ]);
    const byType = result.facets.types;
    return {
      ...base,
      sources: sources.map((s) => ({ key: s.key, label: s.label })),
      total: Object.values(byType).reduce((n, c) => n + (c ?? 0), 0),
      byType,
      latest: result.items,
    };
  }

  return defineHubCardServer<ContentFaceData, ContentDetailData>({
    id: "content",
    load: (_site, viewer) => build(viewer),
    loadDetail: (_site, viewer) => build(viewer),
  });
}
