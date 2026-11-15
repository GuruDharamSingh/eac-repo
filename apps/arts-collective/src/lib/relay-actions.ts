"use server";

import { obsAddFeedScene, obsStream, obsStreamToRelay } from "@elkdonis/services/obs";
import {
  armRelay,
  listStreamDestinations,
  listStreamEvents,
  relayAddFeed as addFeedOnRelay,
  relayRemoveFeed as removeFeedOnRelay,
  relayStatus,
  relayStopOutputs,
  removeStreamDestination,
  saveStreamDestination,
  setStreamDestinationEnabled,
  streamEvent,
} from "@elkdonis/services/relay";
import { listStreamChat, youtubeChatSources } from "@elkdonis/services/stream-chat";
import type { RelayChatMessage, RelayDestinationInput, RelayFeedView, RelayResult, RelayView } from "@elkdonis/reels/editor";
import { getCurrentUser } from "@/lib/session";
import { goLiveRole } from "@/lib/go-live-access";

/**
 * The stream relay from the Video kind's Go live card (docker/relay,
 * @elkdonis/services/relay). Admins run all of it; since 2026-11-14 an org owner runs the
 * card with their own saved destinations only (lib/go-live-access.ts): no feeds, no chat,
 * their own history. Go live and
 * Stop also drive OBS, so they need the studio's lease: the card claims it
 * first (broadcastClaim) and the holder is built here from the session,
 * `<user id>:<tab id>`, as in broadcast-actions.ts.
 */

const TAB = /^[A-Za-z0-9_-]{8,40}$/;
const DENIED = "Only network admins and organisation owners can go live";
const ADMINS_ONLY = "Only network admins can do that";

interface Actor {
  userId: string;
  /** null for an admin (every destination); the user's own id for an org owner. */
  owner: string | null;
}

async function actor(adminsOnly = false): Promise<Actor | null> {
  const user = await getCurrentUser();
  const role = await goLiveRole(user?.id);
  if (!user || !role || (adminsOnly && role !== "admin")) return null;
  return { userId: user.id, owner: role === "admin" ? null : user.id };
}

async function guarded<T>(fn: (userId: string, scope: { owner: string | null }) => Promise<T>, adminsOnly = false): Promise<RelayResult<T>> {
  const who = await actor(adminsOnly);
  if (!who) return { ok: false, error: adminsOnly ? ADMINS_ONLY : DENIED };
  try {
    return { ok: true, value: await fn(who.userId, { owner: who.owner }) };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

function holderFor(userId: string, tabId: string): string {
  if (!TAB.test(tabId ?? "")) throw new Error("Bad tab id");
  return `${userId}:${tabId}`;
}

export async function relayView(): Promise<RelayView> {
  const who = await actor();
  if (!who) return { relay: { connected: false }, destinations: [], history: [], error: DENIED };
  const userId = who.userId;
  const [status, destinations, history, chatSources] = await Promise.all([
    relayStatus(),
    listStreamDestinations({ owner: who.owner }).catch(() => null),
    listStreamEvents(8, who.owner).catch(() => []),
    youtubeChatSources(userId).catch(() => []),
  ]);
  // An org owner sees the relay's state but not its feeds (ingest keys are admins').
  const relay = who.owner ? { ...status, feeds: undefined } : status;
  return {
    relay,
    destinations: destinations ?? [],
    history,
    chatSources,
    error: destinations ? undefined : "Saved destinations are unavailable (migration 226 not applied?)",
  };
}

/** Viewer chat from the destinations (stream-chat service, migration 228) after `sinceId`. */
export async function relayChat(sinceId: number | null): Promise<RelayResult<RelayChatMessage[]>> {
  const since = Number.isSafeInteger(sinceId) && (sinceId as number) > 0 ? (sinceId as number) : null;
  return guarded(() => listStreamChat(since), true);
}

/**
 * YouTube chat is read with a connection's token by the stream-chat service,
 * so a YouTube destination may only name a channel the saving admin has
 * connected themself; an edit that keeps the stored channel is allowed.
 */
export async function relaySaveDestination(input: RelayDestinationInput) {
  return guarded(async (userId, scope) => {
    const channel = input.preset === "youtube" ? (input.chatChannel ?? "").trim() : "";
    if (channel) {
      const kept = input.id ? (await listStreamDestinations(scope)).find((d) => d.id === input.id)?.chatChannel === channel : false;
      if (!kept && !(await youtubeChatSources(userId)).some((s) => s.channelId === channel)) {
        throw new Error("Pick a YouTube channel you have connected (Center → View profile → Connections)");
      }
    }
    return saveStreamDestination(userId, input, scope);
  });
}

export async function relaySetEnabled(id: string, enabled: boolean) {
  return guarded(async (_userId, scope) => {
    await setStreamDestinationEnabled(String(id), Boolean(enabled), scope);
    return undefined;
  });
}

export async function relayRemoveDestination(id: string) {
  return guarded(async (userId, scope) => {
    await removeStreamDestination(userId, String(id), scope);
    return undefined;
  });
}

/** Arm the relay with the ticked destinations, point OBS at it, start the stream. */
export async function relayGoLive(tabId: string) {
  return guarded(async (userId, scope) => {
    const h = holderFor(userId, tabId);
    const outputs = await armRelay(scope);
    try {
      await obsStreamToRelay(h);
      await obsStream(h, "start");
    } catch (err) {
      await relayStopOutputs().catch(() => {});
      throw err;
    }
    await streamEvent(userId, "go_live", null, { outputs: outputs.map((o) => ({ id: o.id, label: o.label, host: o.host })) });
    return undefined;
  });
}

/** Stop OBS's stream, then the relay's outputs; the summary goes to stream_events. */
export async function relayStop(tabId: string) {
  return guarded(async (userId, scope) => {
    const h = holderFor(userId, tabId);
    let obsError: string | null = null;
    await obsStream(h, "stop").catch((err: Error) => (obsError = err.message));
    // An org owner who does not hold the lease (OBS refused the holder) must not cut the outputs of
    // whoever is live; admins keep the old behaviour (outputs stop regardless).
    if (obsError && scope.owner) throw new Error(`Not stopped: ${obsError}`);
    const outputs = await relayStopOutputs();
    await streamEvent(userId, "stop", null, {
      outputs: outputs.map((o) => ({ id: o.id, label: o.label, liveSeconds: o.liveSeconds, bytes: o.bytes, retries: o.retries, lastError: o.lastError })),
      ...(obsError ? { obsError } : {}),
    });
    if (obsError) throw new Error(`Outputs stopped; OBS said: ${obsError}`);
    return undefined;
  });
}

export async function relayAddFeed(label: string) {
  return guarded<RelayFeedView>(async (userId) => {
    const f = await addFeedOnRelay(String(label ?? ""));
    await streamEvent(userId, "feed_added", null, { label: f.label });
    return { ...f, ready: false };
  }, true);
}

export async function relayRemoveFeed(key: string) {
  return guarded(async (userId) => {
    const feed = (await relayStatus()).feeds?.find((f) => f.key === key);
    await removeFeedOnRelay(String(key));
    await streamEvent(userId, "feed_removed", null, { label: feed?.label ?? null });
    return undefined;
  }, true);
}

/** The feed as its own OBS scene ("Feed · <label>"). Needs the lease. */
export async function relayFeedToScene(tabId: string, key: string) {
  return guarded(async (userId) => {
    const h = holderFor(userId, tabId);
    const feed = (await relayStatus()).feeds?.find((f) => f.key === key);
    if (!feed) throw new Error("That feed is gone");
    return obsAddFeedScene(h, feed.key, feed.label);
  }, true);
}
