// The broadcast console's contract with its host (server actions bound by
// the page). Shapes mirror @elkdonis/services/obs.

export interface BroadcastStatus {
  connected: boolean;
  scenes?: string[];
  currentScene?: string;
  recording?: { active: boolean; paused: boolean; timecode: string; bytes: number };
  streaming?: { active: boolean; timecode: string; skipped: number };
  stats?: { cpu: number; memoryMb: number; fps: number; renderMs: number; renderSkipped: number; outputSkipped: number; outputTotal: number };
  browserUrl?: string | null;
  lock?: { name: string; since: string } | null;
}

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
}

export interface BroadcastConsoleProps {
  initialStatus: BroadcastStatus;
  actions: BroadcastActions;
  mediaBase: string;
  /** POST the tab id here (sendBeacon) when the tab closes. */
  releaseEndpoint: string;
  links: { studioHref: string; videoHref: string };
}
