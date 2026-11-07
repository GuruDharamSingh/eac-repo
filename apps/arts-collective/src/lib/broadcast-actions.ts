"use server";

import { isAdmin } from "@elkdonis/auth-server";
import { getProfile } from "@elkdonis/services";
import {
  obsClaim,
  obsDeleteRecording,
  obsDoorToken,
  obsRecord,
  obsRecordings,
  obsSaveRecording,
  obsScreenshot,
  obsSetBrowserUrl,
  obsBrowseMedia,
  obsGraphicsCommand,
  obsSourceSettings,
  obsStudio,
  obsStudioCommand,
  obsGraphicsDelete,
  obsSetScene,
  obsStatus,
  obsStream,
  obsStreamSettings,
} from "@elkdonis/services/obs";
import type {
  BroadcastClaim,
  BroadcastDoor,
  BroadcastGraphicsCommand,
  BroadcastMediaEntry,
  BroadcastStudio,
  BroadcastStudioCommand,
  BroadcastRecording,
  BroadcastResult,
  BroadcastStatus,
} from "@elkdonis/reels/broadcast";
import { getCurrentUser } from "@/lib/session";

/**
 * Studio Broadcast (/studio/broadcast): the server's one OBS instance.
 * Admins only, and one session at a time: the open tab holds a lease in the
 * OBS agent (docker/obs/agent.mjs, POST /lock) and every command carries the
 * holder id `<user id>:<tab id>`; the agent refuses commands from anyone
 * else. The holder is built here from the session, never taken whole from
 * the client.
 */

const TAB = /^[A-Za-z0-9_-]{8,40}$/;

async function holder(tabId: string): Promise<{ userId: string; holder: string } | null> {
  if (!TAB.test(tabId ?? "")) return null;
  const user = await getCurrentUser();
  if (!user || !(await isAdmin(user.id))) return null;
  return { userId: user.id, holder: `${user.id}:${tabId}` };
}

const DENIED = "Only network admins can run the broadcast studio";

async function run(tabId: string, fn: (h: string) => Promise<unknown>): Promise<BroadcastResult> {
  const h = await holder(tabId);
  if (!h) return { ok: false, error: DENIED };
  try {
    await fn(h.holder);
    return { ok: true, value: undefined };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function broadcastClaim(tabId: string): Promise<BroadcastClaim> {
  const h = await holder(tabId);
  if (!h) return { held: false, lock: null, error: DENIED };
  const profile = await getProfile(h.userId);
  try {
    return await obsClaim(h.holder, profile?.displayName?.trim() || "another admin");
  } catch (err) {
    return { held: false, lock: null, error: (err as Error).message };
  }
}

/** OBS as it is, for the Video kind's "Go live" card: admins only, no lease. */
export async function broadcastPeek(): Promise<BroadcastStatus> {
  const user = await getCurrentUser();
  if (!user || !(await isAdmin(user.id))) return { connected: false };
  return obsStatus();
}

export async function broadcastStatus(tabId: string): Promise<BroadcastStatus> {
  return (await holder(tabId)) ? obsStatus() : { connected: false };
}

export async function broadcastScreenshot(tabId: string): Promise<string | null> {
  const h = await holder(tabId);
  return h ? obsScreenshot(h.holder) : null;
}

export async function broadcastSetScene(tabId: string, name: string) {
  return run(tabId, (h) => obsSetScene(h, name));
}

export async function broadcastSetBrowserUrl(tabId: string, url: string) {
  return run(tabId, (h) => obsSetBrowserUrl(h, url));
}

export async function broadcastRecord(tabId: string, action: "start" | "stop") {
  return run(tabId, (h) => obsRecord(h, action === "stop" ? "stop" : "start"));
}

export async function broadcastStream(tabId: string, action: "start" | "stop") {
  return run(tabId, (h) => obsStream(h, action === "stop" ? "stop" : "start"));
}

export async function broadcastStreamSettings(tabId: string, server: string, key: string) {
  return run(tabId, (h) => obsStreamSettings(h, server, key));
}

export async function broadcastRecordings(tabId: string): Promise<BroadcastRecording[]> {
  return (await holder(tabId)) ? obsRecordings() : [];
}

export async function broadcastSaveRecording(tabId: string, file: string): Promise<BroadcastResult<{ path: string }>> {
  const h = await holder(tabId);
  if (!h) return { ok: false, error: DENIED };
  try {
    return { ok: true, value: await obsSaveRecording(h.holder, h.userId, file) };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function broadcastDeleteRecording(tabId: string, file: string) {
  return run(tabId, (h) => obsDeleteRecording(h, file));
}

const DOORS = new Set<BroadcastDoor>(["desktop", "audio", "program", "levels", "camera"]);

/**
 * A one-time token for the booth page's door (/obs/ on the edge →
 * obs:4458): the OBS desktop, the monitor sound or the program picture.
 * Only for the tab that holds the lease.
 */
export async function broadcastDoorToken(tabId: string, purpose: BroadcastDoor): Promise<BroadcastResult<{ token: string }>> {
  const h = await holder(tabId);
  if (!h) return { ok: false, error: DENIED };
  if (!DOORS.has(purpose)) return { ok: false, error: "Unknown door" };
  try {
    const { token } = await obsDoorToken(h.holder, purpose);
    return { ok: true, value: { token } };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/** OGraf graphics on OBS's "Overlays" source: add, play, stop, update, step, remove. */
export async function broadcastGraphics(tabId: string, cmd: BroadcastGraphicsCommand) {
  return run(tabId, (h) => obsGraphicsCommand(h, cmd));
}

/** Remove an uploaded graphic folder (the repo's graphics cannot be removed here). */
export async function broadcastDeleteGraphic(tabId: string, folder: string) {
  return run(tabId, (h) => obsGraphicsDelete(h, folder));
}

/** Scenes, sources, transitions and audio for the console's scene editor. */
export async function broadcastStudio(tabId: string): Promise<BroadcastStudio | null> {
  return (await holder(tabId)) ? obsStudio().catch(() => null) : null;
}

export async function broadcastStudioCommand(tabId: string, cmd: BroadcastStudioCommand): Promise<BroadcastResult<BroadcastStudio>> {
  const h = await holder(tabId);
  if (!h) return { ok: false, error: DENIED };
  try {
    return { ok: true, value: await obsStudioCommand(h.holder, h.userId, cmd) };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function broadcastSourceSettings(tabId: string, name: string): Promise<Record<string, unknown> | null> {
  const h = await holder(tabId);
  return h ? obsSourceSettings(h.holder, name).catch(() => null) : null;
}

/** A folder of the admin's own files (media and folders only), for "Media file" and "Image". */
export async function broadcastBrowseMedia(tabId: string, path: string): Promise<BroadcastResult<BroadcastMediaEntry[]>> {
  const h = await holder(tabId);
  if (!h) return { ok: false, error: DENIED };
  try {
    return { ok: true, value: await obsBrowseMedia(h.userId, path) };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
