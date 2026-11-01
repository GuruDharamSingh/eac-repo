"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { SurfaceProvider, type SurfaceConnectors } from "@elkdonis/cms-ui/surface";
import { createHubConnectors } from "@elkdonis/cms-ui/hub";
import { checkSiteAction, createSiteAction, loadJourneyAction, publishStoreAction } from "@/lib/cms/journey-actions";
import { checkStoreAction, publishArtworksAction, saveArtworkDraftAction } from "@/lib/cms/artwork-actions";
import { listOwnServicesAction, saveOwnServiceAction, setOwnServiceStatusAction } from "@/lib/cms/own-service-actions";
import { listOrgPeopleAction, setOrgPersonListedAction, setOrgPersonRoleAction } from "@/lib/cms/org-people-actions";
import { disconnectPayoutsAction, loadProfilePageAction, setProfileSectionAction, startPayoutsAction } from "@/lib/cms/payout-actions";

const MARKET = (process.env.NEXT_PUBLIC_ART_AUCTION_URL ?? "http://localhost:3009").replace(/\/$/, "");
const NETWORK_HOST = process.env.NEXT_PUBLIC_NETWORK_HOST ?? "arts-collective.com";

/**
 * The surface stack under /learn: everything a course step may open in
 * place — the profile popup (details, where you show, payouts, connections),
 * the three journeys (sell your art, your listing, start an organisation),
 * the artwork queue, the org's people. The same panels /center draws on
 * ifac and innergathering, served here by this host's own actions.
 */
export function LearnHost({ displayName, signedIn, children }: { displayName: string | null; signedIn: boolean; children: React.ReactNode }) {
  const router = useRouter();
  const connectors = React.useMemo<SurfaceConnectors>(
    () =>
      createHubConnectors({
        viewer: { signedIn, canCompose: false, displayName },
        orgName: "Elkdonis Arts Collective",
        timeZone: "America/Toronto",
        profile: true,
        presence: true,
        listings: true,
        connections: { startUrl: "/api/connections/start" },
        profilePage: {
          load: loadProfilePageAction,
          setSection: setProfileSectionAction,
          startPayouts: startPayoutsAction,
          disconnectPayouts: disconnectPayoutsAction,
        },
        journey: {
          load: loadJourneyAction,
          publishStore: publishStoreAction,
          links: {
            addWork: `${MARKET}/studio/artworks/new`,
            store: (handle) => `${MARKET}/artists/${handle}`,
            auctionSite: MARKET,
            about: `${MARKET}/about`,
            orgSite: "/hub/organization",
            startOrg: "/learn/getting-started/start-an-organisation",
          },
          site: {
            check: checkSiteAction,
            create: createSiteAction,
            networkHost: NETWORK_HOST,
            manageHref: (slug) => `/hub/organization?org=${encodeURIComponent(slug)}`,
          },
        },
        artwork: { checkStore: checkStoreAction, saveDraft: saveArtworkDraftAction, publish: publishArtworksAction },
        services: { list: listOwnServicesAction, save: saveOwnServiceAction, setStatus: setOwnServiceStatusAction },
        orgPeople: { list: listOrgPeopleAction, setRole: setOrgPersonRoleAction, setListed: setOrgPersonListedAction, manageHref: "/hub/organization" },
        onMutated: () => router.refresh(),
      }),
    [displayName, signedIn, router]
  );
  return <SurfaceProvider connectors={connectors}>{children}</SurfaceProvider>;
}
