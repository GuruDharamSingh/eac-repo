"use server";

import { isAdmin } from "@elkdonis/auth-server";
import { getProfile } from "@elkdonis/services";
import {
  obsClaim,
  obsDeleteRecording,
  obsRecord,
  obsRecordings,
  obsSaveRecording,
  obsScreenshot,
  obsSetBrowserUrl,
  obsSetScene,
  obsStatus,
  obsStream,
  obsStreamSettings,
} from "@elkdonis/services/obs";
import type { BroadcastClaim, BroadcastRecording, BroadcastResult, BroadcastStatus } from "@elkdonis/reels/broadcast";
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
