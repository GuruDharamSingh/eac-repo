'use client';

// The Sound overlay's inspector: pick an effect from the network library
// (oad/Private/Sounds, by category), your own Sounds folder, or Freesound
// (CC0 only, copied into your folder with its credit), preview it, set its
// volume. The item's `seconds` is the sound's length, read from its credit or
// from the file; the template plays it at `at` (templates/clip.tsx).

import * as React from 'react';
import type { ReelMediaRef, ReelOverlayItem } from '../types';
import type { VideoFreesoundHit, VideoResult, VideoSound } from './types';

export interface SoundLibrary {
  list(): Promise<{ network: VideoSound[]; mine: VideoSound[] }>;
  /** Upload into the person's own Sounds folder. */
  upload?(file: File): Promise<ReelMediaRef | null>;
  share?(path: string, category: string): Promise<VideoResult<{ path: string }>>;
  search?(query: string, page: number): Promise<VideoResult<{ hits: VideoFreesoundHit[]; more: boolean }>>;
  importFs?(id: number): Promise<VideoResult<VideoSound>>;
  /** Nextcloud path → playable URL. */
  url(path: string): string;
}

// One player for every preview button: starting one stops the last.
let player: HTMLAudioElement | null = null;
let playing = '';
const listeners = new Set<(p: string) => void>();
function preview(src: string, volume = 1) {
  if (typeof window === 'undefined') return;
  player ??= new Audio();
  if (playing === src && !player.paused) {
    player.pause();
    playing = '';
  } else {
    player.src = src;
    player.volume = Math.max(0, Math.min(1, volume));
    player.currentTime = 0;
    void player.play().catch(() => {});
    playing = src;
    player.onended = () => {
      playing = '';
      listeners.forEach((l) => l(''));
    };
  }
  listeners.forEach((l) => l(playing));
}
function usePlaying() {
  const [p, setP] = React.useState(playing);
  React.useEffect(() => {
    listeners.add(setP);
    return () => {
      listeners.delete(setP);
    };
  }, []);
  return p;
}

/** A file's length in seconds, from its metadata; 0 when it cannot be read. */
function measure(src: string): Promise<number> {
  return new Promise((ok) => {
    const a = new Audio();
    const t = window.setTimeout(() => ok(0), 8000);
    a.preload = 'metadata';
    a.onloadedmetadata = () => {
      window.clearTimeout(t);
      ok(Number.isFinite(a.duration) ? a.duration : 0);
    };
    a.onerror = () => {
      window.clearTimeout(t);
      ok(0);
    };
    a.src = src;
  });
}

const len = (s?: number) => (s ? `${s < 10 ? s.toFixed(1) : Math.round(s)} s` : '');

function PlayButton({ src, volume }: { src: string; volume?: number }) {
  const now = usePlaying();
  const on = now === src;
  return (
    <button type="button" className="sd-play" aria-label={on ? 'Stop' : 'Play'} aria-pressed={on} onClick={() => preview(src, volume)}>
      {on ? '■' : '▶'}
    </button>
  );
}

function Credit({ s }: { s: Pick<VideoSound, 'licence' | 'author' | 'source'> }) {
  if (!s.licence && !s.author && !s.source) return null;
  return (
    <span className="sd-credit">
      {[s.licence, s.author && `by ${s.author}`].filter(Boolean).join(' · ')}
      {s.source && /^https:\/\//.test(s.source) && (
        <>
          {' · '}
          <a href={s.source} target="_blank" rel="noreferrer noopener">
            source
          </a>
        </>
      )}
    </span>
  );
}

