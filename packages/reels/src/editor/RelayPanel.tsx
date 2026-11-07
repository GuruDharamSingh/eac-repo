'use client';

// The Go live card's body when the stream relay is configured (2026-11-01):
// saved destinations with checkboxes, Go live sends OBS to the relay once and
// the relay copies the stream to every ticked destination; each output's
// state comes back from the relay. Feeds in (Zoom, a phone, another OBS)
// get a publish address and key here, and "Add to OBS" makes each one a scene.

import * as React from 'react';
import { RelayChat } from './RelayChat';
import { RelayFeeds } from './RelayFeeds';
import type { RelayActions, RelayDestinationInput, RelayDestinationView, RelayOutputView, RelayPreset, RelayResult, RelayView } from './relay-types';

export interface RelayPanelProps {
  actions: RelayActions;
  tabId: string;
  obsConnected: boolean;
  /** OBS's stream output is on. */
  live: boolean;
  /** Claim the studio's lease; resolves to an error message, or null when held. */
  takeStudio(): Promise<string | null>;
  releaseStudio(): void;
  onChanged(): void;
}

// `server: true`: the platform gives each account its own server address.
// `chat: true`: the destination can name a channel whose chat the Chat panel collects.
// `chatFrom: true`: the chat comes from one of the person's connected channels (YouTube).
const PRESETS: { id: RelayPreset; label: string; hint: string; server?: true; serverHint?: string; chat?: true; chatFrom?: true }[] = [
  { id: 'youtube', label: 'YouTube Live', hint: 'YouTube Studio → Go live → Stream key', chatFrom: true },
  { id: 'facebook', label: 'Facebook Live', hint: 'Live Producer → Streaming software → Stream key' },
  { id: 'twitch', label: 'Twitch', hint: 'Twitch Creator Dashboard → Settings → Stream → Primary Stream key', chat: true },
  { id: 'kick', label: 'Kick', hint: 'Kick Creator Dashboard → Settings → Stream URL and Key → Stream Key', server: true, serverHint: 'rtmps://….global-contribute.live-video.net/app (Stream URL in Kick\'s dashboard)' },
  { id: 'custom', label: 'Another RTMP server', hint: 'The server address and key the platform gives you', server: true, serverHint: 'rtmp://…' },
];

const EMPTY: RelayDestinationInput = { label: '', preset: 'youtube', server: '', key: '', chatChannel: '' };

function clock(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return `${h ? `${h}:` : ''}${String(m).padStart(h ? 2 : 1, '0')}:${String(ss).padStart(2, '0')}`;
}

function outputText(o: RelayOutputView): string {
  switch (o.state) {
    case 'live': return `live · ${clock(o.liveSeconds)}`;
    case 'connecting': return 'connecting';
    case 'retrying': return `retrying (${o.retries})`;
    case 'waiting': return 'waiting for OBS';
    default: return o.state;
  }
}

const EVENT_TEXT: Record<string, string> = {
  go_live: 'went live',
  stop: 'stopped',
  destination_added: 'added a destination',
  destination_updated: 'changed a destination',
  destination_removed: 'removed a destination',
  feed_added: 'added a feed',
  feed_removed: 'removed a feed',
};

