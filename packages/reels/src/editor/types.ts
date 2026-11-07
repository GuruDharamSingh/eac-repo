// The Video page's contract with its host, in the Studio's pattern
// (packages/studio/src/types.ts): no data access of its own; the host binds
// server actions and passes them in. Shapes mirror
// @elkdonis/services/reels, which this package does not import.

import type { ReelEdit, ReelTemplateId } from '../types';
import type { LiveCardProps } from './LiveCard';

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

/** A sound effect (services/reels.ts listReelSounds): network library or the person's own, with its credit. */
export interface VideoSound extends VideoTrack {
  category: string;
  title?: string;
  tags?: string[];
  licence?: string;
  source?: string;
  author?: string;
  duration?: number;
}

/** A CC0 result from Freesound; `preview` is an MP3 on Freesound's CDN. */
export interface VideoFreesoundHit {
  id: number;
  name: string;
  tags: string[];
  duration: number;
  author: string;
  url: string;
  preview: string;
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

/** Speech-to-text of a recording (services/reels.ts, migration 229); words in source seconds. */
export interface VideoTranscript {
  id: string;
  path: string;
  status: 'queued' | 'running' | 'done' | 'failed';
  progress: number;
  words: Array<{ w: string; s: number; e: number }> | null;
  /** Silences in source seconds (ffmpeg silencedetect); null when the transcript has none. */
  pauses?: Array<{ s: number; e: number }> | null;
  /** Sound level, one byte per 1/rate s, base64 (render.mjs wavPeaks); arrives before the words. */
  peaks?: { rate: number; data: string } | null;
  error: string | null;
}

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
  /** Sound effects; without listSounds the timeline offers no Sound overlay. */
  listSounds?(): Promise<{ network: VideoSound[]; mine: VideoSound[] }>;
  shareSound?(path: string, category: string): Promise<VideoResult<{ path: string }>>;
  /** Freesound CC0 search and import; absent when the server has no FREESOUND_API_KEY. */
  searchFreesound?(query: string, page: number): Promise<VideoResult<{ hits: VideoFreesoundHit[]; more: boolean }>>;
  importFreesound?(id: number): Promise<VideoResult<VideoSound>>;
  /** Queue speech-to-text of a recording; without it the timeline offers no subtitles from speech. */
  transcribe?(id: string, path: string): Promise<VideoResult<VideoTranscript>>;
  getTranscript?(id: string, path: string): Promise<VideoTranscript | null>;
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
  /** The host's picture route (arts-collective /api/studio/image); with it, picture slots get "Edit picture". */
  imageEndpoint?: string;
  /** Prefix that turns a Nextcloud path into a readable URL: `/api/media/`. */
  mediaBase: string;
  /**
   * The person's own storage, browsable (MediaBrowser protocol, accepts
   * `kind=image|video`): `/api/my-files`. Slots offer "From my files" with it.
   */
  libraryEndpoint?: string;
  /**
   * Phone capture codes (`/api/capture`, @elkdonis/studio/capture): video
   * slots offer "From my phone"; the clip lands in the person's Recordings and
   * fills the slot by path. `phoneHost` is the address shown for the phone.
   */
  captureEndpoint?: string;
  phoneHost?: string;
  /**
   * `broadcastHref`: the server OBS console, passed only to admins.
   * `pageBase`: where a published reel reads, without the piece slug
   * (`<ArtDirect>/<person slug>/writing`); null when the person has no slug.
   */
  links: { broadcastHref?: string; pageBase?: string | null };
  /** "Go live" card (LiveCard.tsx): the server OBS stream from here. Passed only to admins. */
  broadcast?: LiveCardProps;
}
