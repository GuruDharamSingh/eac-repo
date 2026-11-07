"use server";

import {
  archiveReelProject,
  createReelProject,
  listReelMusic,
  listReelProjects,
  listReelRenders,
  listFinishedReels,
  getReelPublication,
  publishReel,
  unpublishReel,
  queueReelRender,
  queueReelTranscript,
  getReelTranscript,
  type ReelTranscript,
  saveReelProject,
  shareReelMusic,
  listReelSounds,
  shareReelSound,
  searchFreesound,
  importFreesound,
  type ReelProject,
  type ReelRender,
} from "@elkdonis/services/reels";
import type { ReelEdit, ReelTemplateId } from "@elkdonis/reels";
import type { VideoFinished, VideoFreesoundHit, VideoProject, VideoPublication, VideoRender, VideoResult, VideoSound, VideoTrack, VideoTranscript } from "@elkdonis/reels/editor";
import { getCurrentUser } from "@/lib/session";

/**
 * The Studio Video page's writes (/studio/video). Every action resolves the
 * acting user from the session; the services functions scope each query to
 * that owner, so a project id from another account is not found.
 */

const toProject = (p: ReelProject): VideoProject => ({
  id: p.id,
  orgId: p.orgId,
  title: p.title,
  template: p.template as ReelTemplateId,
  edit: { template: p.template as ReelTemplateId, ...(p.edit as Partial<ReelEdit>) },
  folder: p.folder,
  updatedAt: p.updatedAt,
});

const toRender = (r: ReelRender): VideoRender => ({
  id: r.id,
  status: r.status,
  progress: r.progress,
  outputPath: r.outputPath,
  thumbPath: r.thumbPath,
  durationS: r.durationS,
  error: r.error,
  createdAt: r.createdAt,
});

async function userId(): Promise<string | null> {
  return (await getCurrentUser())?.id ?? null;
}

export async function listVideoProjects(): Promise<VideoProject[]> {
  const id = await userId();
  return id ? (await listReelProjects(id)).map(toProject) : [];
}

export async function createVideoProject(
  orgId: string,
  template: ReelTemplateId,
  title: string
): Promise<VideoResult<VideoProject>> {
  const id = await userId();
  if (!id) return { ok: false, error: "Sign in again" };
  const res = await createReelProject(id, orgId, template, title);
  return res.ok && res.project ? { ok: true, value: toProject(res.project) } : { ok: false, error: res.error ?? "Could not start a reel" };
}

export async function saveVideoProject(
  projectId: string,
  patch: { title?: string; edit?: ReelEdit }
): Promise<VideoResult<VideoProject>> {
  const id = await userId();
  if (!id) return { ok: false, error: "Sign in again" };
  const res = await saveReelProject(id, projectId, {
    title: patch.title,
    edit: patch.edit as unknown as Record<string, unknown> | undefined,
  });
  return res.ok && res.project ? { ok: true, value: toProject(res.project) } : { ok: false, error: res.error ?? "Not saved" };
}

export async function archiveVideoProject(projectId: string): Promise<VideoResult> {
  const id = await userId();
  if (!id) return { ok: false, error: "Sign in again" };
  return (await archiveReelProject(id, projectId)) ? { ok: true, value: undefined } : { ok: false, error: "Not found" };
}

export async function listVideoMusic(): Promise<{ network: VideoTrack[]; mine: VideoTrack[] }> {
  const id = await userId();
  return id ? listReelMusic(id) : { network: [], mine: [] };
}

export async function shareVideoMusic(path: string): Promise<VideoResult<{ path: string }>> {
  const id = await userId();
  if (!id) return { ok: false, error: "Sign in again" };
  const res = await shareReelMusic(id, path);
  return res.ok && res.path ? { ok: true, value: { path: res.path } } : { ok: false, error: res.error ?? "Not shared" };
}

export async function listVideoSounds(): Promise<{ network: VideoSound[]; mine: VideoSound[] }> {
  const id = await userId();
  return id ? listReelSounds(id) : { network: [], mine: [] };
}

export async function shareVideoSound(path: string, category: string): Promise<VideoResult<{ path: string }>> {
  const id = await userId();
  if (!id) return { ok: false, error: "Sign in again" };
  const res = await shareReelSound(id, path, String(category ?? "").slice(0, 60));
  return res.ok && res.path ? { ok: true, value: { path: res.path } } : { ok: false, error: res.error ?? "Not shared" };
}

export async function searchVideoFreesound(query: string, page: number): Promise<VideoResult<{ hits: VideoFreesoundHit[]; more: boolean }>> {
  if (!(await userId())) return { ok: false, error: "Sign in again" };
  const res = await searchFreesound(String(query ?? ""), Number(page) || 1);
  return res.ok ? { ok: true, value: { hits: res.hits ?? [], more: !!res.more } } : { ok: false, error: res.error ?? "Search failed" };
}

export async function importVideoFreesound(soundId: number): Promise<VideoResult<VideoSound>> {
  const id = await userId();
  if (!id) return { ok: false, error: "Sign in again" };
  const res = await importFreesound(id, Number(soundId));
  return res.ok && res.sound ? { ok: true, value: res.sound } : { ok: false, error: res.error ?? "Not added" };
}

export async function queueVideoRender(projectId: string): Promise<VideoResult<VideoRender>> {
  const id = await userId();
  if (!id) return { ok: false, error: "Sign in again" };
  const res = await queueReelRender(id, projectId);
  return res.ok && res.render ? { ok: true, value: toRender(res.render) } : { ok: false, error: res.error ?? "Could not queue the render" };
}

export async function listVideoRenders(projectId: string): Promise<VideoRender[]> {
  const id = await userId();
  return id ? (await listReelRenders(id, projectId)).map(toRender) : [];
}

export async function listVideoFinished(): Promise<VideoFinished[]> {
  const id = await userId();
  return id ? listFinishedReels(id) : [];
}

export async function getVideoPublication(projectId: string): Promise<VideoPublication | null> {
  const id = await userId();
  return id ? getReelPublication(id, projectId) : null;
}

export async function publishVideo(projectId: string, description: string): Promise<VideoResult<VideoPublication>> {
  const id = await userId();
  if (!id) return { ok: false, error: "Sign in again" };
  const res = await publishReel(id, projectId, { description: description.slice(0, 600) });
  return res.ok && res.publication ? { ok: true, value: res.publication } : { ok: false, error: res.error ?? "Not published" };
}

export async function unpublishVideo(projectId: string): Promise<VideoResult> {
  const id = await userId();
  if (!id) return { ok: false, error: "Sign in again" };
  const res = await unpublishReel(id, projectId);
  return res.ok ? { ok: true, value: undefined } : { ok: false, error: res.error ?? "Not unpublished" };
}

const toTranscript = (t: ReelTranscript): VideoTranscript => ({
  id: t.id,
  path: t.path,
  status: t.status,
  progress: t.progress,
  words: t.words,
  pauses: t.pauses,
  peaks: t.peaks,
  error: t.error,
});

export async function transcribeVideo(projectId: string, path: string): Promise<VideoResult<VideoTranscript>> {
  const id = await userId();
  if (!id) return { ok: false, error: "Sign in again" };
  const res = await queueReelTranscript(id, projectId, path);
  return res.ok && res.transcript ? { ok: true, value: toTranscript(res.transcript) } : { ok: false, error: res.error ?? "Could not start the transcript" };
}

export async function getVideoTranscript(projectId: string, path: string): Promise<VideoTranscript | null> {
  const id = await userId();
  if (!id) return null;
  const t = await getReelTranscript(id, projectId, path);
  return t ? toTranscript(t) : null;
}
