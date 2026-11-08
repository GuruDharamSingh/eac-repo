"use client";

// The shell's client side of the shared hub cards on a tenant host: the
// HubCardHost (links, the write door, icons) and each card's view state.
// Modelled on apps/ifac/src/components/hub/hub-card-host.tsx; what differs is
// that links stay on the org's own host (/hub/<card>) and Studio / analytics
// hop to the canonical network host with the org (D-3).

import * as React from "react";
import { useRouter } from "next/navigation";
import type { HubCardHost, HubCardView, HubNav } from "@elkdonis/hub/contract";
import { HubRoot, lucideHubIcons } from "@elkdonis/hub/ui";
import { membersCard, type MembersHost } from "@elkdonis/hub/members";
import type { MembersDetailData, MembersFaceData } from "@elkdonis/hub/members/model";
import { reviewCard, type ReviewQueueData } from "@elkdonis/hub/review";
import { runTenantHubAction } from "@/app/sites/[slug]/hub/actions";

const THEME = "industry";

/** Plain data from the server page; the host's functions are built here. */
export interface TenantHubLinks {
  networkUrl: string;
  orgId: string;
  orgSlug: string;
}

function useHost(links: TenantHubLinks): MembersHost {
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
    const org = encodeURIComponent(links.orgSlug);
    const analyticsHref = `${links.networkUrl}/hub/analytics?org=${encodeURIComponent(links.orgId)}`;
    const base: HubCardHost = {
      hubHref,
      liveHref: (path) => `/${path}`,
      studioHref: () => `${links.networkUrl}/studio?org=${org}`,
      manageHref: (screen) => (screen === "analytics" ? analyticsHref : null),
      loginHref: (next) => `/login?next=${encodeURIComponent(next)}`,
      act: (id, input) => runTenantHubAction(id, input),
      navigate: (href) => router.push(href),
      refresh: () => router.refresh(),
      icons: lucideHubIcons,
    };
    return { ...base, analyticsHref };
  }, [router, links.networkUrl, links.orgId, links.orgSlug]);
}

function useCardNav(host: MembersHost, card: string): HubNav {
  const [view, setView] = React.useState<HubCardView>("card");
  return {
    view,
    tab: null,
    openPopup: () => setView("popup"),
    close: () => setView("card"),
    openDetail: (tab, row, query) => host.navigate?.(host.hubHref(card, tab, row, query)),
  };
}

export function TenantMembersCard({ data, links }: { data: MembersFaceData; links: TenantHubLinks }) {
  const host = useHost(links);
  const nav = useCardNav(host, "members");
  const { Face, Popup } = membersCard;
  return (
    <HubRoot theme={THEME} icons={host.icons}>
      <Face data={data} host={host} nav={nav} />
      {nav.view === "popup" ? <Popup data={data} host={host} nav={nav} /> : null}
    </HubRoot>
  );
}

export function TenantReviewCard({ data, links }: { data: ReviewQueueData; links: TenantHubLinks }) {
  const host = useHost(links);
  const nav = useCardNav(host, "review");
  const { Face, Popup } = reviewCard;
  return (
    <HubRoot theme={THEME} icons={host.icons}>
      <Face data={data} host={host} nav={nav} />
      {nav.view === "popup" ? <Popup data={data} host={host} nav={nav} /> : null}
    </HubRoot>
  );
}

export function TenantMembersDetail({
  data,
  tab,
  links,
}: {
  data: MembersDetailData;
  tab: string | null;
  links: TenantHubLinks;
}) {
  const host = useHost(links);
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

export function TenantReviewDetail({ data, links }: { data: ReviewQueueData; links: TenantHubLinks }) {
  const host = useHost(links);
  const nav: HubNav = {
    view: "detail",
    tab: null,
    openPopup: () => undefined,
    close: () => host.navigate?.("/hub"),
    openDetail: () => undefined,
  };
  const { Detail } = reviewCard;
  return (
    <HubRoot theme={THEME} icons={host.icons}>
      <Detail data={data} host={host} nav={nav} />
    </HubRoot>
  );
}
