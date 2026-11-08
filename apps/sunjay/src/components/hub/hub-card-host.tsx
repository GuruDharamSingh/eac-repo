"use client";

// Para Theater's client side of the shared hub cards: the HubCardHost (links,
// the write door, icons) and the card's view state (card → pop-up → detail).

import * as React from "react";
import { useRouter } from "next/navigation";
import type { HubActionResult, HubCardHost, HubCardView, HubNav } from "@elkdonis/hub/contract";
import { HubRoot, lucideHubIcons } from "@elkdonis/hub/ui";
import { siteBuilderCard, type SiteBuilderHost } from "@elkdonis/hub/site-builder";
import type { SiteBuilderDetailData, SiteBuilderFaceData } from "@elkdonis/hub/site-builder/model";
import { runHubAction } from "@/app/hub/actions";

/** Pilot theme for review (Justin, 2026-11-08); the org palette comes after. */
const THEME = "industry";

function useHost(): SiteBuilderHost {
  const router = useRouter();
  return React.useMemo<SiteBuilderHost>(() => {
    const hubHref = (card: string, tab?: string, row?: string, query?: Record<string, string>) => {
      const q = new URLSearchParams();
      if (tab) q.set("tab", tab);
      if (row) q.set("row", row);
      for (const [k, v] of Object.entries(query ?? {})) q.set(k, v);
      const s = q.toString();
      return `/hub/${card}${s ? `?${s}` : ""}`;
    };
    const host: HubCardHost = {
      hubHref,
      liveHref: (path) => `/${path}`,
      // The home page is edited from `/` itself (the studio routes redirect there).
      puckEditHref: (path) => (path ? `/studio/${path}` : "/"),
      // Para Theater has no theme editor yet; the Theme tab states the theme only.
      themeEditorHref: () => null,
      studioHref: () => "/studio",
      manageHref: () => null,
      loginHref: (next) => `/login?next=${encodeURIComponent(next)}`,
      act: async <T,>(id: string, input: Record<string, unknown>) => (await runHubAction(id, input)) as HubActionResult<T>,
      navigate: (href) => router.push(href),
      refresh: () => router.refresh(),
      icons: lucideHubIcons,
    };
    return host;
  }, [router]);
}

/** The collapsed card plus its pop-up, on the hub. */
export function SiteBuilderCardMount({ data }: { data: SiteBuilderFaceData }) {
  const host = useHost();
  const [view, setView] = React.useState<HubCardView>("card");
  const nav: HubNav = {
    view,
    tab: null,
    openPopup: () => setView("popup"),
    close: () => setView("card"),
    openDetail: (tab, row, query) => host.navigate?.(host.hubHref("site", tab, row, query)),
  };
  const { Face, Popup } = siteBuilderCard;
  return (
    <HubRoot theme={THEME} icons={host.icons}>
      <Face data={data} host={host} nav={nav} />
      {view === "popup" ? <Popup data={data} host={host} nav={nav} /> : null}
    </HubRoot>
  );
}

/** /hub/site: the detail page. */
export function SiteBuilderDetailMount({ data, tab }: { data: SiteBuilderDetailData; tab: string | null; row?: string | null }) {
  const host = useHost();
  const nav: HubNav = {
    view: "detail",
    tab,
    openPopup: () => undefined,
    close: () => host.navigate?.("/hub"),
    openDetail: (t, row, query) => host.navigate?.(host.hubHref("site", t, row, query)),
  };
  const { Detail } = siteBuilderCard;
  return (
    <HubRoot theme={THEME} icons={host.icons}>
      <Detail data={data} host={host} nav={nav} />
    </HubRoot>
  );
}
