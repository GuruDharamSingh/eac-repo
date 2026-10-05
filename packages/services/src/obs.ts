/**
 * Client for the server-side OBS agent (docker/obs/agent.mjs). Import as
 * `@elkdonis/services/obs` from server code only: it carries the agent
 * secret. There is one shared OBS instance; callers gate on users.is_admin.
 */

import { getStorageSlug, userStorageRoot } from './user-storage';

const URL_ = (process.env.OBS_AGENT_URL ?? '').replace(/\/$/, '');
const SECRET = process.env.OBS_AGENT_SECRET ?? '';

export interface ObsStatus {
  connected: boolean;
  scenes?: string[];
  currentScene?: string;
  recording?: { active: boolean; paused: boolean; timecode: string; bytes: number };
  streaming?: { active: boolean; timecode: string; skipped: number };
  stats?: {
    cpu: number;
    memoryMb: number;
    fps: number;
    renderMs: number;
    renderSkipped: number;
    outputSkipped: number;
    outputTotal: number;
  };
  browserUrl?: string | null;
  /** Who has the studio open, if anyone. One session at a time. */
  lock?: { name: string; since: string } | null;
}

/** `${userId}:${tabId}`: one browser tab of one person. */
export type ObsHolder = string;

export interface ObsRecording {
  name: string;
  size: number;
  modified: string;
}

export function obsConfigured(): boolean {
  return Boolean(URL_ && SECRET);
}

async function agent<T>(method: 'GET' | 'POST', path: string, body?: unknown, holder?: ObsHolder): Promise<T> {
  if (!obsConfigured()) throw new Error('OBS is not configured on this server');
  const headers: Record<string, string> = { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' };
  if (holder) headers['X-Holder'] = holder;
  const res = await fetch(`${URL_}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
    signal: AbortSignal.timeout(path.startsWith('/recordings/upload') ? 600_000 : 15_000),
  } as Parameters<typeof fetch>[1]);
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(data.error ?? `OBS agent ${res.status}`);
  return data as T;
}

export const obsStatus = () =>
  agent<ObsStatus>('GET', '/status').catch((): ObsStatus => ({ connected: false }));

/** The program output as a data URL, or null when OBS is not up. */
export async function obsScreenshot(holder: ObsHolder): Promise<string | null> {
  if (!obsConfigured()) return null;
  const res = await fetch(`${URL_}/screenshot`, {
    headers: { Authorization: `Bearer ${SECRET}`, 'X-Holder': holder },
    cache: 'no-store',
    signal: AbortSignal.timeout(8000),
  } as Parameters<typeof fetch>[1]).catch(() => null);
  if (!res?.ok) return null;
  return `data:image/jpeg;base64,${Buffer.from(await res.arrayBuffer()).toString('base64')}`;
}

/** Claim or renew the one session. `held: false` carries who has it. */
export const obsClaim = (holder: ObsHolder, name: string) =>
  agent<{ held: boolean; lock: { name: string; since: string } | null }>('POST', '/lock', { holder, name });
export const obsRelease = (holder: ObsHolder) => agent('POST', '/unlock', { holder });

export const obsSetScene = (h: ObsHolder, name: string) => agent('POST', '/scene', { name }, h);
export const obsSetBrowserUrl = (h: ObsHolder, url: string) => agent('POST', '/browser', { url }, h);
export const obsRecord = (h: ObsHolder, action: 'start' | 'stop') => agent('POST', '/record', { action }, h);
export const obsStream = (h: ObsHolder, action: 'start' | 'stop') => agent('POST', '/stream', { action }, h);
export const obsStreamSettings = (h: ObsHolder, server: string, key: string) =>
  agent('POST', '/stream/settings', { server, key }, h);
export const obsRecordings = () => agent<ObsRecording[]>('GET', '/recordings').catch(() => [] as ObsRecording[]);
export const obsDeleteRecording = (h: ObsHolder, file: string) => agent('POST', '/recordings/delete', { file }, h);

/**
 * Copy a recording into the person's own storage as MP4:
 * users/<storage folder>/Private/Video/Broadcasts/<name>.mp4.
 */
export async function obsSaveRecording(h: ObsHolder, userId: string, file: string): Promise<{ path: string }> {
  const slug = await getStorageSlug(userId);
  if (!slug) throw new Error('Your storage folder is not set up yet');
  const name = file.replace(/\.[^.]+$/, '').replace(/[^\w.-]+/g, '-') + '.mp4';
  const path = `${userStorageRoot(slug)}/Private/Video/Broadcasts/${name}`;
  return agent<{ path: string }>('POST', '/recordings/upload', { file, path }, h);
}
