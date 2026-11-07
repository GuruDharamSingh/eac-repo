import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isAdmin } from "@elkdonis/auth-server";
import { obsStatus } from "@elkdonis/services/obs";
import { BroadcastDesk } from "@elkdonis/reels/broadcast";
import "@elkdonis/studio/studio.css";
import "@elkdonis/reels/editor.css";
import "@elkdonis/reels/broadcast.css";
import { requireUser } from "@/lib/session";
import { RelayFeedsSlot } from "@/components/studio/RelayFeedsSlot";
import {
  broadcastClaim,
  broadcastDeleteGraphic,
  broadcastDoorToken,
  broadcastGraphics,
  broadcastStatus,
} from "@/lib/broadcast-actions";

/**
 * Studio Broadcast → Desktop: the booth. The whole OBS window (scenes,
 * sources, filters, mixer), the monitor sound and the program picture,
 * through the OBS agent's door. The edge serves the door at /obs/ on this
 * host (Nginx Proxy Manager location → host port 4458). Admins only, one
 * session at a time with the console.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Broadcast desktop — Studio — Elkdonis Arts Collective" };

const STUDIO_FONTS =
  "https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,500&family=IBM+Plex+Sans:wght@400;500;600&display=swap";

export default async function StudioBroadcastDesktopPage() {
  const user = await requireUser("/login?next=/studio/broadcast/desktop");
  if (!(await isAdmin(user.id))) notFound();
  const status = await obsStatus();

  return (
    <>
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link rel="stylesheet" href={STUDIO_FONTS} />
      <BroadcastDesk
        initialStatus={status}
        actions={{
          claim: broadcastClaim,
          status: broadcastStatus,
          doorToken: broadcastDoorToken,
          graphics: broadcastGraphics,
          deleteGraphic: broadcastDeleteGraphic,
        }}
        doorBase={process.env.OBS_DOOR_BASE || "/obs"}
        releaseEndpoint="/api/broadcast/release"
        graphicsUploadEndpoint="/api/broadcast/graphics"
        cameraUploadEndpoint="/api/broadcast/camera-upload"
        links={{ studioHref: "/studio", videoHref: "/studio?kind=video", consoleHref: "/studio/broadcast" }}
        extra={<RelayFeedsSlot />}
      />
    </>
  );
}
