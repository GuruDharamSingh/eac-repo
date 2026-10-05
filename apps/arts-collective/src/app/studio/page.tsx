import type { Metadata } from "next";
import { getProfile, listListableOrgs, listWriting } from "@elkdonis/services";
import { isAdmin } from "@elkdonis/auth-server";
import { listReelProjects } from "@elkdonis/services/reels";
import type { ReelEdit, ReelTemplateId } from "@elkdonis/reels";
import { StudioApp } from "@/components/studio/StudioApp";
// Imported here, not in globals.css: this app's CSS pipeline has dropped
// package @imports from there before (.claude/rules/apps/arts-collective.md).
import "@elkdonis/cms-ui/article.css";
import "@elkdonis/studio/studio.css";
import "@elkdonis/reels/editor.css";

// The Studio's own faces (the mockup's) come from Google Fonts by
// stylesheet, not next/font: Turbopack's font step failed two builds out of
// four on the fetch (2026-09-27, "next/font/google queries have exactly one
// entry"), taking the site down with it. studio.css names the faces directly.
const STUDIO_FONTS =
  "https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400;1,6..72,500&family=IBM+Plex+Sans:wght@400;500;600&display=swap";
import { requireUser } from "@/lib/session";
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

type Props = { searchParams: Promise<{ org?: string; id?: string; kind?: string }> };

export default async function StudioPage({ searchParams }: Props) {
  const user = await requireUser("/login?next=/studio");
  const { org, id, kind } = await searchParams;
  const isVideo = kind === "video";

  const [profile, orgs, reels, admin] = await Promise.all([
    getProfile(user.id),
    listListableOrgs(user.id),
    listReelProjects(user.id),
    isAdmin(user.id),
  ]);
  const initialOrgId = org && orgs.some((o) => o.orgId === org) ? org : PERSONAL_ORG_ID;
  const pieces = await listWriting(user.id, {
    orgId: initialOrgId === PERSONAL_ORG_ID ? undefined : initialOrgId,
    includeDrafts: true,
    limit: 200,
  });

  const slug = profile?.slug ?? null;

  return (
    <>
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link rel="stylesheet" href={STUDIO_FONTS} />
    <StudioApp
      shell={{
        viewer: {
          userId: user.id,
          displayName: profile?.displayName?.trim() || user.email.split("@")[0],
          slug,
        },
        orgs: orgs.map((o) => ({ orgId: o.orgId, name: o.name, slug: o.slug })),
        initialPieces: pieces,
        initialOrgId,
        initialPieceId: isVideo ? null : (id ?? null),
        initialKind: kind ?? null,
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
        },
        // /api/upload/image needs an orgSlug the viewer belongs to; the shell
        // adds the acting org's. For "Just me" that is `oad`, which every
        // artist of the collective is a member of.
        upload: { endpoint: "/api/upload/image", fields: { context: "studio" } },
        links: {
          hubHref: "/hub",
          pieceBase: slug && ARTDIRECT_URL ? `${ARTDIRECT_URL}/${slug}/writing` : null,
          // The person's own Nextcloud pictures, and the acting org's library.
          library: { mine: "/api/my-files?path=Media/Images&kind=image", org: "/api/media/library?org=:org" },
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
        },
        uploadEndpoint: "/api/reels/upload",
        mediaBase: "/api/media/",
        libraryEndpoint: "/api/my-files",
        links: {
          broadcastHref: admin ? "/studio/broadcast" : undefined,
          pageBase: slug && ARTDIRECT_URL ? `${ARTDIRECT_URL}/${slug}/writing` : null,
        },
      }}
    />
    </>
  );
}
