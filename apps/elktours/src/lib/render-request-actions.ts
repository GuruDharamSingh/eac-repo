"use server";
// CONTRACT: fly-over request server actions. Editors request; elktours owners accept/reject/requeue. Types in lib/catalogue-types.ts.

import { revalidatePath } from "next/cache";
import { requireOrgEditor, type Viewer } from "@/lib/auth";
import {
  RenderError,
  acceptRequest,
  cancelRequest,
  createRequest,
  getRenderRequest,
  listRenderRequests,
  rejectRequest,
  requeueRequest,
} from "@/lib/render-requests";
import type { RenderRequest, RenderRequestFilter, RenderStyleInput, Result } from "@/lib/catalogue-types";

/**
 * Phase A defaults (spec §5 Q2, easy to change here):
 *   - who requests: editors (owner or guide);
 *   - who accepts / rejects / re-queues: owners only (ACCEPT_ROLES);
 *   - auto_publish: off; delivered films land hidden.
 */
const ACCEPT_ROLES = ["owner"] as const;
const canAccept = (v: Viewer) => v.role !== null && (ACCEPT_ROLES as readonly string[]).includes(v.role);

function revalidate(req: RenderRequest | null) {
  revalidatePath("/manage/flyovers");
  if (req) revalidatePath(`/manage/tours/${req.threadId}/flyover`);
}

const fail = (err: unknown, fallback: string): { ok: false; error: string } => {
  if (!(err instanceof RenderError)) console.error("[elktours] flyover action:", err);
  return { ok: false, error: err instanceof Error ? err.message : fallback };
};

export async function listRenderRequestsAction(filter: RenderRequestFilter = {}): Promise<RenderRequest[]> {
  await requireOrgEditor();
  return listRenderRequests(filter);
}

export async function requestFlyoverAction(threadId: string, input: { style?: RenderStyleInput; note?: string }): Promise<Result<{ request: RenderRequest }>> {
  const viewer = await requireOrgEditor();
  try {
    const request = await createRequest(threadId, input ?? {}, viewer.userId, viewer.email);
    revalidate(request);
    return { ok: true, request };
  } catch (err) {
    return fail(err, "Could not request the fly-over.");
  }
}

/** Owner only. Freezes the payload (route + stops + style, <=30 s); refuses when the tour is not renderable. */
export async function acceptFlyoverAction(id: string, opts?: { priority?: number; autoPublish?: boolean }): Promise<Result<{ request: RenderRequest }>> {
  const viewer = await requireOrgEditor();
  if (!canAccept(viewer)) return { ok: false, error: "Only the company owners accept fly-over requests." };
  try {
    const request = await acceptRequest(id, viewer.userId, { priority: opts?.priority, autoPublish: opts?.autoPublish ?? false });
    revalidate(request);
    return { ok: true, request };
  } catch (err) {
    return fail(err, "Could not accept the request.");
  }
}

export async function rejectFlyoverAction(id: string, reason: string): Promise<Result<{ request: RenderRequest }>> {
  const viewer = await requireOrgEditor();
  if (!canAccept(viewer)) return { ok: false, error: "Only the company owners reject fly-over requests." };
  try {
    const request = await rejectRequest(id, reason ?? "");
    revalidate(request);
    return { ok: true, request };
  } catch (err) {
    return fail(err, "Could not reject the request.");
  }
}

/** The requester or an owner; only while requested/accepted. */
export async function cancelFlyoverAction(id: string): Promise<Result<{ request: RenderRequest }>> {
  const viewer = await requireOrgEditor();
  const req = await getRenderRequest(id);
  if (!req) return { ok: false, error: "Request not found." };
  if (!canAccept(viewer) && req.requestedBy !== viewer.userId) return { ok: false, error: "Only the requester or an owner can cancel this." };
  try {
    const request = await cancelRequest(id);
    revalidate(request);
    return { ok: true, request };
  } catch (err) {
    return fail(err, "Could not cancel the request.");
  }
}

/** Owner only: a failed request goes back to accepted with a fresh payload and attempts reset. */
export async function requeueFlyoverAction(id: string): Promise<Result<{ request: RenderRequest }>> {
  const viewer = await requireOrgEditor();
  if (!canAccept(viewer)) return { ok: false, error: "Only the company owners re-queue fly-overs." };
  try {
    const request = await requeueRequest(id, viewer.userId);
    revalidate(request);
    return { ok: true, request };
  } catch (err) {
    return fail(err, "Could not re-queue the request.");
  }
}

/** Whether the viewer may accept (owner). For showing/hiding the queue buttons. */
export async function canAcceptFlyoversAction(): Promise<boolean> {
  const viewer = await requireOrgEditor();
  return canAccept(viewer);
}
