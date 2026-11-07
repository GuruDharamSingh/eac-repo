// The Go live card's contract with the stream relay (docker/relay), bound by
// the host page to server actions. Shapes mirror @elkdonis/services/relay.

export type RelayResult<T = undefined> = { ok: true; value: T } | { ok: false; error: string };

export type RelayOutputState = 'waiting' | 'connecting' | 'live' | 'retrying' | 'stopped';

export interface RelayOutputView {
  id: string;
  label: string;
  host: string;
  state: RelayOutputState;
  since: string;
  retries: number;
  lastError: string | null;
  bytes: number;
  liveSeconds: number;
}

export interface RelayFeedView {
  key: string;
  label: string;
  createdAt: string;
  ready: boolean;
  tracks?: string[];
}

export interface RelayStatusView {
  connected: boolean;
  program?: { ready: boolean; since?: string | null; tracks?: string[] };
  outputs?: RelayOutputView[];
  feeds?: RelayFeedView[];
}

export type RelayPreset = 'youtube' | 'facebook' | 'twitch' | 'kick' | 'custom';

export interface RelayDestinationView {
  id: string;
  label: string;
  preset: RelayPreset;
  server: string;
  keyHint: string;
  enabled: boolean;
  /** Twitch login, Kick slug, or YouTube channel id (UC…) whose chat is collected (the Chat panel). */
  chatChannel: string | null;
  updatedAt: string;
}

export interface RelayDestinationInput {
  id?: string;
  label: string;
  preset: RelayPreset;
  server?: string;
  key?: string;
  enabled?: boolean;
  chatChannel?: string | null;
}

export interface RelayChatMessage {
  id: number;
  platform: 'twitch' | 'youtube' | 'facebook' | 'kick';
  channel: string;
  author: string;
  body: string;
  colour: string | null;
  /** A paid message's amount (YouTube Super Chat). */
  amount?: string | null;
  sentAt: string;
}

export interface RelayHistoryRow {
  at: string;
  event: string;
  userName: string | null;
  detail: Record<string, unknown>;
}

/** A connected YouTube channel a YouTube destination may take its chat from. */
export interface RelayChatSource {
  platform: 'youtube';
  channelId: string;
  name: string;
}

export interface RelayView {
  relay: RelayStatusView;
  destinations: RelayDestinationView[];
  history: RelayHistoryRow[];
  /** The viewer's own connected YouTube channels. */
  chatSources?: RelayChatSource[];
  error?: string;
}

/** Server actions; tabId ones also drive OBS and need the studio's lease. */
export interface RelayActions {
  view(): Promise<RelayView>;
  saveDestination(input: RelayDestinationInput): Promise<RelayResult<RelayDestinationView>>;
  setEnabled(id: string, enabled: boolean): Promise<RelayResult>;
  removeDestination(id: string): Promise<RelayResult>;
  goLive(tabId: string): Promise<RelayResult>;
  stop(tabId: string): Promise<RelayResult>;
  addFeed(label: string): Promise<RelayResult<RelayFeedView>>;
  removeFeed(key: string): Promise<RelayResult>;
  feedToScene(tabId: string, key: string): Promise<RelayResult<{ scene: string }>>;
  /** Viewer chat from the destinations after `sinceId` (null: the recent ones); absent hides the Chat panel. */
  chat?(sinceId: number | null): Promise<RelayResult<RelayChatMessage[]>>;
  /** Where feeds publish, as shown to people (e.g. rtmp://relay:1935/in). */
  ingestUrl: string;
  /** Path of the guest camera page (WHIP from the browser), e.g. "/guest/camera"; the link is <origin><path>/<key>. */
  guestCameraPath?: string;
}
