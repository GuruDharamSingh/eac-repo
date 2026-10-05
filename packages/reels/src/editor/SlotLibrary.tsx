'use client';

// "From my files" for one slot: the person's finished reels (video slots)
// and a browser over their own storage, filtered to the slot's kind. Picks
// return a Nextcloud path; nothing is copied, the edit names the file where
// it is (services/reels.ts allows the person's whole storage).

import * as React from 'react';
import { MediaBrowser } from '@elkdonis/cms-ui/files';
import type { VideoFinished } from './types';

export interface LibraryPick {
  path: string;
  name: string;
  kind: 'image' | 'video';
  duration?: number;
}

/** Seconds of a video at a URL, from its metadata only. */
function urlDuration(url: string): Promise<number | undefined> {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.onloadedmetadata = () => resolve(Number.isFinite(v.duration) ? v.duration : undefined);
    v.onerror = () => resolve(undefined);
    v.src = url;
  });
}

export function SlotLibrary({
  kinds,
  endpoint,
  mediaBase,
  finished,
  onPick,
  onClose,
}: {
  kinds: Array<'image' | 'video'>;
  endpoint: string;
  mediaBase: string;
  finished: VideoFinished[] | null;
  onPick: (p: LibraryPick) => void;
  onClose: () => void;
}) {
  const [kind, setKind] = React.useState<'image' | 'video'>(kinds[0]);
  const [busy, setBusy] = React.useState(false);
  const url = (path: string) => mediaBase + path.split('/').map(encodeURIComponent).join('/');
  const toPath = (u: string) => decodeURIComponent(u.startsWith(mediaBase) ? u.slice(mediaBase.length) : u);

  async function pickUrl(item: { url: string; name: string }) {
    setBusy(true);
    const duration = kind === 'video' ? await urlDuration(item.url) : undefined;
    setBusy(false);
    // Strip the upload prefixes (`<slot>-<ms>-`, `<ms>-`) for display.
    const name = item.name.replace(/^(?:(?:logo|artwork|clip2?|extra|music)-)?\d{13}-/, '');
    onPick({ path: toPath(item.url), name, kind, duration });
  }

  return (
    <div className="vs-library">
      <div className="vs-row vs-library__bar">
        {kinds.length > 1 &&
          kinds.map((k) => (
            <button key={k} type="button" className="studio-btn" aria-pressed={kind === k} onClick={() => setKind(k)}>
              {k === 'video' ? 'Videos' : 'Pictures'}
            </button>
          ))}
        <span className="studio-spacer" />
        <button type="button" className="vs-link" onClick={onClose}>
          Close
        </button>
      </div>
      {busy && <p className="vs-faint">Reading the video…</p>}
      {kind === 'video' && finished && finished.length > 0 && (
        <>
          <h3>Your finished reels</h3>
          <ul className="vs-reels">
            {finished.map((r) => (
              <li key={r.projectId}>
                <button
                  type="button"
                  onClick={() =>
                    onPick({ path: r.outputPath, name: r.title, kind: 'video', duration: r.durationS ?? undefined })
                  }
                >
                  {r.thumbPath ? <img src={url(r.thumbPath)} alt="" loading="lazy" /> : <span className="vs-reels__blank" />}
                  <span>
                    {r.title}
                    <small>{r.durationS ? `${r.durationS.toFixed(1)} s` : ''}</small>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <h3>All your files</h3>
        </>
      )}
      <MediaBrowser
        key={kind}
        endpoint={`${endpoint}${endpoint.includes('?') ? '&' : '?'}kind=${kind}`}
        kind={kind}
        onPick={(item) => void pickUrl(item)}
        emptyText={kind === 'video' ? 'No videos in this folder.' : 'No pictures in this folder.'}
      />
    </div>
  );
}
