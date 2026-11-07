'use client';

// The console's scene editor: switch scenes (with a transition, or preview
// and Take in studio mode), make and rename scenes, add sources with buttons
// (web page, Talk room, media from your files, image, stream, text, colour,
// an existing source), lay them out with presets, show/hide, reorder, edit
// and remove them, and mix the audio. Everything goes through the OBS
// agent's "Studio" commands (docker/obs/agent.mjs); the OBS desktop stays
// for fine work (filters, free positioning).

import * as React from 'react';
import type { BroadcastAudioInput, BroadcastMediaEntry, BroadcastResult, BroadcastStudio, BroadcastStudioCommand, BroadcastStudioItem } from './types';

export interface SceneEditorProps {
  load(): Promise<BroadcastStudio | null>;
  command(cmd: BroadcastStudioCommand): Promise<BroadcastResult<BroadcastStudio>>;
  settings(name: string): Promise<Record<string, unknown> | null>;
  browse(path: string): Promise<BroadcastResult<BroadcastMediaEntry[]>>;
  /** URL of the meters' event stream (a fresh door token each call), or null without the door. */
  levelsUrl?(): Promise<string | null>;
  /** After any change, so the host can refresh its own status. */
  onChange?(): void;
  disabled?: boolean;
}

const KIND_LABEL: Record<string, string> = {
  browser_source: 'Web page',
  ffmpeg_source: 'Media',
  image_source: 'Image',
  text_ft2_source_v2: 'Text',
  color_source_v3: 'Colour',
  pulse_output_capture: 'Desktop audio',
  pulse_input_capture: 'Audio input',
  scene: 'Scene',
  group: 'Group',
};
const LAYOUT_LABEL: Record<string, string> = {
  fill: 'Full frame',
  left: 'Left half',
  right: 'Right half',
  center: 'Centre',
  'pip-br': 'Corner, bottom right',
  'pip-bl': 'Corner, bottom left',
  'pip-tr': 'Corner, top right',
  'pip-tl': 'Corner, top left',
  lower: 'Lower band',
  audio: 'Sound only (out of frame)',
};

type AddKind = 'web' | 'talk' | 'media' | 'image' | 'stream' | 'text' | 'colour' | 'existing';
const ADD_BUTTONS: { kind: AddKind; label: string; hint: string }[] = [
  { kind: 'web', label: 'Web page', hint: 'Any page: slides, a map, a guest’s site' },
  { kind: 'talk', label: 'Talk room', hint: 'A Nextcloud Talk call; join it once with Interact in the desktop' },
  { kind: 'media', label: 'Video or sound', hint: 'A file from your folders' },
  { kind: 'image', label: 'Image', hint: 'A picture from your folders' },
  { kind: 'stream', label: 'Stream address', hint: 'An internet radio, an RTMP/SRT feed' },
  { kind: 'text', label: 'Text', hint: 'A line of text' },
  { kind: 'colour', label: 'Colour', hint: 'A plain background' },
  { kind: 'existing', label: 'Existing source', hint: 'Reuse a source from another scene' },
];

const fmtDb = (db: number) => (db <= -60 ? '−∞' : `${db > 0 ? '+' : ''}${db.toFixed(1)} dB`);

