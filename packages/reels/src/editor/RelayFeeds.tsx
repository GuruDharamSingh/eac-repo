'use client';

// Feeds in on the stream relay (docker/relay): Zoom's custom live streaming,
// a phone app or another OBS publishes to `ingestUrl` with a feed's key, and
// "Add to OBS" makes it a scene. Used in the Go live card (RelayPanel) and,
// through the console's and desk's `extra` slot, on /studio/broadcast; there
// the page already holds the studio's lease and the tab id comes from
// BroadcastTabContext.

import * as React from 'react';
import { useBroadcastTab } from '../broadcast/tab-context';
import type { RelayActions, RelayFeedView, RelayResult } from './relay-types';

export interface RelayFeedsProps {
  actions: Pick<RelayActions, 'view' | 'addFeed' | 'removeFeed' | 'feedToScene' | 'ingestUrl' | 'guestCameraPath'>;
  /** Feeds from a parent that already polls the relay; without it this panel polls on its own. */
  feeds?: RelayFeedView[];
  /** The lease holder's tab id; defaults to the console's (BroadcastTabContext). */
  tabId?: string;
  /** Claim the lease before "Add to OBS" (the Go live card); resolves to an error, or null. */
  takeStudio?(): Promise<string | null>;
  /** After "Add to OBS" (the card releases the lease when it is not live). */
  afterScene?(): void;
  disabled?: boolean;
  onChanged?(): void;
}

export function RelayFeeds(props: RelayFeedsProps) {
  const { actions } = props;
  const contextTab = useBroadcastTab();
  const tabId = props.tabId ?? contextTab;
  const [own, setOwn] = React.useState<RelayFeedView[] | null>(null);
  const [connected, setConnected] = React.useState(true);
  const [label, setLabel] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [note, setNote] = React.useState<string | null>(null);

  const polls = props.feeds === undefined;
  const refresh = React.useCallback(() => {
    if (!polls) return props.onChanged?.();
    void actions.view().then((v) => {
      setOwn(v.relay.feeds ?? []);
      setConnected(v.relay.connected);
    }).catch(() => {});
  }, [actions, polls, props]);
  React.useEffect(() => {
    if (!polls) return;
    refresh();
    const t = window.setInterval(refresh, 4000);
    return () => window.clearInterval(t);
  }, [polls, refresh]);

  const feeds = props.feeds ?? own ?? [];

  async function act<T>(fn: () => Promise<RelayResult<T>>): Promise<RelayResult<T> | null> {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const r = await fn();
      // `ok`, not `'value' in r`: a server action's `value: undefined` arrives without the key.
      if (!r.ok) setError((r as { error: string }).error);
      return r;
    } catch (err) {
      setError((err as Error).message);
      return null;
    } finally {
      setBusy(false);
      refresh();
    }
  }

  async function toScene(key: string) {
    if (!tabId) return setError('Open the studio first.');
    if (props.takeStudio) {
      const err = await props.takeStudio();
      if (err) return setError(err);
    }
    const r = await act(() => actions.feedToScene(tabId, key));
    props.afterScene?.();
    if (r?.ok) setNote(`Scene "${(r as { value: { scene: string } }).value.scene}" is ready in OBS.`);
  }

  const copy = (text: string) => void navigator.clipboard?.writeText(text).then(() => setNote('Copied.'));
  // The internal address (rtmp://relay:1935/in) until RELAY_PUBLIC_INGEST_URL is set and the port opened.
  const internal = /:\/\/relay[:/]/.test(actions.ingestUrl);

  if (polls && !connected) return <p className="vs-faint">The stream relay is not reachable right now.</p>;

  return (
    <div className="vs-relay vs-relay-feeds">
      <p className="vs-faint">
        Zoom (custom live streaming), a phone app or another OBS publishes to the address below with its key; Add to OBS makes it a scene.
        {internal
          ? ' Reachable inside the server network only for now.'
          : ' In Zoom: Stream URL is this address, Stream key is the feed\'s key, Live streaming page URL can be any public page. Use one feed per event and remove it afterwards: the key travels unencrypted.'}
      </p>
      <div className="vs-relay__copy">
        <code>{actions.ingestUrl}</code>
        <button type="button" className="vs-link" onClick={() => copy(actions.ingestUrl)}>Copy</button>
      </div>
      {feeds.map((f) => (
        <div key={f.key} className="vs-relay__dest">
          <span className={`vs-live__dot ${f.ready ? 'is-ready' : ''}`} aria-label={f.ready ? 'receiving' : 'idle'} />
          <span className="vs-relay__name">{f.label}</span>
          <span className="vs-relay__tools">
            <button type="button" className="vs-link" onClick={() => copy(f.key)}>Copy key</button>
            {actions.guestCameraPath && (
              <button
                type="button"
                className="vs-link"
                title="A page where a guest joins with their camera from the browser"
                onClick={() => copy(`${window.location.origin}${actions.guestCameraPath}/${f.key}`)}
              >
                Copy camera link
              </button>
            )}
            <button type="button" className="vs-link" disabled={props.disabled || busy} onClick={() => void toScene(f.key)}>Add to OBS</button>
            <button
              type="button"
              className="vs-link"
              onClick={() => window.confirm(`Remove the feed ${f.label}? Its key stops working.`) && void act(() => actions.removeFeed(f.key))}
            >
              Remove
            </button>
          </span>
        </div>
      ))}
      <div className="vs-relay__row">
        <input className="vs-relay__input" value={label} placeholder="New feed, e.g. Zoom room" onChange={(e) => setLabel(e.target.value)} />
        <button
          type="button"
          className="studio-btn"
          disabled={!label.trim() || busy}
          onClick={() => void act(() => actions.addFeed(label)).then((r) => r?.ok && setLabel(''))}
        >
          Add
        </button>
      </div>
      {note && <p className="vs-faint">{note}</p>}
      {error && <p className="studio-err">{error}</p>}
    </div>
  );
}
