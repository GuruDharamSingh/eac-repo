"use client";

// ============================================================================
// The Content hub card (CONTRACT.md §8, §10.7): one card, mounted once per preset.
//   Face   counts and the newest few.
//   Popup  ContentLibrary in remote mode (compact), one layer, no stack.
//   Detail the full library page over the same remote source.
// Gate: the server half (./server) decides `allowed` (site scope needs an owner or guide; mine is open to any
// signed-in viewer). The card never re-derives it. Writes are the host's `act`; the allow-list is host.actions
// (carried as `data.actions`), so the card's own `actions` is empty.
// ============================================================================

import * as React from "react";
import type { HubCardHost, HubCardProps } from "@elkdonis/hub/contract";
import { defineHubCard } from "@elkdonis/hub/contract";
import { Frame, Icon, Popup as PopupShell, Thumb } from "@elkdonis/hub/ui";
import { ContentLibrary } from "../ui/ContentLibrary";
import type { PieceLightboxAction } from "../ui/PieceLightbox";
import type { ContentListItem } from "../model";
import type { ContentQuery, ContentSearchResult } from "../search-types";
import { contentQueryParams } from "../query-string";
import { typeLabel } from "../registry";
import type { ContentDetailData, ContentFaceData } from "./model";
import { R2Popup } from "./popup";

/** The remote source: the preset's scope, types and view are fixed by the card; the library supplies the rest. */
function useRemoteSource(data: ContentFaceData) {
  const { preset, endpoints } = data;
  return React.useMemo(
    () => ({
      async search(q: ContentQuery): Promise<ContentSearchResult> {
        const params = contentQueryParams({
          ...q,
          scope: preset.scope,
          types: preset.types ?? q.types,
          view: preset.view === "published" ? q.view ?? preset.view : preset.view,
        });
        const res = await fetch(`${endpoints.search}?${params.toString()}`, { cache: "no-store", credentials: "same-origin" });
        if (!res.ok) throw new Error(`content search ${res.status}`);
        return (await res.json()) as ContentSearchResult;
      },
    }),
    [preset, endpoints.search],
  );
}

/**
 * The lightbox's secondary actions from the host's allow-list (data.actions) and the server's item.can / item.hidden
 * (CONTRACT 10.9). With an empty allow-list there are none, so a mount without actions is unchanged.
 */
function useItemActions(data: ContentFaceData, host: HubCardHost | undefined, done: () => void) {
  return React.useMemo(() => {
    if (!host || !data.actions.length) return undefined;
    const allowed = new Set(data.actions);
    return (item: ContentListItem): PieceLightboxAction[] => {
      if (!item.key.startsWith("artwork:")) return [];
      const artworkId = item.key.slice("artwork:".length);
      const run = (id: string) => async () => {
        const r = await host.act(id, { artworkId });
        if (r.ok) {
          done();
          host.refresh?.();
        } else if (typeof window !== "undefined") {
          window.alert(("error" in r && r.error) || "That could not be done.");
        }
      };
      const out: PieceLightboxAction[] = [];
      if (item.hidden === true) {
        if (allowed.has("artwork-show")) out.push({ label: "Show on the site", onClick: run("artwork-show") });
      } else if (item.can?.hide && allowed.has("artwork-hide")) {
        out.push({ label: "Hide from the site", onClick: run("artwork-hide") });
      }
      return out;
    };
  }, [data.actions, host, done]);
}

function Library({ data, density, host }: { data: ContentFaceData; density: "full" | "compact"; host?: HubCardHost }) {
  const source = useRemoteSource(data);
  // A write changes what the list shows: a new key makes the library fetch again (and closes the lightbox).
  const [round, setRound] = React.useState(0);
  const itemActions = useItemActions(data, host, React.useCallback(() => setRound((n) => n + 1), []));
  const { preset } = data;
  const folders = data.endpoints.folders && data.sources.length ? { endpoint: data.endpoints.folders, sources: data.sources } : undefined;
  return (
    <div className="eac-c">
      <ContentLibrary
        key={round}
        items={[]}
        identities={data.identities}
        timeZone={data.timeZone}
        source={source}
        view={preset.view}
        groupBy={preset.groupBy}
        folders={folders}
        density={density}
        includeHidden={preset.includeHidden}
        itemActions={itemActions}
        searchPlaceholder={`Search ${preset.title.toLowerCase()}`}
      />
    </div>
  );
}

function Denied({ title }: { title: string }) {
  return <p className="hc-muted" style={{ margin: 0, padding: "0 20px 16px" }}>{title} is for this site&rsquo;s owners and guides.</p>;
}

const TONES = ["#15171b", "#24302a", "#1f2433", "#3a2c24", "#2a2622", "#4b3f33", "#262a31", "#1d2026"];

