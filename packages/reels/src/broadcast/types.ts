// The broadcast console's contract with its host (server actions bound by
// the page). Shapes mirror @elkdonis/services/obs.

import type { ReactNode } from 'react';

export interface BroadcastStatus {
  connected: boolean;
  scenes?: string[];
  currentScene?: string;
  recording?: { active: boolean; paused: boolean; timecode: string; bytes: number };
  streaming?: { active: boolean; timecode: string; skipped: number };
  stats?: { cpu: number; memoryMb: number; fps: number; renderMs: number; renderSkipped: number; outputSkipped: number; outputTotal: number };
  browserUrl?: string | null;
  graphics?: BroadcastGraphics;
  lock?: { name: string; since: string } | null;
}

/** OBS as the scene editor sees it (agent "Studio"). Scenes and their sources are top-first. */
export interface BroadcastStudio {
  scenes: { name: string; items: BroadcastStudioItem[] }[];
  program: string;
  preview: string | null;
  studioMode: boolean;
  transitions: string[];
  transition: string;
  transitionMs: number | null;
  audio: BroadcastAudioInput[];
  layouts: string[];
}
export interface BroadcastStudioItem {
  id: number;
  source: string;
  /** OBS input kind (browser_source, ffmpeg_source, image_source, text_ft2_source_v2, color_source_v3, …). */
  kind: string;
  enabled: boolean;
  /** The studio's own sources (Overlays, Browser page, …): not renamed or deleted here. */
  builtIn: boolean;
}
export interface BroadcastAudioInput {
  name: string;
  kind: string;
  volumeDb: number;
  muted: boolean;
  monitor: boolean;
}
/** A scene-editor command; the agent's studioCommand checks every field. */
export type BroadcastStudioCommand = { op: string } & Record<string, unknown>;
/** One folder entry of the person's files, for the media picker (path relative to their folder). */
export interface BroadcastMediaEntry {
  name: string;
  path: string;
  isFolder: boolean;
  size: number;
  kind: 'video' | 'audio' | 'image' | null;
}
/** What the scene editor needs from its host, bound to the tab by the console. */
export interface BroadcastStudioActions {
  studio(tabId: string): Promise<BroadcastStudio | null>;
  studioCommand(tabId: string, cmd: BroadcastStudioCommand): Promise<BroadcastResult<BroadcastStudio>>;
  sourceSettings(tabId: string, name: string): Promise<Record<string, unknown> | null>;
  browseMedia(tabId: string, path: string): Promise<BroadcastResult<BroadcastMediaEntry[]>>;
}

/** One OGraf graphic the OBS agent found (docker/obs/overlay/graphics/ or an admin's upload). */
export interface BroadcastGraphic {
  id: string;
  name: string;
  description: string;
  version: string | null;
  author: { name: string; url: string | null } | null;
  source: 'repo' | 'uploads';
  folder: string;
  /** JSON Schema of the graphic's data (OGraf manifest `schema`). */
  schema: BroadcastSchema | null;
  /** OGraf: -1 unknown, 0 plays once, 1 one step (the default), >1 steps. */
  stepCount: number;
  customActions: { id: string; name: string; description: string; schema: unknown }[];
}

/** The part of JSON Schema the panel's form understands. */
export interface BroadcastSchema {
  type?: string;
  title?: string;
  description?: string;
  default?: unknown;
  enum?: unknown[];
  minimum?: number;
  maximum?: number;
  maxLength?: number;
  gddType?: string;
  /** GDD extras; `labels` names each enum value for the form. */
  gddOptions?: { labels?: Record<string, string> };
  properties?: Record<string, BroadcastSchema>;
}

/** One graphic instance on the "Overlays" source; the first layer is at the bottom. */
export interface BroadcastLayer {
  id: string;
  graphicId: string;
  data: Record<string, unknown>;
  playing: boolean;
  step: number;
}

export interface BroadcastGraphics {
  catalog: BroadcastGraphic[];
  layers: BroadcastLayer[];
}

export type BroadcastGraphicsCommand =
  | { op: 'add'; graphicId: string; data?: Record<string, unknown> }
  | { op: 'remove' | 'play' | 'stop'; layerId: string }
  | { op: 'update'; layerId: string; data: Record<string, unknown> }
  | { op: 'step'; layerId: string; delta: number }
  | { op: 'custom'; layerId: string; actionId: string; payload?: Record<string, unknown> }
  | { op: 'move'; layerId: string; delta: 1 | -1 }
  | { op: 'clear' };

