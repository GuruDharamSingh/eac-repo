"use server";

import { deleteRecording, listRecordings, renameRecording, type Recording } from "@elkdonis/services/recordings";
import { obsConfigured, obsCopyRecording, obsRecordings, obsRemoveRecording, type ObsRecording } from "@elkdonis/services/obs";
import { getProfile } from "@elkdonis/services";
import { isAdmin } from "@elkdonis/auth-server";
import { getCurrentUser } from "@/lib/session";

/**
 * The Studio's Recordings kind: the signed-in person's own recordings
 * (Private/Video/Recordings, the booth's Private/Video/Camera and
 * Private/Video/Broadcasts). The person comes from the session; paths are
 * checked to be theirs in the service.
 *
 * The booth* actions list and copy the OBS container's own recordings into
 * the person's Broadcasts folder: admins only, as the booth itself.
 */
type Result<T> = { ok: true; value: T } | { ok: false; error: string };

async function me() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in first");
  return user.id;
}

export async function listRecordingsAction(): Promise<Recording[]> {
  try {
    return await listRecordings(await me());
  } catch {
    return [];
  }
}

export async function renameRecordingAction(path: string, name: string): Promise<Result<{ path: string }>> {
  try {
    return { ok: true, value: await renameRecording(await me(), path, name) };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function deleteRecordingAction(path: string): Promise<Result<null>> {
  try {
    await deleteRecording(await me(), path);
    return { ok: true, value: null };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

async function admin() {
  const id = await me();
  if (!(await isAdmin(id))) throw new Error("Only admins can reach the broadcast booth");
  if (!obsConfigured()) throw new Error("The broadcast booth is not set up");
  return id;
}

export async function boothRecordingsAction(): Promise<Result<ObsRecording[]>> {
  try {
    await admin();
    return { ok: true, value: await obsRecordings() };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function boothCopyRecordingAction(file: string): Promise<Result<NonNullable<ObsRecording["copy"]>>> {
  try {
    const id = await admin();
    const profile = await getProfile(id);
    return { ok: true, value: await obsCopyRecording(id, file, profile?.displayName?.trim() || "an admin") };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function boothRemoveRecordingAction(file: string): Promise<Result<null>> {
  try {
    await admin();
    await obsRemoveRecording(file);
    return { ok: true, value: null };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
