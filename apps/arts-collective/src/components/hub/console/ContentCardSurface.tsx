"use client";

import * as React from "react";
import { SurfaceFrame, useLayer, useSurface } from "@elkdonis/cms-ui/surface";
import type { SurfaceAction, SurfaceConnectors } from "@elkdonis/cms-ui/surface";
import { ContentLibrary } from "@elkdonis/content/ui";
import type { ContentListItem, ContentView } from "@elkdonis/content/model";
import type { ContentCardData } from "@/lib/content-card-types";
import { CONTENT_CARD_SURFACES } from "./content-card-keys";
// The library draws unstyled without its own stylesheet (the same miss that broke the Current Work picker, 2026-11-27).
import "@elkdonis/content/content.css";
import "./content-card.css";

const SEARCH = "/api/content-card/search";
const FOLDERS = "/api/content-card/folders";
const UPLOAD = "/api/content-card/upload";

const bytes = (n: number | null | undefined) =>
  !n ? null : n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;

/**
 * The Content card's surface: the content library for the SELECTED org, in the one library component
 * (ContentLibrary, remote mode, scope org): Published | Files | All, search, large tiles. A piece opens as a
 * layer on this stack (onOpen returns true, so the library's own lightbox is skipped). Rights are the routes':
 * the session decides what lists, what uploads and what edits; `data.role` only words the page.
 */
export function ContentCardSurface({ data }: { data: ContentCardData }) {
  const surface = useSurface();
  const [view, setView] = React.useState<ContentView>("published");
  const [dest, setDest] = React.useState(data.uploadTo[0]?.key ?? "mine");
  const source = React.useMemo(() => ({ endpoint: SEARCH }), []);
  const scope = React.useMemo(() => ({ kind: "org" as const, orgId: data.orgId }), [data.orgId]);

  const open = (item: ContentListItem): boolean => {
    // A thread opens in the console's own thread layer (RSVP, the pin, Edit for editors, all in the stack).
    if (item.key.startsWith("thread:")) {
      surface.push({
        type: "thread",
        id: item.key.slice("thread:".length),
        preview: { title: item.title, kind: item.type, coverImageUrl: item.cover },
      });
      return true;
    }
    surface.push({ type: "custom", key: CONTENT_CARD_SURFACES.piece, title: item.title, size: "wide", props: { item } });
    return true;
  };

  const showUploadTo = view !== "published" && data.uploadTo.length > 1;
  const upload = data.uploadTo.length ? { endpoint: UPLOAD, fields: { source: dest }, label: "Upload" } : undefined;
  const status =
    data.role === "viewer"
      ? "Following: you see what is published, and your own files."
      : data.canEdit
        ? undefined
        : "Members see what is published, the team folder and their own files.";

  return (
    <SurfaceFrame kind="gallery" kicker={data.orgName} title="Content" flush status={status}>
      <div className="eac-c kc-wrap">
        {showUploadTo ? (
          <div className="kc-dest" role="group" aria-label="Add files to">
            <span className="kc-dest-label">Add files to</span>
            {data.uploadTo.map((d) => (
              <button key={d.key} type="button" className="kc-dest-btn" aria-pressed={dest === d.key} onClick={() => setDest(d.key)}>
                {d.label}
              </button>
            ))}
          </div>
        ) : null}
        <ContentLibrary
          source={source}
          scope={scope}
          view="published"
          onViewChange={setView}
          timeZone={data.timeZone}
          tileSize="large"
          searchPlaceholder={`Search ${data.orgName}`}
          folders={{ endpoint: FOLDERS, sources: data.sources }}
          initialSource={data.sources[0]?.key}
          upload={upload}
          onOpen={open}
          emptyText="Nothing in this folder yet."
        />
      </div>
    </SurfaceFrame>
  );
}

/**
 * A piece that is not a thread (a file, an artwork, a workshop page, a person) as a layer: picture, facts, and the way on.
 * Editors (`item.can.edit`, from the server) get "Open in Studio"; a file the viewer may remove gets Delete.
 */
export function ContentCardPiece({ item, data }: { item: ContentListItem; data: ContentCardData }) {
  const surface = useSurface();
  const layer = useLayer();
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => layer.setMeta({ title: item.title }), [layer, item.title]);

  const file = item.file;
  const own = file?.source === "mine";
  const team = file?.source === `org:${data.orgId}`;
  const mayDelete = Boolean(file?.path) && (own || (team && data.canEdit));

  async function remove() {
    if (!file || busy) return;
    if (!window.confirm(`Delete ${item.title}? This cannot be undone.`)) return;
    setBusy(true);
    setError(null);
    try {
      const url = own
        ? `/api/my-files?path=${encodeURIComponent(file.path)}`
        : `/api/org/${encodeURIComponent(data.orgSlug)}/files?path=${encodeURIComponent(file.path)}`;
      const res = await fetch(url, { method: "DELETE" });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Could not delete that.");
      surface.pop();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  const actions: SurfaceAction[] = [];
  if (item.links.public) actions.push({ label: file ? "Open the file" : "Open on the site", href: item.links.public, external: true, primary: true });
  if (item.can?.edit && item.links.studio) actions.push({ label: "Open in Studio", href: item.links.studio, quiet: true });
  if (mayDelete) actions.push({ label: busy ? "Deleting…" : "Delete", onClick: remove, danger: true, quiet: true, disabled: busy });

  const facts: Array<[string, string | null]> = [
    ["Kind", item.type],
    ["Where", file ? (own ? "My files" : `${data.orgName} team folder`) : item.siteName || null],
    ["Folder", file?.folder || null],
    ["Size", bytes(file?.size)],
    ["Status", file ? null : item.status],
  ];

  return (
    <SurfaceFrame kind="gallery" kicker={data.orgName} title={item.title} actions={actions} status={error ?? undefined} statusTone={error ? "error" : "normal"}>
      <div className="eac-c kc-piece">
        <span className="kc-bigpic" data-blank={item.cover ? undefined : "1"}>
          {item.cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.cover} alt={item.title} onError={(e) => { e.currentTarget.style.display = "none"; }} />
          ) : null}
        </span>
        <dl className="kc-facts">
          {facts.filter((f) => f[1]).map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        {item.excerpt ? <p className="kc-lede">{item.excerpt}</p> : null}
      </div>
    </SurfaceFrame>
  );
}

/**
 * The card's surfaces as one object to spread into the host's `custom` connectors:
 *   custom: { ...contentCardSurfaces(content), ... }
 * Keys are CONTENT_CARD_SURFACES.main and .piece (content-card-keys.ts).
 */
export function contentCardSurfaces(data: ContentCardData | null): NonNullable<SurfaceConnectors["custom"]> {
  return {
    [CONTENT_CARD_SURFACES.main]: () => (data ? <ContentCardSurface data={data} /> : null),
    [CONTENT_CARD_SURFACES.piece]: ({ descriptor }) => {
      const item = (descriptor.props as { item?: ContentListItem } | undefined)?.item;
      return data && item ? <ContentCardPiece item={item} data={data} /> : null;
    },
  };
}
