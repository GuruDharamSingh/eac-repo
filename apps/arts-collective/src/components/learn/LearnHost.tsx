"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { SurfaceProvider, SurfaceFrame, type SurfaceConnectors } from "@elkdonis/cms-ui/surface";
import { createHubConnectors } from "@elkdonis/cms-ui/hub";
import { checkSiteAction, createSiteAction, loadJourneyAction, publishStoreAction } from "@/lib/cms/journey-actions";
import { checkStoreAction, publishArtworksAction, saveArtworkDraftAction } from "@/lib/cms/artwork-actions";
import { listOwnServicesAction, saveOwnServiceAction, setOwnServiceStatusAction } from "@/lib/cms/own-service-actions";
import { canChangeOrgPeopleAction, listOrgPeopleAction, setOrgPersonListedAction, setOrgPersonRoleAction } from "@/lib/cms/org-people-actions";
import { disconnectPayoutsAction, loadProfilePageAction, setProfileSectionAction, startPayoutsAction } from "@/lib/cms/payout-actions";
import { orgComposeConnectors, orgComposeContext } from "@/components/hub/console/org-compose";

/** The learner's own organisation, as the layout resolved it (getOwnedOrgId), for org tasks. */
export interface LearnOrg {
  orgId: string;
  slug: string;
  name: string;
  homeUrl: string;
  feeds: Array<{ slug: string; name: string }>;
  /** Owner or guide: compose is wired only then. */
  canEdit: boolean;
}

/** Which org this stack composes for, so a task box can fall back to a link for any other. */
const LearnOrgCtx = React.createContext<{ orgId: string; canCompose: boolean } | null>(null);
export const useLearnOrg = () => React.useContext(LearnOrgCtx);

/** The surface key a `frame` presentation opens (TaskBox). */
export const LEARN_FRAME = "learn:frame";

const MARKET = (process.env.NEXT_PUBLIC_ART_AUCTION_URL ?? "http://localhost:3009").replace(/\/$/, "");
const NETWORK_HOST = process.env.NEXT_PUBLIC_NETWORK_HOST ?? "arts-collective.com";

/**
 * The surface stack under /learn: everything a course step may open in
 * place — the profile popup (details, where you show, payouts, connections),
 * the three journeys (sell your art, your listing, start an organisation),
 * the artwork queue, the org's people. The same panels /center draws on
 * ifac and innergathering, served here by this host's own actions.
 * Since 2026-11-06 (action layer phase 2) also: compose for the learner's own
 * org (the console's composer, org-compose.tsx) and a framed page of this
 * host (`learn:frame`, the Studio).
 */
export function LearnHost({ displayName, signedIn, org = null, children }: { displayName: string | null; signedIn: boolean; org?: LearnOrg | null; children: React.ReactNode }) {
  const router = useRouter();
  const canCompose = Boolean(signedIn && org?.canEdit);
  const composeParts = React.useMemo(
    () => (org && canCompose ? orgComposeConnectors({ orgSlug: org.slug, orgHomeUrl: org.homeUrl, compose: orgComposeContext({ orgSlug: org.slug, feeds: org.feeds, canEdit: true }) }) : null),
    [org, canCompose]
  );
  const connectors = React.useMemo<SurfaceConnectors>(
    () => {
      const customCompose = composeParts?.customCompose ?? {};
      const compose = composeParts
        ? { identities: composeParts.identities, compose: composeParts.compose, composeSlots: composeParts.composeSlots, saveThread: composeParts.saveThread, threadToAnswers: composeParts.threadToAnswers }
        : {};
      return createHubConnectors({
        viewer: { signedIn, canCompose, displayName },
        // With an org, threads load through the org's own routes (as in the
        // console): the piece just published opens there after Publish.
        ...(org && canCompose
          ? { routes: { thread: `/api/org/${encodeURIComponent(org.slug)}/threads`, calendar: `/api/org/${encodeURIComponent(org.slug)}/calendar`, upload: "/api/upload/image" } }
          : {}),
        ...compose,
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
        orgPeople: { list: listOrgPeopleAction, setRole: setOrgPersonRoleAction, setListed: setOrgPersonListedAction, canChange: canChangeOrgPeopleAction, manageHref: "/hub/organization" },
        custom: {
          ...customCompose,
          [LEARN_FRAME]: ({ descriptor }) => <FramedPage src={String(descriptor.props?.src ?? "")} title={descriptor.title ?? ""} />,
        },
        onMutated: () => router.refresh(),
      });
    },
    [displayName, signedIn, canCompose, composeParts, org, router]
  );
  const orgCtx = React.useMemo(() => (org ? { orgId: org.orgId, canCompose } : null), [org, canCompose]);
  return (
    <LearnOrgCtx.Provider value={orgCtx}>
      <SurfaceProvider connectors={connectors}>{children}</SurfaceProvider>
    </LearnOrgCtx.Provider>
  );
}

/**
 * A page of this host over the lesson (the Studio, for "Write your first
 * piece"). Same origin only: the path must start with one slash. When the
 * dialog closes the step re-reads whether the task is done.
 */
function FramedPage({ src, title }: { src: string; title: string }) {
  const router = useRouter();
  React.useEffect(() => () => router.refresh(), [router]);
  const safe = src.startsWith("/") && !src.startsWith("//") ? src : null;
  return (
    <SurfaceFrame kind="neutral" title={title} flush>
      {safe ? (
        <iframe src={safe} title={title} className="learn-frame" style={{ display: "block", width: "100%", height: "min(78vh, 860px)", border: 0 }} />
      ) : (
        <p className="so-meta">This page cannot be opened here.</p>
      )}
    </SurfaceFrame>
  );
}
