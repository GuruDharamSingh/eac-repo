// Harness: the Channel hub card (face, pop-up, pop-up with a piece open) on a hand-written sample model, inside the REAL
// cms-ui surface provider (so the quick form's <dialog> nests in the surface's <dialog>, as on the hub).
// No server, no database: the Channel door is a stub, next/* are the parent harness's stubs.
// Build and shoot: scripts/channel-harness/hub-card/README.md.
import * as React from "react";
import { createRoot } from "react-dom/client";
import { SurfaceCard, SurfaceCardGrid, SurfaceFrame, SurfaceProvider } from "@elkdonis/cms-ui/surface";
import { ChannelHubFace, ChannelHubPanel } from "/repo/packages/channel/src/hub";
import { channelHubData } from "/repo/packages/channel/src/hub/server";
import { runChannelAction } from "./stubs/channel-door";
import { model } from "./sample";

const art = (c: string) => `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" fill="${c}"/><circle cx="60" cy="64" r="30" fill="rgba(255,255,255,.35)"/></svg>`)}`;
model.pieces[1].imageUrl = art("#6b7f8e");
model.pieces[2].imageUrl = art("#a98467");
model.pieces[4].imageUrl = art("#7a8f6a");

// The fixture is katie's; the card's byline is the piece's site name, so name it for this card.
for (const p of model.pieces) p.siteName = "Para Theater";
const data = channelHubData(
  model,
  {
    channel: "/channel",
    quickKinds: ["meeting"],
    studio: (o = {}) => `#studio?${new URLSearchParams(Object.entries(o).filter(([, v]) => v) as [string, string][])}`,
    makeInto: (k, to) => `#make?from=${k}&to=${to}`,
  },
  "Para Theater",
);
const page = (window as unknown as { __PAGE__: string }).__PAGE__;
const w = window as unknown as { __nest?: Record<string, unknown> };

function Panel() {
  return <ChannelHubPanel data={data} run={runChannelAction} channelHref="/channel" initialPiece={page === "panel-piece" ? "thread:lab" : null} initialMode={page === "panel-week" ? "week" : "board"} />;
}

/** After the surface is open: click what the page asks for, and record how the nested dialog behaved. */
function Driver() {
  React.useEffect(() => {
    const q = (s: string) => document.querySelector(s) as HTMLElement | null;
    const t0 = setTimeout(() => q(".eac-face--header .eac-face-hit")?.click(), 300);
    let t1: ReturnType<typeof setTimeout> | undefined;
    if (page === "panel-cell") {
      t1 = setTimeout(() => {
        q("dialog.eac-surface .chp-chart tbody tr:nth-child(2) td:nth-child(5) .kch-cell")?.click();
        setTimeout(() => {
          const d = document.querySelector("dialog.kch-dialog") as HTMLDialogElement | null;
          const inside = Boolean(d && d.contains(document.activeElement));
          const top = d ? document.elementsFromPoint(d.getBoundingClientRect().left + 20, d.getBoundingClientRect().top + 20)[0] : null;
          w.__nest = { cellDialogOpen: Boolean(d?.open), focusInside: inside, onTop: Boolean(top && d?.contains(top)), outerOpen: Boolean((document.querySelector("dialog.eac-surface") as HTMLDialogElement | null)?.open) };
        }, 400);
      }, 1200);
    }
    if (page === "panel-cell-closed") {
      t1 = setTimeout(() => {
        q("dialog.eac-surface .chp-chart tbody tr:nth-child(2) td:nth-child(5) .kch-cell")?.click();
        setTimeout(() => {
          q("dialog.kch-dialog .kch-icon-btn")?.click();
          setTimeout(() => {
            w.__nest = { cellDialogOpen: Boolean((document.querySelector("dialog.kch-dialog") as HTMLDialogElement | null)?.open), outerOpen: Boolean((document.querySelector("dialog.eac-surface") as HTMLDialogElement | null)?.open), focusInSurface: Boolean(document.querySelector("dialog.eac-surface")?.contains(document.activeElement)) };
          }, 400);
        }, 500);
      }, 1200);
    }
    return () => {
      clearTimeout(t0);
      if (t1) clearTimeout(t1);
    };
  }, []);
  return null;
}

function App() {
  const connectors = React.useMemo(
    () => ({
      custom: {
        channel: () => (
          <SurfaceFrame kind="board" title="Channel" kicker="Out, planned and waiting" flush>
            <Panel />
          </SurfaceFrame>
        ),
      },
    }),
    [],
  );
  const openIt = page.startsWith("panel");
  return (
    <SurfaceProvider connectors={connectors as never} syncUrl={false}>
      <main style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
        <h1 style={{ margin: "0 0 16px", fontSize: 28 }}>Hub</h1>
        <SurfaceCardGrid className="hub-band-grid">
          <SurfaceCard kind="neutral" title="Compose" blurb="Write something." glyph="+" />
          <SurfaceCard
            kind="board"
            glyph="▥"
            title="Channel"
            kicker="Out, planned and waiting"
            layout="header"
            preview={<ChannelHubFace data={data} />}
            surface={{ type: "custom", key: "channel", title: "Channel", kind: "board", size: "full" }}
          />
          <SurfaceCard kind="neutral" title="Documents" blurb="Living documents." glyph="▤" />
        </SurfaceCardGrid>
      </main>
      {openIt ? <Driver /> : null}
    </SurfaceProvider>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
