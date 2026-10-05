// The Video page's contract with its host, in the Studio's pattern
// (packages/studio/src/types.ts): no data access of its own; the host binds
// server actions and passes them in. Shapes mirror
// @elkdonis/services/reels, which this package does not import.

import type { ReelEdit, ReelTemplateId } from '../types';

export interface VideoProject {
  id: string;
  orgId: string;
  title: string;
  template: ReelTemplateId;
  edit: ReelEdit;
  folder: string;
  updatedAt: string;
}

export interface VideoRender {
  id: string;
  status: 'queued' | 'running' | 'done' | 'failed';
  progress: number;
  outputPath: string | null;
  thumbPath: string | null;
  durationS: number | null;
  error: string | null;
  createdAt: string;
}

export interface VideoTrack {
  name: string;
  path: string;
  size: number;
}

/** A finished reel, offered as a segment for another reel. */
export interface VideoFinished {
  projectId: string;
  title: string;
  outputPath: string;
  thumbPath: string | null;
  durationS: number | null;
  finishedAt: string;
}

/** Where a reel is published: a writing piece on the person's page. */
export interface VideoPublication {
  threadId: string;
  slug: string;
  status: 'draft' | 'published';
  publishedAt: string | null;
}

export type VideoResult<T = undefined> = { ok: true; value: T } | { ok: false; error: string };

export interface VideoActions {
  listProjects(): Promise<VideoProject[]>;
  createProject(orgId: string, template: ReelTemplateId, title: string): Promise<VideoResult<VideoProject>>;
  saveProject(id: string, patch: { title?: string; edit?: ReelEdit }): Promise<VideoResult<VideoProject>>;
  archiveProject(id: string): Promise<VideoResult>;
  listMusic(): Promise<{ network: VideoTrack[]; mine: VideoTrack[] }>;
  shareMusic(path: string): Promise<VideoResult<{ path: string }>>;
  queueRender(id: string): Promise<VideoResult<VideoRender>>;
  listRenders(id: string): Promise<VideoRender[]>;
  listFinished(): Promise<VideoFinished[]>;
  getPublication(id: string): Promise<VideoPublication | null>;
  publish(id: string, description: string): Promise<VideoResult<VideoPublication>>;
  unpublish(id: string): Promise<VideoResult>;
}

export interface VideoKindProps {
  initialProjects: VideoProject[];
  initialProjectId: string | null;
  actions: VideoActions;
  /**
   * POST the raw file body to `<endpoint>?project=&slot=&name=`; the response
   * is `{ path }` (a Nextcloud path) or `{ error }`.
   */
  uploadEndpoint: string;
  /** Prefix that turns a Nextcloud path into a readable URL: `/api/media/`. */
  mediaBase: string;
  /**
   * The person's own storage, browsable (MediaBrowser protocol, accepts
   * `kind=image|video`): `/api/my-files`. Slots offer "From my files" with it.
   */
  libraryEndpoint?: string;
  /**
   * `broadcastHref`: the server OBS console, passed only to admins.
   * `pageBase`: where a published reel reads, without the piece slug
   * (`<ArtDirect>/<person slug>/writing`); null when the person has no slug.
   */
  links: { broadcastHref?: string; pageBase?: string | null };
}
