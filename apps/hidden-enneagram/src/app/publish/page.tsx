import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getProfile } from "@elkdonis/services";
import { getViewer } from "@/lib/auth";
import { siteConfig } from "@/config/site";
import { listPublishPieces } from "@/lib/studio/writing-actions";
import { listPublishServices, loadPublishService } from "@/lib/studio/service-actions";
import { PublishApp } from "@/components/publish/publish-app";
// Route-scoped, as on arts-collective's /studio (its page imports these, not globals.css).
import "@elkdonis/cms-ui/article.css";
import "@elkdonis/studio/studio.css";
import "./publish.css";

// ============================================================================
// /publish: the network's authoring Studio on Ario's site (round 4).
//
// Not /studio: that is this site's PAGE editor (Puck), the convention katie,
// elktours and sunjay share, and it stays. /publish is what Ario does here and
// what the hub's door says. Opened in the popup it is framed
// (components/publish/studio-surface.tsx); opened directly it is the full screen.
//
// Editors of this org only (owner or guide, lib/auth.ts). Anyone else, signed
// in or not, goes to sign in and comes back here.
//
//   ?kind=writing|service   open on that kind (writing by default)
//   ?id=<thread id>         open that piece or service
//   ?feed=<feed slug>       the page a new piece goes on (writing by default)
// ============================================================================

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Publish", robots: { index: false, follow: false } };

const STUDIO_FONTS =
  "https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400;1,6..72,500&family=IBM+Plex+Sans:wght@400;500;600&display=swap";

const ID = /^[A-Za-z0-9_-]{6,64}$/;

type Props = { searchParams: Promise<{ kind?: string; id?: string; feed?: string }> };

export default async function PublishPage({ searchParams }: Props) {
  const { kind, id, feed } = await searchParams;
  const viewer = await getViewer().catch(() => null);
  if (!viewer?.canEdit) {
    const back = `/publish${kind || id ? `?${new URLSearchParams({ ...(kind ? { kind } : {}), ...(id ? { id } : {}) })}` : ""}`;
    redirect(`/login?next=${encodeURIComponent(back)}`);
  }

  const orgId = siteConfig.orgId;
  const isService = kind === "service";
  const safeId = id && ID.test(id) ? id : null;
  const [profile, pieces, services, initialService] = await Promise.all([
    getProfile(viewer.userId).catch(() => null),
    listPublishPieces(orgId),
    listPublishServices(),
    isService && safeId ? loadPublishService(safeId) : Promise.resolve(null),
  ]);

  return (
    <div className="he-publish">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link rel="stylesheet" href={STUDIO_FONTS} />
      <PublishApp
        orgId={orgId}
        orgName={siteConfig.orgName}
        feed={feed ?? null}
        services={services}
        initialService={initialService}
        shell={{
          viewer: {
            userId: viewer.userId,
            displayName: profile?.displayName?.trim() || viewer.email.split("@")[0],
            slug: profile?.slug ?? null,
          },
          orgs: [{ orgId, name: siteConfig.orgName, slug: orgId }],
          initialPieces: pieces,
          initialOrgId: orgId,
          initialPieceId: !isService && safeId ? safeId : null,
          initialKind: isService ? "service" : null,
          // The site's own upload (EAC_Network/hidden-enneagram/Media/Images) and library.
          upload: { endpoint: "/api/upload", imageEndpoint: "/api/studio/image" },
          links: {
            hubHref: "/hub",
            pieceBase: `/${feed && /^[a-z0-9-]+$/.test(feed) ? feed : "writing"}`,
            library: { org: "/api/media/library" },
          },
        }}
      />
    </div>
  );
}
