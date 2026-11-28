"use client";

import "@elkdonis/hub/hub-cards.css";
import "@elkdonis/content/content.css";
import "@elkdonis/content/summary.css";
import "@elkdonis/channel/site.css";
import "@elkdonis/channel/hub.css";
import { useRouter } from "next/navigation";
import { HubCardMount, HubCardDetailMount } from "@elkdonis/hub/mount";
import { contentCard, type ContentFaceData } from "@elkdonis/content/hub";
import { channelCard } from "@elkdonis/channel/hub/card";
import type { ChannelHubData } from "@elkdonis/channel/hub";
import { runHubAction } from "@/app/hub/actions";
import { EditArtworkFrame } from "@/components/hub/edit-artwork-frame";
import { runChannelAction } from "@/lib/channel-door";

// A card's "Open page" link goes to <hubBase>/content?preset=<id>: here /admin/content?preset=<id>.
/** Pass `links={{ hubBase: "/hub" }}` from /hub so "Open page" lands on /hub/<card> (market lane, 2026-11-26). */
type HubLinks = { hubBase?: string; basePath?: string; studioPath?: string; loginPath?: string };
const LINKS: HubLinks = { hubBase: "/admin" };

/** In-stack Edit: an artwork opens its form as a frame in the same popup stack (no redirect). */
const EDIT_HOST = {
  renderEdit: ({ key, onDone, onCancel }: { key: string; onDone(): void; onCancel(): void }) =>
    key.startsWith("artwork:") ? <EditArtworkFrame artworkId={key.slice(8)} onDone={onDone} onCancel={onCancel} /> : null,
};

function useNav() {
  const r = useRouter();
  return { navigate: r.push, refresh: r.refresh };
}

export function ContentCardMount({ data, links = LINKS }: { data: ContentFaceData; links?: HubLinks }) {
  return <HubCardMount card={contentCard} data={data} act={runHubAction} links={links} host={EDIT_HOST} {...useNav()} />;
}

export function ContentDetail({ data, tab, links = LINKS, closeHref = "/admin/content" }: { data: ContentFaceData; tab: string | null; links?: HubLinks; closeHref?: string }) {
  return <HubCardDetailMount card={contentCard} data={data} tab={tab} act={runHubAction} links={links} closeHref={closeHref} {...useNav()} />;
}

/** The market's Channel card (Step 4, 2026-11-26). Writes go through the market's own Channel door (lib/channel-door.ts). */
export function ChannelCardMount({ data, links = LINKS }: { data: ChannelHubData; links?: HubLinks }) {
  return <HubCardMount card={channelCard} data={data} act={runChannelAction as never} links={links} {...useNav()} />;
}

/** The Channel card at full size: /admin/channel (its "Open page"). */
export function ChannelDetail({ data, links = LINKS, closeHref = "/admin/content" }: { data: ChannelHubData; links?: HubLinks; closeHref?: string }) {
  return <HubCardDetailMount card={channelCard} data={data} tab={null} act={runChannelAction as never} links={links} closeHref={closeHref} {...useNav()} />;
}