function MediaPicker({
  accept,
  browse,
  onPick,
  onCancel,
}: {
  accept: 'av' | 'image';
  browse: SceneEditorProps['browse'];
  onPick(entry: BroadcastMediaEntry): void;
  onCancel(): void;
}) {
  const [path, setPath] = React.useState('');
  const [entries, setEntries] = React.useState<BroadcastMediaEntry[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    let gone = false;
    setEntries(null);
    void browse(path).then((r) => {
      if (gone) return;
      if (r.ok === false) setError(r.error);
      else setEntries(r.value);
    });
    return () => {
      gone = true;
    };
  }, [browse, path]);
  const crumbs = path ? path.split('/') : [];
  const wanted = (e: BroadcastMediaEntry) => e.isFolder || (accept === 'image' ? e.kind === 'image' : e.kind === 'video' || e.kind === 'audio');
  return (
    <div className="se-picker">
      <div className="se-crumbs">
        <button type="button" className="vs-link" onClick={() => setPath('')}>
          My files
        </button>
        {crumbs.map((c, i) => (
          <React.Fragment key={i}>
            {' / '}
            <button type="button" className="vs-link" onClick={() => setPath(crumbs.slice(0, i + 1).join('/'))}>
              {c}
            </button>
          </React.Fragment>
        ))}
        <button type="button" className="vs-link se-picker-close" onClick={onCancel}>
          Close
        </button>
      </div>
      {error && <p className="studio-err">{error}</p>}
      {!entries && !error && <p className="vs-faint">Loading…</p>}
      {entries && (
        <ul className="se-files">
          {entries.filter(wanted).map((e) => (
            <li key={e.path}>
              <button type="button" className="vs-link" onClick={() => (e.isFolder ? setPath(e.path) : onPick(e))}>
                {e.isFolder ? `${e.name}/` : e.name}
              </button>
              {!e.isFolder && <small className="vs-faint">{e.kind} · {(e.size / 1e6).toFixed(1)} MB</small>}
            </li>
          ))}
          {entries.filter(wanted).length === 0 && <li className="vs-faint">Nothing to pick here.</li>}
        </ul>
      )}
    </div>
  );
}

