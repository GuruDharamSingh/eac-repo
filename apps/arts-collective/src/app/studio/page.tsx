import type { Metadata } from "next";
import { getProfile, listListableOrgs, listOrgHosts, listSocialPosts, listWriting } from "@elkdonis/services";
import { handoffUrl, isAdmin } from "@elkdonis/auth-server";
import { checkStudioBack, cleanStudioBackLabel } from "@elkdonis/utils/studio-back";
import { freesoundConfigured, listReelProjects } from "@elkdonis/services/reels";
import type { ReelEdit, ReelTemplateId } from "@elkdonis/reels";
import { StudioApp } from "@/components/studio/StudioApp";
// Imported here, not in globals.css: this app's CSS pipeline has dropped
// package @imports from there before (.claude/rules/apps/arts-collective.md).
import "@elkdonis/cms-ui/article.css";
import "@elkdonis/studio/studio.css";
import "@elkdonis/studio/create.css";
import "@elkdonis/content/summary.css";
import "@elkdonis/studio-forms/canvas.css";
import "@elkdonis/reels/editor.css";
import "@elkdonis/studio/capture.css";
import "@elkdonis/studio/image.css";
import "@elkdonis/studio/wordart.css";
// The publication forms (Meetings; Artwork and Offerings "(new)", on trial). Ledger since
// 2026-11-11 (developer's go-ahead, StudioApp passes ledgerFormTheme); Broadsheet stays loaded
// for anything that still asks for it.
import "@elkdonis/studio-forms/forms.css";
import "@elkdonis/studio-forms/broadsheet.css";
import "@elkdonis/studio-forms/ledger.css";

// The Studio's own faces (the mockup's) come from Google Fonts by
// stylesheet, not next/font: Turbopack's font step failed two builds out of
// four on the fetch (2026-09-27, "next/font/google queries have exactly one
// entry"), taking the site down with it. studio.css names the faces directly.
const STUDIO_FONTS =
  "https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400;1,6..72,500&family=IBM+Plex+Sans:wght@400;500;600&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400&display=swap";
import { parseContentKey } from "@elkdonis/content/model";
import { requireUser } from "@/lib/session";
import { goLiveRole } from "@/lib/go-live-access";
import { networkHostWithPort } from "@/lib/domain";
import { listShareTargets, sharePiece } from "@/lib/share-actions";
import { archiveSocialPostAction, createSocialPostAction, listSocialPostsAction, publishSocialPost, saveSocialPostAction } from "@/lib/post-actions";
import {
  listMeetingsAction,
  loadMeetingAction,
  meetingContextAction,
  removeMeetingAction,
  saveMeetingAction,
} from "@/lib/meeting-actions";
import { broadcastClaim, broadcastPeek, broadcastStream, broadcastStreamSettings } from "@/lib/broadcast-actions";
import {
  relayAddFeed,
  relayChat,
  relayFeedToScene,
  relayGoLive,
  relayRemoveDestination,
  relayRemoveFeed,
  relaySaveDestination,
  relaySetEnabled,
  relayStop,
  relayView,
} from "@/lib/relay-actions";
import { relayConfigured } from "@elkdonis/services/relay";
import { listRecordings } from "@elkdonis/services/recordings";
import {
  boothCopyRecordingAction,
  boothRecordingsAction,
  boothRemoveRecordingAction,
  deleteRecordingAction,
  listRecordingsAction,
  renameRecordingAction,
} from "@/lib/recording-actions";
import { obsConfigured } from "@elkdonis/services/obs";
import { loadStudioBoardAction } from "@/lib/studio-board-action";
import { loadStudioCreateAction } from "@/lib/studio-create-actions";
import { loadStudioSummaryAction } from "@/lib/studio-summary-action";
import {
  listStudioIdentities,
  listStudioPieces,
  listStudioSeries,
  loadStudioPiece,
  removeStudioPiece,
  saveStudioPiece,
  searchStudioThreads,
  setStudioListing,
  startStudioPiece,
} from "@/lib/studio-actions";
import {
  archiveVideoProject,
  createVideoProject,
  getVideoPublication,
  listVideoFinished,
  listVideoMusic,
  listVideoProjects,
  listVideoRenders,
  publishVideo,
  queueVideoRender,
  saveVideoProject,
  shareVideoMusic,
  unpublishVideo,
  transcribeVideo,
  getVideoTranscript,
  listVideoSounds,
  shareVideoSound,
  searchVideoFreesound,
  importVideoFreesound,
} from "@/lib/video-actions";