/** The one-session lease: `held` for this tab, or who has it. */
export interface BroadcastClaim {
  held: boolean;
  lock: { name: string; since: string } | null;
  error?: string;
}

export interface BroadcastRecording {
  name: string;
  size: number;
  modified: string;
}

export type BroadcastResult<T = undefined> = { ok: true; value: T } | { ok: false; error: string };

/** Every action takes the tab's id: the host turns it into the lease holder. */
export interface BroadcastActions {
  claim(tabId: string): Promise<BroadcastClaim>;
  status(tabId: string): Promise<BroadcastStatus>;
  screenshot(tabId: string): Promise<string | null>;
  setScene(tabId: string, name: string): Promise<BroadcastResult>;
  setBrowserUrl(tabId: string, url: string): Promise<BroadcastResult>;
  record(tabId: string, action: 'start' | 'stop'): Promise<BroadcastResult>;
  stream(tabId: string, action: 'start' | 'stop'): Promise<BroadcastResult>;
  streamSettings(tabId: string, server: string, key: string): Promise<BroadcastResult>;
  recordings(tabId: string): Promise<BroadcastRecording[]>;
  saveRecording(tabId: string, file: string): Promise<BroadcastResult<{ path: string }>>;
  deleteRecording(tabId: string, file: string): Promise<BroadcastResult>;
  graphics?(tabId: string, cmd: BroadcastGraphicsCommand): Promise<BroadcastResult>;
  deleteGraphic?(tabId: string, folder: string): Promise<BroadcastResult>;
  /** The scene editor; absent hides it and the console shows plain scene buttons. */
  studio?: BroadcastStudioActions;
  /** A one-time door token, for the mixer's meters (needs the /obs/ edge location). */
  doorToken?(tabId: string, purpose: BroadcastDoor): Promise<BroadcastResult<{ token: string }>>;
}

/** What the booth page opens through the OBS agent's door. */
export type BroadcastDoor = 'desktop' | 'audio' | 'program' | 'levels' | 'camera';

export interface BroadcastConsoleProps {
  initialStatus: BroadcastStatus;
  actions: BroadcastActions;
  mediaBase: string;
  /** POST the tab id here (sendBeacon) when the tab closes. */
  releaseEndpoint: string;
  links: { studioHref: string; videoHref: string; desktopHref?: string };
  /** More panels after Graphics (e.g. the relay's Feeds in); they read the tab id from BroadcastTabContext. */
  extra?: ReactNode;
  /** POST target for GraphicsPanel's folder upload (FormData: tabId, folder, path/file pairs). */
  graphicsUploadEndpoint?: string;
  /** The camera-upload route for CameraPanel's recordings (start, part, finish, abort). */
  cameraUploadEndpoint?: string;
  /** Where the agent's door is served (meters), same origin: "/obs". */
  doorBase?: string;
}

/** The booth: the full OBS window (noVNC), the monitor sound and the program picture. */
export interface BroadcastDeskProps {
  initialStatus: BroadcastStatus;
  actions: {
    claim(tabId: string): Promise<BroadcastClaim>;
    status(tabId: string): Promise<BroadcastStatus>;
    doorToken(tabId: string, purpose: BroadcastDoor): Promise<BroadcastResult<{ token: string }>>;
    graphics?(tabId: string, cmd: BroadcastGraphicsCommand): Promise<BroadcastResult>;
    deleteGraphic?(tabId: string, folder: string): Promise<BroadcastResult>;
  };
  /** Where the agent's door is served, same origin: "/obs" (edge location → obs:4458). */
  doorBase: string;
  releaseEndpoint: string;
  links: { studioHref: string; videoHref: string; consoleHref: string };
  /** More panels after Graphics; they read the tab id from BroadcastTabContext. */
  extra?: ReactNode;
  /** POST target for GraphicsPanel's folder upload (FormData: tabId, folder, path/file pairs). */
  graphicsUploadEndpoint?: string;
  /** The camera-upload route for CameraPanel's recordings (start, part, finish, abort). */
  cameraUploadEndpoint?: string;
}
