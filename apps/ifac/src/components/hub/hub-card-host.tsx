"use client";

// IFAC's client side of the shared hub cards: the HubCardHost (links, the
// write door, icons) and the card's view state (card → pop-up → detail).
// Everything that differs on another host lives in this file and hub-site.ts.

import * as React from "react";
import { useRouter } from "next/navigation";
import type { HubCardHost, HubCardView, HubNav } from "@elkdonis/hub/contract";
import { HubRoot, lucideHubIcons } from "@elkdonis/hub/ui";
import { membersCard, type MembersHost } from "@elkdonis/hub/members";
import type { MembersDetailData, MembersFaceData } from "@elkdonis/hub/members/model";
import { reviewCard, type ReviewQueueData } from "@elkdonis/hub/review";
import { runHubAction } from "@/app/hub/actions";

/** Pilot theme for review (Justin, 2026-11-08); the org palette comes after. */
const THEME = "industry";

function useHost(extra?: Partial<MembersHost>): MembersHost {
  const router = useRouter();
  return React.useMemo<MembersHost>(() => {
    const hubHref = (card: string, tab?: string, row?: string, query?: Record<string, string>) => {
      const q = new URLSearchParams();
      if (tab) q.set("tab", tab);
      if (row) q.set("row", row);
      for (const [k, v] of Object.entries(query ?? {})) q.set(k, v);
      const s = q.toString();
      return `/hub/${card}${s ? `?${s}` : ""}`;
    };
    const base: HubCardHost = {
      hubHref,
      liveHref: (path) => `/${path}`,
      studioHref: () => "/hub/compose",
      manageHref: (screen) => (screen === "analytics" ? "/manage/analytics" : null),
      loginHref: (next) => `/login?next=${encodeURIComponent(next)}`,
      act: (id, input) => runHubAction(id, input),
      navigate: (href) => router.push(href),
      refresh: () => router.refresh(),
      icons: lucideHubIcons,
    };
    return { ...base, analyticsHref: "/manage/analytics", ...extra };
  }, [router, extra]);
}

/** The collapsed card plus its pop-up, on the hub grid. */
export function MembersCardMount({ data }: { data: MembersFaceData }) {
  const host = useHost();
  const [view, setView] = React.useState<HubCardView>("card");
  const nav: HubNav = {
    view,
    tab: null,
    openPopup: () => setView("popup"),
    close: () => setView("card"),
    openDetail: (tab, row, query) => host.navigate?.(host.hubHref("members", tab, row, query)),
  };
  const { Face, Popup } = membersCard;
  return (
    <HubRoot theme={THEME} icons={host.icons}>
      <Face data={data} host={host} nav={nav} />
      {view === "popup" ? <Popup data={data} host={host} nav={nav} /> : null}
    </HubRoot>
  );
}

/** /hub/members: the detail page. */
export function MembersDetailMount({
  data,
  tab,
  storagePanel,
}: {
  data: MembersDetailData;
  tab: string | null;
  storagePanel: React.ReactNode;
}) {
  const extra = React.useMemo<Partial<MembersHost>>(() => ({ storagePanel }), [storagePanel]);
  const host = useHost(extra);
  const nav: HubNav = {
    view: "detail",
    tab,
    openPopup: () => undefined,
    close: () => host.navigate?.("/hub"),
    openDetail: (t, row, query) => host.navigate?.(host.hubHref("members", t, row, query)),
  };
  const { Detail } = membersCard;
  return (
    <HubRoot theme={THEME} icons={host.icons}>
      <Detail data={data} host={host} nav={nav} />
    </HubRoot>
  );
}

/** The review queue card on the hub grid (pilot; the Content card hosts it later). */
export function ReviewCardMount({ data }: { data: ReviewQueueData }) {
  const host = useHost();
  const [view, setView] = React.useState<HubCardView>("card");
  const nav: HubNav = {
    view,
    tab: null,
    openPopup: () => setView("popup"),
    close: () => setView("card"),
    openDetail: (tab, row, query) => host.navigate?.(host.hubHref("review", tab, row, query)),
  };
  const { Face, Popup } = reviewCard;
  return (
    <HubRoot theme={THEME} icons={host.icons}>
      <Face data={data} host={host} nav={nav} />
      {view === "popup" ? <Popup data={data} host={host} nav={nav} /> : null}
    </HubRoot>
  );
}

/** /hub/review and /manage/submissions: the queue as a page. */
export function ReviewDetailMount({ data, backHref = "/hub" }: { data: ReviewQueueData; backHref?: string }) {
  const host = useHost();
  const nav: HubNav = {
    view: "detail",
    tab: null,
    openPopup: () => undefined,
    close: () => host.navigate?.(backHref),
    openDetail: () => undefined,
  };
  const { Detail } = reviewCard;
  return (
    <HubRoot theme={THEME} icons={host.icons}>
      <Detail data={data} host={host} nav={nav} />
    </HubRoot>
  );
}