export function RelayPanel(props: RelayPanelProps) {
  const { actions } = props;
  const [view, setView] = React.useState<RelayView | null>(null);
  const [form, setForm] = React.useState<RelayDestinationInput | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(() => actions.view().then(setView).catch(() => {}), [actions]);
  React.useEffect(() => {
    void refresh();
    const t = window.setInterval(() => void refresh(), 4000);
    return () => window.clearInterval(t);
  }, [refresh]);

  /** Run one action; shows its error, and returns the result (null if it threw). */
  async function act<T>(name: string, fn: () => Promise<RelayResult<T>>): Promise<RelayResult<T> | null> {
    setBusy(name);
    setError(null);
    try {
      const r = await fn();
      // Check `ok`, not `'value' in r`: a server action's `value: undefined` arrives without the key.
      if (!r.ok) setError((r as { error: string }).error);
      return r;
    } catch (err) {
      setError((err as Error).message);
      return null;
    } finally {
      setBusy(null);
      void refresh();
    }
  }

  const relay = view?.relay;
  const destinations = view?.destinations ?? [];
  const outputs = new Map((relay?.outputs ?? []).map((o) => [o.id, o]));
  const ticked = destinations.filter((d) => d.enabled);
  const feeds = relay?.feeds ?? [];
  const sources = view?.chatSources ?? [];
  const chatName = (d: RelayDestinationView) =>
    d.preset === 'youtube' ? sources.find((s) => s.channelId === d.chatChannel)?.name ?? 'YouTube channel' : `#${d.chatChannel}`;

  async function goLive() {
    setBusy('live');
    setError(null);
    const err = await props.takeStudio();
    if (err) {
      setBusy(null);
      return setError(err);
    }
    await act('live', () => actions.goLive(props.tabId));
    props.onChanged();
  }

  async function stop() {
    setBusy('stop');
    setError(null);
    const err = await props.takeStudio();
    if (err) {
      setBusy(null);
      return setError(err);
    }
    const r = await act('stop', () => actions.stop(props.tabId));
    if (r?.ok) props.releaseStudio();
    props.onChanged();
  }

  async function save() {
    if (!form) return;
    const r = await act('save', () => actions.saveDestination(form));
    if (r?.ok) setForm(null);
  }

  const preset = PRESETS.find((p) => p.id === form?.preset) ?? PRESETS[0];

  if (view && !relay?.connected) {
    return <p className="vs-faint">The stream relay is not reachable right now.</p>;
  }

  return (
    <div className="vs-relay">
      <div className="vs-relay__list" role="group" aria-label="Destinations">
        {destinations.length === 0 && view && <p className="vs-faint">No destinations yet. Add YouTube, Facebook, Twitch, Kick or any RTMP server.</p>}
        {destinations.map((d: RelayDestinationView) => {
          const o = outputs.get(d.id);
          return (
            <div key={d.id} className="vs-relay__dest">
              <label>
                <input
                  type="checkbox"
                  checked={d.enabled}
                  disabled={props.live || busy !== null}
                  onChange={(e) => void act('tick', () => actions.setEnabled(d.id, e.target.checked))}
                />
                <span className="vs-relay__name">{d.label}</span>
              </label>
              {d.chatChannel && <span className="vs-faint vs-relay__hint" title="Chat collected from this channel">chat {chatName(d)}</span>}
              {o ? (
                <span className={`vs-relay__state is-${o.state}`} title={o.lastError ?? undefined}>{outputText(o)}</span>
              ) : (
                <span className="vs-faint vs-relay__hint">…{d.keyHint}</span>
              )}
              {!props.live && (
                <span className="vs-relay__tools">
                  <button type="button" className="vs-link" onClick={() => setForm({ id: d.id, label: d.label, preset: d.preset, server: d.server, key: '', enabled: d.enabled, chatChannel: d.chatChannel ?? '' })}>Edit</button>
                  <button
                    type="button"
                    className="vs-link"
                    onClick={() => window.confirm(`Remove ${d.label}?`) && void act('remove', () => actions.removeDestination(d.id))}
                  >
                    Remove
                  </button>
                </span>
              )}
              {o?.lastError && o.state !== 'live' && <small className="studio-err vs-relay__err">{o.lastError}</small>}
            </div>
          );
        })}
      </div>

      {!props.live && !form && (
        <button type="button" className="vs-link" onClick={() => setForm({ ...EMPTY })}>+ Add destination</button>
      )}

      {form && (
        <div className="vs-relay__form">
          <label className="vs-live__field">
            <span>Platform</span>
            <select
              value={form.preset}
              onChange={(e) => {
                const next = e.target.value as RelayPreset;
                // A fixed preset's server is not this platform's address; a chat channel names one platform's channel.
                setForm({ ...form, preset: next, server: preset.server ? form.server : '', chatChannel: '' });
              }}
            >
              {PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </label>
          <label className="vs-live__field">
            <span>Name</span>
            <input value={form.label} placeholder={preset.id === 'custom' ? 'e.g. Vimeo' : preset.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
          </label>
          {preset.server && (
            <label className="vs-live__field">
              <span>Server</span>
              <input value={form.server ?? ''} placeholder={preset.serverHint} onChange={(e) => setForm({ ...form, server: e.target.value })} />
            </label>
          )}
          {preset.chat && (
            <label className="vs-live__field">
              <span>Chat channel</span>
              <input value={form.chatChannel ?? ''} placeholder="Channel name, e.g. elkdonisarts" onChange={(e) => setForm({ ...form, chatChannel: e.target.value })} />
              <small className="vs-faint">Optional. Its chat appears under Chat here while the destination is ticked.</small>
            </label>
          )}
          {preset.chatFrom && (
            <label className="vs-live__field">
              <span>Chat from</span>
              <select value={form.chatChannel ?? ''} onChange={(e) => setForm({ ...form, chatChannel: e.target.value })}>
                <option value="">No chat</option>
                {sources.map((s) => <option key={s.channelId} value={s.channelId}>{s.name}</option>)}
                {form.chatChannel && !sources.some((s) => s.channelId === form.chatChannel) && (
                  <option value={form.chatChannel}>Channel connected by another admin</option>
                )}
              </select>
              <small className="vs-faint">
                {sources.length
                  ? 'Read through your YouTube connection while this destination is live.'
                  : 'Connect YouTube under Center → View profile → Connections to show its chat here.'}
              </small>
            </label>
          )}
          <label className="vs-live__field">
            <span>Stream key</span>
            <input
              type="password"
              value={form.key ?? ''}
              autoComplete="off"
              placeholder={form.id ? 'Leave blank to keep the saved key' : ''}
              onChange={(e) => setForm({ ...form, key: e.target.value })}
            />
            <small className="vs-faint">{preset.hint}. Stored encrypted; only the relay sees it, at Go live.</small>
          </label>
          <div className="vs-relay__row">
            <button type="button" className="studio-btn studio-btn--primary" disabled={busy !== null || (!form.id && !form.key?.trim())} onClick={() => void save()}>
              {busy === 'save' ? 'Saving…' : 'Save'}
            </button>
            <button type="button" className="studio-btn" onClick={() => setForm(null)}>Cancel</button>
          </div>
        </div>
      )}

      {!props.live ? (
        <button
          type="button"
          className="studio-btn studio-btn--primary"
          disabled={!props.obsConnected || ticked.length === 0 || busy !== null || form !== null}
          onClick={() => void goLive()}
        >
          {busy === 'live' ? 'Starting…' : ticked.length > 1 ? `Go live to ${ticked.length} destinations` : 'Go live'}
        </button>
      ) : (
        <button type="button" className="studio-btn studio-btn--danger" disabled={busy !== null} onClick={() => void stop()}>
          {busy === 'stop' ? 'Stopping…' : 'Stop streaming'}
        </button>
      )}
      {props.live && relay?.program && !relay.program.ready && <p className="vs-faint">OBS is live but the relay is not receiving it yet.</p>}

      {actions.chat && destinations.some((d) => d.chatChannel) && (
        <details className="vs-relay__more" open>
          <summary>Chat</summary>
          <RelayChat chat={actions.chat} />
        </details>
      )}

      <details className="vs-relay__more">
        <summary>Feeds in{feeds.length ? ` (${feeds.length})` : ''}</summary>
        <RelayFeeds
          actions={actions}
          feeds={feeds}
          tabId={props.tabId}
          takeStudio={props.takeStudio}
          afterScene={() => { if (!props.live) props.releaseStudio(); }}
          disabled={!props.obsConnected}
          onChanged={() => void refresh()}
        />
      </details>

      {(view?.history.length ?? 0) > 0 && (
        <details className="vs-relay__more">
          <summary>Recent</summary>
          <ul className="vs-relay__history">
            {view!.history.map((h, i) => (
              <li key={i}>
                <span className="vs-faint">{new Date(h.at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>{' '}
                {h.userName ?? 'Someone'} {EVENT_TEXT[h.event] ?? h.event}
                {typeof h.detail.label === 'string' ? ` · ${h.detail.label}` : ''}
              </li>
            ))}
          </ul>
        </details>
      )}

      {view?.error && <p className="vs-faint">{view.error}</p>}
      {error && <p className="studio-err">{error}</p>}
    </div>
  );
}