export function SoundFields({ item, patch, lib }: { item: ReelOverlayItem; patch(p: Partial<ReelOverlayItem>): void; lib: SoundLibrary }) {
  const [tab, setTab] = React.useState<'network' | 'mine' | 'freesound'>('network');
  const [data, setData] = React.useState<{ network: VideoSound[]; mine: VideoSound[] } | null>(null);
  const [cat, setCat] = React.useState('');
  const [filter, setFilter] = React.useState('');
  const [err, setErr] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState('');
  // Freesound
  const [q, setQ] = React.useState('');
  const [hits, setHits] = React.useState<VideoFreesoundHit[] | null>(null);
  const [page, setPage] = React.useState(1);
  const [more, setMore] = React.useState(false);

  const load = React.useCallback(() => void lib.list().then(setData), [lib]);
  React.useEffect(load, [load]);

  const all = data ? [...data.network, ...data.mine] : [];
  const current = item.sound?.path ? all.find((s) => s.path === item.sound!.path) : undefined;

  async function use(s: Pick<VideoSound, 'path' | 'name' | 'duration'>) {
    setErr(null);
    const seconds = s.duration || (await measure(lib.url(s.path)));
    patch({ sound: { path: s.path, name: s.name }, seconds: Number(Math.max(0.3, seconds || 1).toFixed(2)), volume: item.volume ?? 1 });
  }

  const list = (tab === 'mine' ? data?.mine : data?.network) ?? [];
  const cats = [...new Set(list.map((s) => s.category))];
  const needle = filter.trim().toLowerCase();
  const shown = list.filter(
    (s) => (!cat || s.category === cat) && (!needle || `${s.name} ${s.category} ${(s.tags ?? []).join(' ')}`.toLowerCase().includes(needle))
  );

  async function search(p: number) {
    if (!lib.search || !q.trim()) return;
    setErr(null);
    setBusy('search');
    const res = await lib.search(q, p);
    setBusy('');
    if (res.ok === false) return setErr(res.error);
    setHits(p === 1 ? res.value.hits : [...(hits ?? []), ...res.value.hits]);
    setPage(p);
    setMore(res.value.more);
  }

  return (
    <div className="sd">
      <div className="sd-now">
        {item.sound?.path ? (
          <>
            <PlayButton src={lib.url(item.sound.path)} volume={item.volume ?? 1} />
            <span className="vs-file">{item.sound.name ?? item.sound.path.split('/').pop()}</span>
            <span className="vs-faint">{len(item.seconds)}</span>
            {current && <Credit s={current} />}
          </>
        ) : (
          <span className="vs-faint">No sound yet: pick one below.</span>
        )}
      </div>
      <label className="vs-field sd-vol">
        Volume ({Math.round((item.volume ?? 1) * 100)}%)
        <input type="range" min={0} max={1.5} step={0.05} value={item.volume ?? 1} onChange={(e) => patch({ volume: Number(e.target.value) })} />
      </label>

      <div className="sd-tabs" role="tablist">
        {(['network', 'mine', ...(lib.search ? ['freesound'] : [])] as Array<typeof tab>).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            className="studio-btn"
            onClick={() => {
              setTab(t);
              setCat('');
            }}
          >
            {t === 'network' ? 'Library' : t === 'mine' ? 'Mine' : 'Freesound (CC0)'}
          </button>
        ))}
      </div>

      {tab !== 'freesound' ? (
        <>
          <div className="vs-row">
            <input type="search" placeholder="Filter…" value={filter} onChange={(e) => setFilter(e.target.value)} />
            {tab === 'mine' && lib.upload && (
              <label className="studio-btn">
                {busy === 'upload' ? 'Uploading…' : 'Upload…'}
                <input
                  type="file"
                  accept="audio/*"
                  hidden
                  disabled={busy === 'upload'}
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    if (!f || !lib.upload) return;
                    setBusy('upload');
                    const ref = await lib.upload(f);
                    setBusy('');
                    if (ref) {
                      load();
                      await use({ path: ref.path, name: ref.name ?? f.name });
                    }
                  }}
                />
              </label>
            )}
          </div>
          {cats.length > 1 && (
            <div className="sd-cats">
              <button type="button" className="sd-cat" aria-pressed={!cat} onClick={() => setCat('')}>
                All
              </button>
              {cats.map((c) => (
                <button key={c} type="button" className="sd-cat" aria-pressed={cat === c} onClick={() => setCat(c)}>
                  {c}
                </button>
              ))}
            </div>
          )}
          {!data ? (
            <p className="vs-faint">Loading…</p>
          ) : shown.length === 0 ? (
            <p className="vs-faint">
              {tab === 'mine'
                ? 'No sounds of your own yet. Upload one, or add one from Freesound.'
                : list.length
                  ? 'Nothing matches.'
                  : 'The network library is empty so far.'}
            </p>
          ) : (
            <ul className="sd-list">
              {shown.slice(0, 200).map((s) => (
                <li key={s.path} aria-current={item.sound?.path === s.path}>
                  <PlayButton src={lib.url(s.path)} />
                  <button type="button" className="sd-name" title={s.tags?.join(', ')} onClick={() => void use(s)}>
                    {s.name}
                  </button>
                  <span className="vs-faint">{len(s.duration)}</span>
                  {tab === 'mine' && lib.share && !data.network.some((n) => n.path.endsWith('/' + s.path.split('/').pop())) && (
                    <button
                      type="button"
                      className="vs-link"
                      onClick={async () => {
                        const c = window.prompt('Share to the network library under which category?', s.category === 'Mine' || s.category === 'Freesound' ? 'Other' : s.category);
                        if (!c || !lib.share) return;
                        const res = await lib.share(s.path, c);
                        if (res.ok === false) setErr(res.error);
                        else load();
                      }}
                    >
                      Share
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <>
          <form
            className="vs-row"
            onSubmit={(e) => {
              e.preventDefault();
              void search(1);
            }}
          >
            <input type="search" placeholder="Search Freesound, e.g. whoosh, airhorn, rimshot" value={q} onChange={(e) => setQ(e.target.value)} />
            <button type="submit" className="studio-btn" disabled={busy === 'search' || !q.trim()}>
              {busy === 'search' ? 'Searching…' : 'Search'}
            </button>
          </form>
          <p className="vs-faint">CC0 sounds up to 12 s only. Previews play from freesound.org; Add copies one into your Sounds with its credit.</p>
          {hits && hits.length === 0 && <p className="vs-faint">No CC0 sounds found.</p>}
          {hits && hits.length > 0 && (
            <ul className="sd-list">
              {hits.map((h) => (
                <li key={h.id}>
                  <PlayButton src={h.preview} />
                  <span className="sd-name" title={h.tags.join(', ')}>
                    {h.name}
                  </span>
                  <span className="vs-faint">
                    {len(h.duration)} · {h.author}
                  </span>
                  <button
                    type="button"
                    className="vs-link"
                    disabled={busy === `fs${h.id}`}
                    onClick={async () => {
                      if (!lib.importFs) return;
                      setErr(null);
                      setBusy(`fs${h.id}`);
                      const res = await lib.importFs(h.id);
                      setBusy('');
                      if (res.ok === false) return setErr(res.error);
                      load();
                      await use(res.value);
                    }}
                  >
                    {busy === `fs${h.id}` ? 'Adding…' : 'Add'}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {more && (
            <button type="button" className="studio-btn" disabled={busy === 'search'} onClick={() => void search(page + 1)}>
              More
            </button>
          )}
        </>
      )}
      {err && <p className="studio-err">{err}</p>}
    </div>
  );
}