/** Round 2 face (R2Hub): a large serif title, an Open pill, a grid of large thumbnails, one count line. No glyph, no kicker. */
function FaceR2({ data, nav }: HubCardProps<ContentFaceData>) {
  const { preset } = data;
  const open = () => nav.openPopup();
  const names = [...new Set(data.latest.map((it) => it.storefront?.name ?? it.ownerName).filter((n): n is string => Boolean(n)))];
  const from = names.length ? ` · from ${names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0]}` : "";
  return (
    <Frame className="hc-card eac-c-hubface eac-c-hubdark" aria-label={preset.title}>
      <div className="hf-head">
        <h2 className="hf-title">{preset.title}</h2>
        <button type="button" className="hf-open" aria-label={`Open ${preset.title}`} onClick={open}>Open</button>
      </div>
      {data.allowed ? (
        <>
          <ul className="hf-grid" aria-hidden="true">
            {Array.from({ length: 8 }, (_, i) => data.latest[i]).map((it, i) => (
              <li key={it?.key ?? i} style={it?.cover ? undefined : { background: it ? TONES[i % TONES.length] : "transparent", borderColor: it ? undefined : "transparent" }}>
                {it?.cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={it.cover} alt="" loading="lazy" />
                ) : null}
              </li>
            ))}
          </ul>
          <p className="hf-count">
            {data.total === 0 ? "Nothing here yet." : `${data.total} on ${preset.scopes?.site ?? data.siteName}${from}`}
          </p>
        </>
      ) : (
        <Denied title={preset.title} />
      )}
    </Frame>
  );
}

function Face(props: HubCardProps<ContentFaceData>) {
  if (props.data.preset.scopes) return <FaceR2 {...props} />;
  const { data, nav } = props;
  const { preset } = data;
  const open = () => nav.openPopup();
  const top = Object.entries(data.byType)
    .filter(([, n]) => (n ?? 0) > 0)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
    .slice(0, 3)
    .map(([t, n]) => `${n} ${typeLabel(t as never).toLowerCase()}`)
    .join(" · ");
  return (
    <Frame
      className="hc-card"
      role="button"
      tabIndex={0}
      aria-label={preset.title}
      onClick={open}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      }}
    >
      <div className="hc-card-head">
        <span className="hc-icon-accent"><Icon name="library" size={20} /></span>
        <span className="hc-card-title">{preset.title}</span>
        <span className="hc-go"><Icon name="external" size={18} /></span>
      </div>
      {data.allowed ? (
        <>
          <div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span className="hc-num" style={{ fontSize: 52 }}>{data.total}</span>
              <span className="hc-heading" style={{ fontSize: 19 }}>{data.total === 1 ? "piece" : "pieces"}</span>
            </div>
            {top ? <div style={{ fontSize: 15, color: "var(--hc-n-800)", marginTop: 4 }}>{top}</div> : null}
          </div>
          {data.latest.length ? (
            <div style={{ display: "grid", gap: 8 }}>
              <div className="hc-overline" style={{ fontSize: 12 }}>Latest</div>
              {data.latest.slice(0, 3).map((it) => (
                <div key={it.key} style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 0 }}>
                  <Thumb url={it.cover} title={it.title} width={48} height={36} />
                  <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 15 }}>{it.title}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="hc-muted" style={{ margin: 0, fontSize: 14 }}>Nothing here yet.</p>
          )}
        </>
      ) : (
        <Denied title={preset.title} />
      )}
    </Frame>
  );
}

function Popup(props: HubCardProps<ContentFaceData>) {
  // The round 2 popup (a dark stack: list, piece, edit) is opt-in: a preset with `scopes`. Every other preset is as it was.
  if (props.data.preset.scopes && props.data.allowed) return <R2Popup {...props} />;
  const { data, nav, host } = props;
  const { preset } = data;
  return (
    <PopupShell
      icon="library"
      title={preset.title}
      width={1040}
      top={72}
      onClose={() => nav.close()}
      onOpenPage={() => nav.openDetail(undefined, undefined, preset.id ? { preset: preset.id } : undefined)}
    >
      {data.allowed ? (
        <div style={{ padding: "0 16px 16px" }}>
          <Library data={data} density="compact" host={host} />
        </div>
      ) : (
        <Denied title={preset.title} />
      )}
    </PopupShell>
  );
}

function Detail({ data, host }: HubCardProps<ContentDetailData>) {
  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: 16 }}>
      <h1 className="hc-title" style={{ fontSize: 28, margin: "0 0 12px" }}>{data.preset.title}</h1>
      {data.allowed ? <Library data={data} density="full" host={host} /> : <Denied title={data.preset.title} />}
    </div>
  );
}

export const contentCard = defineHubCard<ContentFaceData, ContentDetailData>({
  id: "content",
  title: "Content library",
  icon: "library",
  capability: null,
  // Signed in. The site scope is narrowed to owners and guides by the server half (data.allowed).
  gate: "signed-in",
  // The allow-list comes from the host (data.actions), not the card.
  actions: [],
  retires: [],
  Face,
  Popup,
  Detail,
});
