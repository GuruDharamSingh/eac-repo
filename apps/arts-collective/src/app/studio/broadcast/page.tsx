import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isAdmin } from "@elkdonis/auth-server";
import { obsStatus } from "@elkdonis/services/obs";
import { BroadcastConsole } from "@elkdonis/reels/broadcast";
import "@elkdonis/studio/studio.css";
import "@elkdonis/reels/editor.css";
import "@elkdonis/reels/broadcast.css";
import { requireUser } from "@/lib/session";
import { RelayFeedsSlot } from "@/components/studio/RelayFeedsSlot";
import {
  broadcastClaim,
  broadcastDeleteRecording,
  broadcastBrowseMedia,
  broadcastDeleteGraphic,
  broadcastDoorToken,
  broadcastGraphics,
  broadcastRecord,
  broadcastRecordings,
  broadcastSaveRecording,
  broadcastScreenshot,
  broadcastSetBrowserUrl,
  broadcastSetScene,
  broadcastSourceSettings,
  broadcastStatus,
  broadcastStream,
  broadcastStreamSettings,
  broadcastStudio,
  broadcastStudioCommand,
} from "@/lib/broadcast-actions";

/**
 * Studio Broadcast: the server-side OBS instance (docker/obs). The other
 * route into video, beside /studio/video's browser uploads and recorder.
 * Admins only while there is one shared instance.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Broadcast — Studio — Elkdonis Arts Collective" };

const STUDIO_FONTS =
  "https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,500&family=IBM+Plex+Sans:wght@400;500;600&display=swap";

export default async function StudioBroadcastPage() {
  const user = await requireUser("/login?next=/studio/broadcast");
  if (!(await isAdmin(user.id))) notFound();
  const status = await obsStatus();

  return (
    <>
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link rel="stylesheet" href={STUDIO_FONTS} />
      <BroadcastConsole
        initialStatus={status}
        actions={{
          claim: broadcastClaim,
          status: broadcastStatus,
          screenshot: broadcastScreenshot,
          setScene: broadcastSetScene,
          setBrowserUrl: broadcastSetBrowserUrl,
          record: broadcastRecord,
          stream: broadcastStream,
          streamSettings: broadcastStreamSettings,
          recordings: broadcastRecordings,
          saveRecording: broadcastSaveRecording,
          deleteRecording: broadcastDeleteRecording,
          graphics: broadcastGraphics,
          deleteGraphic: broadcastDeleteGraphic,
          studio: {
            studio: broadcastStudio,
            studioCommand: broadcastStudioCommand,
            sourceSettings: broadcastSourceSettings,
            browseMedia: broadcastBrowseMedia,
          },
          doorToken: broadcastDoorToken,
        }}
        mediaBase="/api/media/"
        releaseEndpoint="/api/broadcast/release"
        graphicsUploadEndpoint="/api/broadcast/graphics"
        cameraUploadEndpoint="/api/broadcast/camera-upload"
        doorBase={process.env.OBS_DOOR_BASE || "/obs"}
        links={{ studioHref: "/studio", videoHref: "/studio?kind=video", desktopHref: "/studio/broadcast/desktop" }}
        extra={<RelayFeedsSlot />}
      />
    </>
  );
}