/**
 * The Studio: where a person manages everything they have made on the
 * network. Third layer of authoring after the org sites' writing desks and
 * the compose surface (docs/open/STUDIO_BRIEF_2026-09-27.md). Writing first;
 * the other kinds show as tabs until they are built.
 *
 * `?org=<org_id>` preselects the acting org (the Center links here with it);
 * `?id=<thread id>` opens a piece.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Studio — Elkdonis Arts Collective" };

const PERSONAL_ORG_ID = "oad";
const ARTDIRECT_URL = (process.env.NEXT_PUBLIC_ARTDIRECT_URL ?? "").replace(/\/$/, "");

type Props = { searchParams: Promise<{ org?: string; id?: string; kind?: string; focus?: string; preset?: string; from?: string; next?: string; back?: string; backLabel?: string }> };

/**
 * `?next=`: where Publish hands back to (2026-11-11). Only a path inside this app's Channel is
 * kept, so the parameter cannot send anyone to another site.
 */
function channelNext(raw: string | undefined): string | null {
  if (!raw || raw.length > 512) return null;
  if (!/^\/channel(?:[/?#]|$)/.test(raw) || raw.includes("//") || raw.includes("\\")) return null;
  return raw;
}

export default async function StudioPage({ searchParams }: Props) {
  const { org, id, kind, focus, preset, from, next, back, backLabel } = await searchParams;
  // Signed out: come back to this same Studio address (?kind=create, ?id=…), not bare /studio (2026-11-14).
  const self = new URLSearchParams();
  for (const [k, v] of Object.entries({ org, id, kind, focus, preset, from, next, back, backLabel })) if (typeof v === "string" && v) self.set(k, v);
  const selfQs = self.toString();
  const user = await requireUser(`/login?next=${encodeURIComponent(`/studio${selfQs ? `?${selfQs}` : ""}`)}`);
  // Make into (2026-11-15): `from=<thread|artwork>:<id>` as /studio/make validates it; the form kinds fill from it.
  const makeFrom = typeof from === "string" && from.length <= 80 && parseContentKey(from) ? from : null;
  const isVideo = kind === "video";
  const isPost = kind === "post";
  const isMeeting = kind === "meeting";
  const isArtworkForm = kind === "artwork-form";
  const isServiceForm = kind === "service-form";
  const isRecording = kind === "recording";

  const [profile, orgs, reels, admin, liveRole] = await Promise.all([
    getProfile(user.id),
    listListableOrgs(user.id),
    listReelProjects(user.id),
    isAdmin(user.id),
    // Go live: admins, and org owners since 2026-11-14 (card only; lib/go-live-access.ts).
    goLiveRole(user.id),
  ]);
  const initialOrgId = org && orgs.some((o) => o.orgId === org) ? org : PERSONAL_ORG_ID;
  const [pieces, socialPosts] = await Promise.all([
    listWriting(user.id, {
      orgId: initialOrgId === PERSONAL_ORG_ID ? undefined : initialOrgId,
      includeDrafts: true,
      limit: 200,
    }),
    // Tolerates a missing table (migration 219 not applied): the Studio still opens.
    listSocialPosts(user.id, initialOrgId).catch(() => []),
  ]);

  const slug = profile?.slug ?? null;

  // `?back=` (developer, 2026-11-12): a page on the acting org's own site. Accepted only when its host is
  // one of that org's verified domains or its network subdomain; localhost only outside production.
  // An invalid value is dropped without a message. The link goes through the session hand-off so the
  // site receives the sign-in.
  let initialBack: { href: string; label: string } | null = null;
  if (back) {
    const target = checkStudioBack(back, await listOrgHosts(initialOrgId, networkHostWithPort()), {
      allowLocalhost: process.env.NODE_ENV !== "production",
    });
    if (target) {
      initialBack = {
        href: handoffUrl(target),
        label: cleanStudioBackLabel(backLabel) ?? new URL(target).host,
      };
    }
  }

  return (
    <>
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link rel="stylesheet" href={STUDIO_FONTS} />
    <StudioApp
      makeFrom={makeFrom}
      shell={{
        viewer: {
          userId: user.id,
          displayName: profile?.displayName?.trim() || user.email.split("@")[0],
          slug,
        },
        orgs: orgs.map((o) => ({ orgId: o.orgId, name: o.name, slug: o.slug })),
        initialPieces: pieces,
        initialOrgId,
        initialPieceId: isVideo || isPost || isMeeting || isArtworkForm || isServiceForm || isRecording ? null : (id ?? null),
        initialKind: kind ?? null,
        // The Publish card's hand-off (packages/content studioNewHref): focus for this visit, and a preset.
        initialFocus: focus === "1",
        initialPreset: preset ?? (makeFrom ? `from:${makeFrom}` : null),
        initialNext: channelNext(next),
        initialBack,
        // The bar's Board sheet: this piece in the person's Channel (read-only, session-scoped).
        loadBoard: loadStudioBoardAction,
        actions: {
          listPieces: listStudioPieces,
          loadPiece: loadStudioPiece,
          startPiece: startStudioPiece,
          savePiece: saveStudioPiece,
          removePiece: removeStudioPiece,
          setListing: setStudioListing,
          listIdentities: listStudioIdentities,
          listSeries: listStudioSeries,
          searchThreads: searchStudioThreads,
          listShareTargets,
          sharePiece,
        },
        // /api/upload/image takes the acting org's slug, which the shell adds.
        // For "Just me" that is `oad`, and the route files the picture in the
        // person's own folder (users/<folder>/Media/Images), not in oad's
        // (2026-11-11). Any other org needs a role in it.
        upload: { endpoint: "/api/upload/image", fields: { context: "studio" }, imageEndpoint: "/api/studio/image" },
        links: {
          hubHref: "/hub",
          pieceBase: slug && ARTDIRECT_URL ? `${ARTDIRECT_URL}/${slug}/writing` : null,
          // The person's own Nextcloud pictures, and the acting org's library.
          library: { mine: "/api/my-files?path=Media/Images&kind=image", org: "/api/media/library?org=:org" },
          connectionsHref: "/hub/network?surface=me:connections",
          channelHomeHref: "/channel",
        },
      }}
      video={{
        initialProjects: reels.map((p) => ({
          id: p.id,
          orgId: p.orgId,
          title: p.title,
          template: p.template as ReelTemplateId,
          edit: { template: p.template as ReelTemplateId, ...(p.edit as Partial<ReelEdit>) },
          folder: p.folder,
          updatedAt: p.updatedAt,
        })),
        initialProjectId: isVideo ? (id ?? null) : null,
        actions: {
          listProjects: listVideoProjects,
          createProject: createVideoProject,
          saveProject: saveVideoProject,
          archiveProject: archiveVideoProject,
          listMusic: listVideoMusic,
          shareMusic: shareVideoMusic,
          queueRender: queueVideoRender,
          listRenders: listVideoRenders,
          listFinished: listVideoFinished,
          getPublication: getVideoPublication,
          publish: publishVideo,
          unpublish: unpublishVideo,
          transcribe: transcribeVideo,
          getTranscript: getVideoTranscript,
          listSounds: listVideoSounds,
          shareSound: shareVideoSound,
          // Only offered when the server has a Freesound key.
          ...(freesoundConfigured() ? { searchFreesound: searchVideoFreesound, importFreesound: importVideoFreesound } : {}),
        },
        uploadEndpoint: "/api/reels/upload",
        imageEndpoint: "/api/studio/image",
        mediaBase: "/api/media/",
        libraryEndpoint: "/api/my-files",
        captureEndpoint: "/api/capture",
        phoneHost: process.env.NEXT_PUBLIC_NETWORK_HOST || "arts-collective.com",
        links: {
          broadcastHref: admin ? "/studio/broadcast" : undefined,
          pageBase: slug && ARTDIRECT_URL ? `${ARTDIRECT_URL}/${slug}/writing` : null,
        },
        // "Go live" from the Video kind (admins and org owners; one shared OBS instance). Owners get the
        // card with their own saved destinations: no console link, no feeds in, no chat.
        broadcast: liveRole
          ? {
              peek: broadcastPeek,
              claim: broadcastClaim,
              stream: broadcastStream,
              streamSettings: broadcastStreamSettings,
              releaseEndpoint: "/api/broadcast/release",
              consoleHref: admin ? "/studio/broadcast" : undefined,
              // The stream relay (docker/relay): one stream out of OBS, copied to each ticked destination.
              relay: relayConfigured()
                ? {
                    view: relayView,
                    saveDestination: relaySaveDestination,
                    setEnabled: relaySetEnabled,
                    removeDestination: relayRemoveDestination,
                    goLive: relayGoLive,
                    stop: relayStop,
                    addFeed: admin ? relayAddFeed : undefined,
                    removeFeed: admin ? relayRemoveFeed : undefined,
                    feedToScene: admin ? relayFeedToScene : undefined,
                    chat: admin ? relayChat : undefined,
                    ingestUrl: process.env.RELAY_PUBLIC_INGEST_URL || "rtmp://relay:1935/in",
                    guestCameraPath: process.env.RELAY_GUEST_CAMERAS === "1" ? "/guest/camera" : undefined,
                  }
                : undefined,
            }
          : undefined,
      }}
      post={{
        initialPosts: socialPosts.map((p) => ({
          id: p.id, orgId: p.orgId, title: p.title, body: p.body, link: p.link, images: p.images,
          variants: p.variants, shares: p.shares, createdAt: p.createdAt, updatedAt: p.updatedAt,
        })),
        initialPostId: isPost ? (id ?? null) : null,
        actions: {
          listPosts: listSocialPostsAction,
          createPost: createSocialPostAction,
          savePost: saveSocialPostAction,
          archivePost: archiveSocialPostAction,
          listShareTargets,
          publishPost: publishSocialPost,
        },
        uploadEndpoint: "/api/upload/image",
        imageEndpoint: "/api/studio/image",
        links: { connectionsHref: "/hub/network?surface=me:connections" },
      }}
      meeting={{
        initialId: isMeeting ? (id ?? null) : null,
        actions: {
          context: meetingContextAction,
          listMeetings: listMeetingsAction,
          loadMeeting: loadMeetingAction,
          saveMeeting: saveMeetingAction,
          removeMeeting: removeMeetingAction,
        },
        uploadEndpoint: "/api/upload/image",
        libraryEndpoint: "/api/media/library?org=:org",
      }}
      artworkForm={{ initialId: isArtworkForm ? (id ?? null) : null }}
      serviceForm={{ initialId: isServiceForm ? (id ?? null) : null }}
      // A published piece opens as its summary first (canvas C, 2026-11-14); Edit opens the form.
      summary={{ load: loadStudioSummaryAction, makeBase: "/studio/make" }}
      create={{
        // Create (canvas A, 2026-11-14): loaded per acting org in the browser; Make into goes through /studio/make.
        load: loadStudioCreateAction,
        makeBase: "/studio/make",
        channelBase: "/channel",
        liveHref: admin ? "/studio/broadcast" : null,
        nextcloudHref: (process.env.NEXT_PUBLIC_NEXTCLOUD_URL ?? "").replace(/\/$/, "") || null,
      }}
      recording={{
        // Listed only when the kind is open: one PROPFIND per folder.
        initialItems: isRecording ? await listRecordings(user.id).catch(() => []) : [],
        actions: { list: listRecordingsAction, rename: renameRecordingAction, remove: deleteRecordingAction },
        uploadEndpoint: "/api/studio/recordings/upload",
        captureEndpoint: "/api/capture",
        phoneHost: process.env.NEXT_PUBLIC_NETWORK_HOST || "arts-collective.com",
        mediaBase: "/api/media/",
        reelHref: "/studio?kind=video",
        // The booth's own OBS recordings, for admins (as the booth itself).
        booth:
          admin && obsConfigured()
            ? { list: boothRecordingsAction, copy: boothCopyRecordingAction, remove: boothRemoveRecordingAction }
            : undefined,
      }}
    />
    </>
  );
}