function AddForm({
  kind,
  studio,
  scene,
  browse,
  run,
  onDone,
}: {
  kind: AddKind;
  studio: BroadcastStudio;
  scene: string;
  browse: SceneEditorProps['browse'];
  run(cmd: BroadcastStudioCommand): Promise<boolean>;
  onDone(): void;
}) {
  const [name, setName] = React.useState('');
  const [url, setUrl] = React.useState('');
  const [text, setText] = React.useState('');
  const [size, setSize] = React.useState(72);
  const [color, setColor] = React.useState(kind === 'text' ? '#ffffff' : '#141110');
  const [loop, setLoop] = React.useState(false);
  const [file, setFile] = React.useState<BroadcastMediaEntry | null>(null);
  const [picking, setPicking] = React.useState(kind === 'media' || kind === 'image');
  const [layout, setLayout] = React.useState(kind === 'talk' ? 'fill' : kind === 'text' ? '' : 'fill');
  const [existing, setExisting] = React.useState('');
  const here = new Set(studio.scenes.find((s) => s.name === scene)?.items.map((i) => i.source) ?? []);
  const others = [...new Set(studio.scenes.flatMap((s) => s.items.map((i) => i.source)))].filter((n) => !here.has(n)).sort();

  const ready =
    (kind === 'web' || kind === 'talk' || kind === 'stream') ? url.trim().length > 0
      : kind === 'media' || kind === 'image' ? !!file
        : kind === 'text' ? text.trim().length > 0
          : kind === 'existing' ? !!existing
            : true;

  async function add() {
    const cmd: BroadcastStudioCommand = { op: 'source.add', scene, kind, name: name.trim() || undefined, layout: layout || undefined };
    if (kind === 'web' || kind === 'talk' || kind === 'stream') cmd.url = url.trim();
    if (kind === 'media' || kind === 'image') cmd.path = file!.path;
    if (kind === 'media') cmd.loop = loop;
    if (kind === 'text') Object.assign(cmd, { text, size, color });
    if (kind === 'colour') cmd.color = color;
    if (kind === 'existing') cmd.source = existing;
    if (await run(cmd)) onDone();
  }

  return (
    <div className="se-add-form">
      {(kind === 'web' || kind === 'talk' || kind === 'stream') && (
        <label className="vs-field">
          {kind === 'talk' ? 'Talk room link' : kind === 'stream' ? 'Stream address' : 'Address'}
          <input
            value={url}
            placeholder={kind === 'talk' ? 'https://cloud.elkdonis-arts.org/call/…' : kind === 'stream' ? 'https://… or rtmp://…' : 'https://'}
            onChange={(e) => setUrl(e.target.value)}
          />
        </label>
      )}
      {(kind === 'media' || kind === 'image') &&
        (picking ? (
          <MediaPicker
            accept={kind === 'image' ? 'image' : 'av'}
            browse={browse}
            onPick={(e) => {
              setFile(e);
              setPicking(false);
              if (!name) setName(e.name.replace(/\.[^.]+$/, ''));
              if (e.kind === 'audio') setLayout('audio');
            }}
            onCancel={() => (file ? setPicking(false) : onDone())}
          />
        ) : (
          <p className="se-picked">
            <b>{file?.name}</b>{' '}
            <button type="button" className="vs-link" onClick={() => setPicking(true)}>
              Choose another
            </button>
          </p>
        ))}
      {kind === 'media' && !picking && (
        <label className="vs-check">
          <input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} />
          Loop
        </label>
      )}
      {kind === 'text' && (
        <>
          <label className="vs-field">
            Text
            <input value={text} maxLength={500} onChange={(e) => setText(e.target.value)} />
          </label>
          <div className="vs-row">
            <label className="vs-field se-grow">
              Size
              <input type="number" min={12} max={300} value={size} onChange={(e) => setSize(Number(e.target.value) || 72)} />
            </label>
            <label className="vs-field se-color">
              Colour
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
            </label>
          </div>
        </>
      )}
      {kind === 'colour' && (
        <label className="vs-field se-color">
          Colour
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
        </label>
      )}
      {kind === 'existing' && (
        <label className="vs-field">
          Source
          <select value={existing} onChange={(e) => setExisting(e.target.value)}>
            <option value="">Choose…</option>
            {others.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      )}
      {kind !== 'existing' && (
        <label className="vs-field">
          Name (optional)
          <input value={name} maxLength={70} onChange={(e) => setName(e.target.value)} />
        </label>
      )}
      {kind !== 'colour' && (
        <label className="vs-field">
          Place
          <select value={layout} onChange={(e) => setLayout(e.target.value)}>
            {kind === 'text' && <option value="">At its own size, lower left</option>}
            {studio.layouts.map((l) => (
              <option key={l} value={l}>
                {LAYOUT_LABEL[l] ?? l}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="vs-row">
        <button type="button" className="studio-btn studio-btn--primary" disabled={!ready} onClick={() => void add()}>
          Add to {scene}
        </button>
        <button type="button" className="vs-link" onClick={onDone}>
          Cancel
        </button>
      </div>
      {(kind === 'media' || kind === 'image') && <p className="vs-faint">The file is copied to the OBS server once; big videos take a moment.</p>}
    </div>
  );
}

function SourceRow({
  item,
  scene,
  studio,
  index,
  count,
  run,
  settings,
  browse,
  off,
}: {
  item: BroadcastStudioItem;
  scene: string;
  studio: BroadcastStudio;
  index: number;
  count: number;
  run(cmd: BroadcastStudioCommand): Promise<boolean>;
  settings: SceneEditorProps['settings'];
  browse: SceneEditorProps['browse'];
  off: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [s, setS] = React.useState<Record<string, unknown> | null>(null);
  const [rename, setRename] = React.useState(item.source);
  const [picking, setPicking] = React.useState(false);
  React.useEffect(() => {
    if (open) void settings(item.source).then(setS);
  }, [open, item.source, settings]);
  const kind = KIND_LABEL[item.kind] ?? item.kind;
  const set = (k: string, v: unknown) => setS((cur) => ({ ...(cur ?? {}), [k]: v }));
  const save = async (patch: Record<string, unknown>) => {
    await run({ op: 'source.update', name: item.source, settings: patch });
    setS(await settings(item.source));
  };

  return (
    <li className="se-src" data-enabled={item.enabled ? 'true' : 'false'}>
      <div className="se-src-row">
        <label className="se-eye" title={item.enabled ? 'Shown: click to hide' : 'Hidden: click to show'}>
          <input
            type="checkbox"
            checked={item.enabled}
            disabled={off}
            onChange={(e) => void run({ op: 'source.toggle', scene, id: item.id, enabled: e.target.checked })}
          />
        </label>
        <button type="button" className="se-src-name" onClick={() => setOpen(!open)} aria-expanded={open}>
          {item.source}
          <small>{kind}</small>
        </button>
        <select
          className="se-layout"
          value=""
          disabled={off}
          title="Place in the frame"
          onChange={(e) => e.target.value && void run({ op: 'source.layout', scene, id: item.id, preset: e.target.value })}
        >
          <option value="">Place…</option>
          {studio.layouts.map((l) => (
            <option key={l} value={l}>
              {LAYOUT_LABEL[l] ?? l}
            </option>
          ))}
        </select>
        <button type="button" className="vs-link" title="Bring forward" disabled={off || index === 0} onClick={() => void run({ op: 'source.move', scene, id: item.id, delta: 1 })}>
          ↑
        </button>
        <button type="button" className="vs-link" title="Send back" disabled={off || index === count - 1} onClick={() => void run({ op: 'source.move', scene, id: item.id, delta: -1 })}>
          ↓
        </button>
        <button
          type="button"
          className="vs-link"
          title="Remove from this scene"
          disabled={off}
          onClick={() => {
            if (window.confirm(`Remove “${item.source}” from ${scene}?`)) void run({ op: 'source.remove', scene, id: item.id });
          }}
        >
          ×
        </button>
      </div>
      {open && (
        <div className="se-src-edit">
          {!s && <p className="vs-faint">Loading…</p>}
          {s?.kind === 'browser_source' && (
            <>
              <label className="vs-field">
                Address
                <input value={String(s.url ?? '')} onChange={(e) => set('url', e.target.value)} />
              </label>
              <label className="vs-check">
                <input type="checkbox" checked={!!s.audio} onChange={(e) => void save({ audio: e.target.checked })} />
                Its sound goes to the mixer
              </label>
              <button type="button" className="studio-btn" disabled={off} onClick={() => void save({ url: s.url })}>
                Load address
              </button>
            </>
          )}
          {s?.kind === 'ffmpeg_source' && (
            <>
              <p className="vs-faint">{s.local ? `File: ${String(s.file)}` : `Stream: ${String(s.url)}`}</p>
              <div className="vs-row">
                <button type="button" className="studio-btn" disabled={off} onClick={() => void run({ op: 'media.action', name: item.source, action: 'restart' })}>
                  From the start
                </button>
                <button type="button" className="studio-btn" disabled={off} onClick={() => void run({ op: 'media.action', name: item.source, action: 'play' })}>
                  Play
                </button>
                <button type="button" className="studio-btn" disabled={off} onClick={() => void run({ op: 'media.action', name: item.source, action: 'pause' })}>
                  Pause
                </button>
              </div>
              {s.local ? (
                <label className="vs-check">
                  <input type="checkbox" checked={!!s.loop} onChange={(e) => void save({ loop: e.target.checked })} />
                  Loop
                </label>
              ) : null}
              {picking ? (
                <MediaPicker
                  accept="av"
                  browse={browse}
                  onPick={(e) => {
                    setPicking(false);
                    void save({ path: e.path });
                  }}
                  onCancel={() => setPicking(false)}
                />
              ) : (
                <button type="button" className="vs-link" onClick={() => setPicking(true)}>
                  Use another file
                </button>
              )}
            </>
          )}
          {s?.kind === 'image_source' &&
            (picking ? (
              <MediaPicker
                accept="image"
                browse={browse}
                onPick={(e) => {
                  setPicking(false);
                  void save({ path: e.path });
                }}
                onCancel={() => setPicking(false)}
              />
            ) : (
              <p className="vs-faint">
                {String(s.file)}{' '}
                <button type="button" className="vs-link" onClick={() => setPicking(true)}>
                  Use another image
                </button>
              </p>
            ))}
          {s?.kind === 'text_ft2_source_v2' && (
            <>
              <label className="vs-field">
                Text
                <input value={String(s.text ?? '')} maxLength={500} onChange={(e) => set('text', e.target.value)} />
              </label>
              <div className="vs-row">
                <label className="vs-field se-grow">
                  Size
                  <input type="number" min={12} max={300} value={Number(s.size ?? 72)} onChange={(e) => set('size', Number(e.target.value))} />
                </label>
                <label className="vs-field se-color">
                  Colour
                  <input type="color" value={String(s.color ?? '#ffffff')} onChange={(e) => set('color', e.target.value)} />
                </label>
              </div>
              <button type="button" className="studio-btn" disabled={off} onClick={() => void save({ text: s.text, size: s.size, color: s.color })}>
                Update text
              </button>
            </>
          )}
          {s?.kind === 'color_source_v3' && (
            <label className="vs-field se-color">
              Colour
              <input type="color" value={String(s.color ?? '#000000')} disabled={off} onChange={(e) => void save({ color: e.target.value })} />
            </label>
          )}
          {s && !['browser_source', 'ffmpeg_source', 'image_source', 'text_ft2_source_v2', 'color_source_v3'].includes(String(s.kind)) && (
            <p className="vs-faint">This kind of source is edited in the desktop.</p>
          )}
          {!item.builtIn && (
            <div className="vs-row se-rename">
              <input value={rename} maxLength={70} onChange={(e) => setRename(e.target.value)} aria-label="Source name" />
              <button
                type="button"
                className="studio-btn"
                disabled={off || !rename.trim() || rename === item.source}
                onClick={() => void run({ op: 'source.rename', name: item.source, to: rename.trim() })}
              >
                Rename
              </button>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function Fader({ input, run, level, off }: { input: BroadcastAudioInput; run(cmd: BroadcastStudioCommand): Promise<boolean>; level?: number; off: boolean }) {
  const [db, setDb] = React.useState(input.volumeDb);
  const dragging = React.useRef(false);
  React.useEffect(() => {
    if (!dragging.current) setDb(input.volumeDb);
  }, [input.volumeDb]);
  const timer = React.useRef<number | undefined>(undefined);
  const commit = (v: number) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      dragging.current = false;
      void run({ op: 'audio.volume', name: input.name, db: v <= -60 ? -100 : v });
    }, 150);
  };
  const peakDb = level && level > 0 ? 20 * Math.log10(level) : -60;
  return (
    <li className="se-ch" data-muted={input.muted ? 'true' : 'false'}>
      <div className="se-ch-head">
        <b>{input.name}</b>
        <small>{fmtDb(db)}</small>
      </div>
      <span className="se-meter" aria-hidden="true">
        <span style={{ width: `${Math.max(0, Math.min(100, ((peakDb + 60) / 60) * 100))}%` }} data-hot={peakDb > -3 ? 'true' : 'false'} />
      </span>
      <div className="se-ch-row">
        <input
          type="range"
          min={-60}
          max={10}
          step={0.5}
          value={Math.max(-60, db)}
          disabled={off}
          aria-label={`${input.name} volume`}
          onChange={(e) => {
            dragging.current = true;
            const v = Number(e.target.value);
            setDb(v);
            commit(v);
          }}
        />
        <button
          type="button"
          className={input.muted ? 'studio-btn se-mute is-on' : 'studio-btn se-mute'}
          disabled={off}
          aria-pressed={input.muted}
          onClick={() => void run({ op: 'audio.mute', name: input.name, muted: !input.muted })}
        >
          {input.muted ? 'Muted' : 'Mute'}
        </button>
        <button
          type="button"
          className={input.monitor ? 'studio-btn is-on' : 'studio-btn'}
          disabled={off}
          aria-pressed={input.monitor}
          title="Heard in the booth (Listen)"
          onClick={() => void run({ op: 'audio.monitor', name: input.name, on: !input.monitor })}
        >
          🎧
        </button>
      </div>
    </li>
  );
}

/** The mixer's meters from the door's event stream; empty without the door. */
function useLevels(levelsUrl?: () => Promise<string | null>) {
  const [levels, setLevels] = React.useState<Record<string, number>>({});
  React.useEffect(() => {
    if (!levelsUrl) return;
    let es: EventSource | null = null;
    let gone = false;
    let retry: number | undefined;
    const open = async () => {
      const url = await levelsUrl();
      if (gone || !url) return;
      es = new EventSource(url);
      es.onmessage = (e) => setLevels(JSON.parse(e.data) as Record<string, number>);
      es.onerror = () => {
        es?.close();
        if (!gone) retry = window.setTimeout(() => void open(), 5000);
      };
    };
    void open();
    return () => {
      gone = true;
      window.clearTimeout(retry);
      es?.close();
    };
  }, [levelsUrl]);
  return levels;
}

export function SceneEditor({ load, command, settings, browse, levelsUrl, onChange, disabled }: SceneEditorProps) {
  const [studio, setStudio] = React.useState<BroadcastStudio | null>(null);
  const [selected, setSelected] = React.useState<string | null>(null);
  const [adding, setAdding] = React.useState<AddKind | null>(null);
  const [newScene, setNewScene] = React.useState<string | null>(null);
  const [renaming, setRenaming] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const levels = useLevels(levelsUrl);

  const refresh = React.useCallback(async () => {
    const s = await load();
    if (s) setStudio(s);
  }, [load]);
  React.useEffect(() => {
    void refresh();
    const t = window.setInterval(() => void refresh(), 3000);
    return () => window.clearInterval(t);
  }, [refresh]);

  const run = React.useCallback(
    async (cmd: BroadcastStudioCommand) => {
      setBusy(true);
      setError(null);
      const r = await command(cmd);
      setBusy(false);
      if (r.ok === false) {
        setError(r.error);
        return false;
      }
      setStudio(r.value);
      onChange?.();
      return true;
    },
    [command, onChange]
  );

  if (!studio) return <p className="vs-faint">{disabled ? 'Waiting for OBS…' : 'Loading scenes…'}</p>;
  const off = !!disabled || busy;
  const sceneName = selected && studio.scenes.some((s) => s.name === selected) ? selected : studio.program;
  const scene = studio.scenes.find((s) => s.name === sceneName);

  return (
    <div className="se">
      <div className="se-bar">
        <label className="vs-field se-inline">
          Transition
          <select value={studio.transition} disabled={off} onChange={(e) => void run({ op: 'transition', name: e.target.value })}>
            {studio.transitions.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        {studio.transitionMs !== null && (
          <label className="vs-field se-inline se-ms">
            ms
            <input
              type="number"
              min={50}
              max={5000}
              step={50}
              defaultValue={studio.transitionMs}
              key={studio.transitionMs}
              disabled={off}
              onBlur={(e) => Number(e.target.value) !== studio.transitionMs && void run({ op: 'transition', ms: Number(e.target.value) })}
            />
          </label>
        )}
        <label className="vs-check se-inline" title="Pick the next scene in preview, then Take it to air">
          <input type="checkbox" checked={studio.studioMode} disabled={off} onChange={(e) => void run({ op: 'studio.mode', on: e.target.checked })} />
          Preview, then take
        </label>
        {studio.studioMode && (
          <button type="button" className="studio-btn studio-btn--primary se-take" disabled={off || !studio.preview} onClick={() => void run({ op: 'scene.take' })}>
            Take {studio.preview ? `“${studio.preview}”` : ''}
          </button>
        )}
      </div>

      <ul className="se-scenes">
        {studio.scenes.map((s) => {
          const live = s.name === studio.program;
          const prev = s.name === studio.preview;
          return (
            <li key={s.name} className="se-scene" data-live={live ? 'true' : 'false'} data-preview={prev ? 'true' : 'false'} data-selected={s.name === sceneName ? 'true' : 'false'}>
              {renaming === s.name ? (
                <form
                  className="se-rename"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const to = String(new FormData(e.currentTarget).get('to') ?? '').trim();
                    if (to && to !== s.name) void run({ op: 'scene.rename', name: s.name, to }).then((ok) => ok && setSelected(to));
                    setRenaming(null);
                  }}
                >
                  <input name="to" defaultValue={s.name} maxLength={70} autoFocus aria-label="Scene name" />
                  <button type="submit" className="vs-link">
                    Save
                  </button>
                </form>
              ) : (
                <button type="button" className="se-scene-name" onClick={() => setSelected(s.name)} title="Edit this scene’s sources">
                  {s.name}
                  {live && <b className="se-badge se-badge--live">On air</b>}
                  {prev && <b className="se-badge">Preview</b>}
                </button>
              )}
              <button
                type="button"
                className={live ? 'studio-btn se-go is-live' : 'studio-btn se-go'}
                disabled={off || (live && !studio.studioMode)}
                onClick={() => void run({ op: 'scene.switch', name: s.name })}
              >
                {studio.studioMode ? 'Preview' : live ? 'On air' : 'Switch'}
              </button>
            </li>
          );
        })}
        <li className="se-scene se-scene--new">
          {newScene === null ? (
            <button type="button" className="se-scene-name" disabled={off} onClick={() => setNewScene('')}>
              + New scene
            </button>
          ) : (
            <form
              className="se-rename"
              onSubmit={(e) => {
                e.preventDefault();
                const name = newScene.trim();
                if (name) void run({ op: 'scene.create', name }).then((ok) => ok && setSelected(name));
                setNewScene(null);
              }}
            >
              <input value={newScene} maxLength={70} autoFocus placeholder="Scene name" onChange={(e) => setNewScene(e.target.value)} />
              <button type="submit" className="vs-link">
                Make
              </button>
            </form>
          )}
        </li>
      </ul>

      {error && (
        <div className="vs-error" role="alert">
          {error} <button type="button" onClick={() => setError(null)}>×</button>
        </div>
      )}

      {scene && (
        <section className="se-editor">
          <div className="se-editor-head">
            <h3>Sources in “{scene.name}”</h3>
            <span className="studio-spacer" />
            <button type="button" className="vs-link" disabled={off} onClick={() => setRenaming(scene.name)}>
              Rename scene
            </button>
            <button
              type="button"
              className="vs-link"
              disabled={off || scene.name === studio.program}
              title={scene.name === studio.program ? 'Switch away from it first' : undefined}
              onClick={() => {
                if (window.confirm(`Delete the scene “${scene.name}”? Sources used only here go too.`)) void run({ op: 'scene.remove', name: scene.name });
              }}
            >
              Delete scene
            </button>
          </div>
          <ul className="se-srcs">
            {scene.items.map((it, i) => (
              <SourceRow
                key={`${it.id}:${it.source}`}
                item={it}
                scene={scene.name}
                studio={studio}
                index={i}
                count={scene.items.length}
                run={run}
                settings={settings}
                browse={browse}
                off={off}
              />
            ))}
            {scene.items.length === 0 && <li className="vs-faint">Empty scene.</li>}
          </ul>
          <div className="se-add">
            {ADD_BUTTONS.map((b) => (
              <button
                key={b.kind}
                type="button"
                className={adding === b.kind ? 'studio-btn is-on' : 'studio-btn'}
                title={b.hint}
                disabled={off}
                onClick={() => setAdding(adding === b.kind ? null : b.kind)}
              >
                + {b.label}
              </button>
            ))}
          </div>
          {adding && <AddForm key={`${adding}:${scene.name}`} kind={adding} studio={studio} scene={scene.name} browse={browse} run={run} onDone={() => setAdding(null)} />}
        </section>
      )}

      <section className="se-mixer">
        <h3>Audio</h3>
        <ul>
          {studio.audio.map((a) => (
            <Fader key={a.name} input={a} run={run} level={levels[a.name]} off={off} />
          ))}
          {studio.audio.length === 0 && <li className="vs-faint">No sound sources.</li>}
        </ul>
        {!levelsUrl && <p className="vs-faint">Meters need the booth’s door (/obs/ on this host).</p>}
      </section>
    </div>
  );
}
