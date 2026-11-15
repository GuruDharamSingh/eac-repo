import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ChannelSitePage, type SiteChannelParams } from "@elkdonis/channel/site";
import { getViewer } from "@/lib/auth";
import { siteOrigin } from "@/lib/origin";
import { siteConfig } from "@/config/site";
import { ArtworkQuickForm } from "@/components/channel/ArtworkQuickForm";
import { loadSiteChannel } from "@/lib/channel-model";
import { runChannelAction } from "@/lib/channel-door";
import "@elkdonis/channel/site.css";
import "./channel.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Channel", robots: { index: false, follow: false } };

const NETWORK_HOST = process.env.NEXT_PUBLIC_NETWORK_HOST ?? "arts-collective.com";
const NETWORK_URL = `${NETWORK_HOST.includes("localhost") ? "http" : "https"}://${NETWORK_HOST}`;

/**
 * Channel on this site (developer, 2026-11-12; docs/open/CHANNEL_ON_SITES_2026-11-12.md): the
 * shared @elkdonis/channel/site page (Home, Queue, Board, Out, Library; design canvas "Studio
 * pipeline frame", D, D2, E), in this site's look, with the artwork quick form as "Edit here".
 * This route keeps the sign-in and the editor gate. `?to=outlets` hands off to the network
 * Outlets (Manage overview, "Sharing").
 */
export default async function ChannelRoute({ searchParams }: { searchParams: Promise<SiteChannelParams> }) {
  const sp = await searchParams;
  const viewer = await getViewer().catch(() => null);
  if (!viewer) redirect(sp.to === "outlets" ? "/login?next=%2Fchannel%3Fto%3Doutlets" : "/login?next=/channel");

  // Role comes from the session (getViewer -> user_organizations), never from params.
  if (!viewer.canEdit) {
    return (
      <div className="kch">
        <section className="kch-card">
          <h2>Channel</h2>
          <p>Channel is for the people who run this site.</p>
          <p>
            <Link className="kch-btn kch-btn--ghost" href="/">
              Back to the site
            </Link>
          </p>
        </section>
      </div>
    );
  }

  return (
    <ChannelSitePage
      org={{ id: siteConfig.orgId, name: siteConfig.orgName }}
      viewer={{ userId: viewer.userId, email: viewer.email }}
      origin={await siteOrigin()}
      networkUrl={NETWORK_URL}
      searchParams={sp}
      run={runChannelAction}
      loadModel={(o) => loadSiteChannel({ userId: viewer.userId, email: viewer.email }, o)}
      editHere={{
        kinds: ["artwork", "product"],
        libraryTypes: ["artwork"],
        newLabel: "Artwork, here",
        studioKind: "artwork-form",
        render: ({ id, closeHref, studioHref }) => <ArtworkQuickForm orgId={siteConfig.orgId} artworkId={id} studioHref={studioHref} closeHref={closeHref} />,
      }}
    />
  );
}
