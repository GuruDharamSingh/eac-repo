'use client';

// The Studio's Video kind (registered by the host as a StudioExtension; see
// videoExtension in ./index.ts): pick a template, fill its slots from uploads,
// watch a live preview (Remotion's player runs the same component the
// renderer does), then queue a render. Files go to Nextcloud as they are
// picked; the edit autosaves. Rendering happens in the reel-render
// container, which writes the MP4 back into the project's Finished/ folder.

import * as React from 'react';
import { Player } from '@remotion/player';
import { REEL_TEMPLATES } from '../templates';
import { editPaths, missingForRender, type ReelClipRef, type ReelEdit, type ReelMediaRef } from '../types';
import type { VideoKindProps, VideoProject, VideoPublication, VideoRender, VideoTrack } from './types';
import { StudioColumns, StudioTopActions, StudioTopStatus, useStudioFrame } from '@elkdonis/studio/frame';
import { Recorder } from './Recorder';
import { SlotLibrary, type LibraryPick } from './SlotLibrary';
import type { VideoFinished } from './types';

const SLOT_KINDS: Record<Exclude<SlotKey, 'music'>, Array<'image' | 'video'>> = {
  logo: ['image'],
  artwork: ['image'],
  clip: ['video'],
  clip2: ['video'],
  extra: ['video', 'image'],
};

/** Longest useful recording per slot: what the template uses of it. */
const RECORD_MAX: Partial<Record<SlotKey, number>> = { clip: 15, clip2: 10, extra: 8 };

type SlotKey = 'logo' | 'artwork' | 'clip' | 'clip2' | 'extra' | 'music';

const SLOT_INFO: Array<{ key: Exclude<SlotKey, 'music'>; label: string; hint: string; accept: string; required?: boolean }> = [
  { key: 'logo', label: 'Logo', hint: 'Opens the reel for one second. PNG with a transparent background works best.', accept: 'image/*' },
  { key: 'artwork', label: 'Artwork', hint: 'The work itself, shown with a slow pan.', accept: 'image/*', required: true },
  { key: 'clip', label: 'Clip', hint: 'You talking or working. Up to 15 s is used.', accept: 'video/*', required: true },
  { key: 'clip2', label: 'Second clip', hint: 'Optional. Up to 10 s.', accept: 'video/*' },
  { key: 'extra', label: 'Something else', hint: 'Optional. A detail, another work, the studio: photo or video.', accept: 'image/*,video/*' },
];

const mediaUrl = (base: string, path: string) => base + path.split('/').map(encodeURIComponent).join('/');

/** Seconds of a local video file, read in the browser before upload. */
function readDuration(file: File): Promise<number | undefined> {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    const url = URL.createObjectURL(file);
    v.preload = 'metadata';
    v.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(v.duration) ? v.duration : undefined);
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(undefined);
    };
    v.src = url;
  });
}

/** XHR rather than fetch: phone video is large and people need to see it move. */
function upload(
  endpoint: string,
  params: Record<string, string>,
  file: File,
  onProgress: (p: number) => void
): Promise<{ path?: string; error?: string }> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${endpoint}?${new URLSearchParams(params)}`);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      try {
        resolve(JSON.parse(xhr.responseText));
      } catch {
        resolve({ error: `Upload failed (${xhr.status})` });
      }
    };
    xhr.onerror = () => resolve({ error: 'Upload failed: connection lost' });
    xhr.send(file);
  });
}

function getSlot(edit: ReelEdit, key: SlotKey): (ReelMediaRef & Partial<ReelClipRef>) | undefined {
  return key === 'logo' ? edit.brand?.logo : (edit[key] as ReelMediaRef | undefined);
}

function setSlot(edit: ReelEdit, key: SlotKey, ref: (ReelMediaRef & Record<string, unknown>) | undefined): ReelEdit {
  if (key === 'logo') return { ...edit, brand: { ...(edit.brand ?? {}), logo: ref } };
  return { ...edit, [key]: ref } as ReelEdit;
}

export function VideoKind(props: VideoKindProps) {
  // Acting org, viewer, errors and the top bar belong to the Studio frame.
  const frame = useStudioFrame();
  const { actions, uploadEndpoint, mediaBase, links } = props;
  const orgs = frame.orgs;
  const orgId = frame.orgId;
  const setError = frame.setError;
  const [projects, setProjects] = React.useState<VideoProject[]>(props.initialProjects);
  const [current, setCurrent] = React.useState<VideoProject | null>(
    props.initialProjects.find((p) => p.id === props.initialProjectId) ?? null
  );
  const [edit, setEdit] = React.useState<ReelEdit | null>(current?.edit ?? null);
  const [title, setTitle] = React.useState(current?.title ?? '');
  const [save, setSave] = React.useState<'saved' | 'dirty' | 'saving' | 'error'>('saved');
  const [busy, setBusy] = React.useState<Record<string, number>>({});
  const [music, setMusic] = React.useState<{ network: VideoTrack[]; mine: VideoTrack[] } | null>(null);
  const [renders, setRenders] = React.useState<VideoRender[]>([]);
  const [recording, setRecording] = React.useState<SlotKey | null>(null);
  const [libraryFor, setLibraryFor] = React.useState<SlotKey | null>(null);
  // Publishing: undefined = not loaded yet for this reel, null = never published.
  const [publication, setPublication] = React.useState<VideoPublication | null | undefined>(undefined);
  const [description, setDescription] = React.useState('');
  const [publishing, setPublishing] = React.useState(false);
  React.useEffect(() => {
    setPublication(undefined);
    if (current) void actions.getPublication(current.id).then(setPublication);
  }, [current?.id, actions]); // eslint-disable-line react-hooks/exhaustive-deps

  async function publish(action: 'publish' | 'unpublish') {
    if (!current) return;
    setPublishing(true);
    setError(null);
    if (action === 'publish') {
      const res = await actions.publish(current.id, description.trim());
      if (res.ok === false) setError(res.error);
      else setPublication(res.value);
    } else {
      const res = await actions.unpublish(current.id);
      if (res.ok === false) setError(res.error);
      else setPublication((p) => (p ? { ...p, status: 'draft' } : p));
    }
    setPublishing(false);
  }
  const [finished, setFinished] = React.useState<VideoFinished[] | null>(null);
  React.useEffect(() => {
    if (libraryFor && finished === null) void actions.listFinished().then(setFinished);
  }, [libraryFor, finished, actions]);

  /** A file chosen from the person's storage: the edit names it where it is. */
  function pickLibrary(key: SlotKey, p: LibraryPick) {
    if (!edit) return;
    setLibraryFor(null);
    const prev = getSlot(edit, key);
    const ref: ReelMediaRef & Record<string, unknown> = { path: p.path, name: p.name };
    if (p.kind === 'video') Object.assign(ref, { duration: p.duration, trimStart: 0, voice: prev?.voice ?? true });
    if (key === 'extra') ref.kind = p.kind;
    change(setSlot(edit, key, ref));
  }

  // Open a project: load its edit, renders and the music lists.
  const open = React.useCallback(
    (p: VideoProject | null) => {
      setCurrent(p);
      setEdit(p?.edit ?? null);
      setTitle(p?.title ?? '');
      setSave('saved');
      setError(null);
      setRenders([]);
      if (p) {
        void actions.listRenders(p.id).then(setRenders);
        const url = new URL(window.location.href);
        url.searchParams.set('id', p.id);
        window.history.replaceState(null, '', url);
      }
    },
    [actions]
  );

  React.useEffect(() => {
    if (current && !music) void actions.listMusic().then(setMusic);
  }, [current, music, actions]);

  // A reel opened by ?id= arrives in props without going through open().
  React.useEffect(() => {
    if (current) void actions.listRenders(current.id).then(setRenders);
    // Mount only: open() loads renders for every later selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autosave, 800 ms after the last change.
  const latest = React.useRef({ edit, title });
  latest.current = { edit, title };
  React.useEffect(() => {
    if (!current || save !== 'dirty') return;
    const t = window.setTimeout(async () => {
      setSave('saving');
      const res = await actions.saveProject(current.id, { title: latest.current.title, edit: latest.current.edit ?? undefined });
      if (res.ok === false) {
        setSave('error');
        setError(res.error);
      } else {
        setSave('saved');
        setProjects((ps) => ps.map((p) => (p.id === res.value.id ? res.value : p)));
      }
    }, 800);
    return () => window.clearTimeout(t);
  }, [edit, title, save, current, actions]);

  const change = (next: ReelEdit) => {
    setEdit(next);
    setSave('dirty');
  };

  // Poll while a render is queued or running.
  const active = renders.find((r) => r.status === 'queued' || r.status === 'running');
  React.useEffect(() => {
    if (!current || !active) return;
    const t = window.setInterval(() => void actions.listRenders(current.id).then(setRenders), 2000);
    return () => window.clearInterval(t);
  }, [current, active, actions]);

  async function newProject(template: keyof typeof REEL_TEMPLATES) {
    setError(null);
    const res = await actions.createProject(orgId, template, 'Untitled reel');
    if (res.ok === false) return setError(res.error);
    setProjects((ps) => [res.value, ...ps]);
    open(res.value);
  }

  async function pickFile(key: SlotKey, file: File, measured?: number) {
    if (!current || !edit) return;
    setError(null);
    setBusy((b) => ({ ...b, [key]: 0 }));
    const isVideo = file.type.startsWith('video/');
    const duration = measured ?? (isVideo ? await readDuration(file) : undefined);
    const res = await upload(uploadEndpoint, { project: current.id, slot: key, name: file.name }, file, (p) =>
      setBusy((b) => ({ ...b, [key]: p }))
    );
    setBusy((b) => {
      const { [key]: _, ...rest } = b;
      return rest;
    });
    if (!res.path) return setError(res.error ?? 'Upload failed');
    const prev = getSlot(edit, key);
    const ref: ReelMediaRef & Record<string, unknown> = { path: res.path, name: file.name };
    if (isVideo) Object.assign(ref, { duration, trimStart: 0, voice: prev?.voice ?? true });
    if (key === 'extra') ref.kind = isVideo ? 'video' : 'image';
    if (key === 'music') {
      Object.assign(ref, { volume: edit.music?.volume ?? 0.7 });
      void actions.listMusic().then(setMusic);
    }
    change(setSlot(edit, key, ref));
  }

  async function render() {
    if (!current || !edit) return;
    setError(null);
    // Save first: the queue snapshots what is stored, not what is on screen.
    const saved = await actions.saveProject(current.id, { title, edit });
    if (saved.ok === false) return setError(saved.error);
    setSave('saved');
    const res = await actions.queueRender(current.id);
    if (res.ok === false) return setError(res.error);
    setRenders((rs) => [res.value, ...rs]);
  }

  async function share(track: VideoTrack) {
    const res = await actions.shareMusic(track.path);
    if (res.ok === false) return setError(res.error);
    setMusic(await actions.listMusic());
  }

  const template = edit ? REEL_TEMPLATES[edit.template] : null;
  // "Just me" (oad) signs with the person's own name; an org with its name.
  const fallbackName =
    !current || current.orgId === 'oad'
      ? frame.viewer.displayName
      : orgs.find((o) => o.orgId === current.orgId)?.name ?? frame.viewer.displayName;
  const input = React.useMemo(() => {
    if (!edit) return null;
    const urls: Record<string, string> = {};
    for (const p of editPaths(edit)) urls[p] = mediaUrl(mediaBase, p);
    return { edit, urls, fallbackName };
  }, [edit, mediaBase, fallbackName]);
  const missing = edit ? missingForRender(edit) : [];
  const done = renders.find((r) => r.status === 'done');
  const lastFailed = renders[0]?.status === 'failed' ? renders[0] : null;

  // Reels of the acting org; "Just me" lists them all, as writing's drawer does.
  const shown = orgId === 'oad' ? projects : projects.filter((p) => p.orgId === orgId);

  return (
    <>
      <StudioTopStatus>
        {save === 'saving' && 'Saving…'}
        {save === 'dirty' && 'Unsaved changes'}
        {save === 'saved' && current && 'Saved'}
        {save === 'error' && <span className="studio-err">Not saved</span>}
      </StudioTopStatus>
      <StudioTopActions>
        {links.broadcastHref && (
          <a className="studio-btn studio-btn--desktop" href={links.broadcastHref} title="The server's OBS studio: scenes, live stream, long recordings">
            Broadcast
          </a>
        )}
        <button
          type="button"
          className="studio-btn studio-btn--primary"
          disabled={!current || missing.length > 0 || Boolean(active) || Object.keys(busy).length > 0}
          title={missing.length ? `Add: ${missing.join(', ')}` : undefined}
          onClick={() => void render()}
        >
          {active ? (active.status === 'queued' ? 'Queued…' : `Rendering ${Math.round(active.progress * 100)}%`) : 'Render video'}
        </button>
      </StudioTopActions>
      <StudioColumns
        wideSettings
        drawer={
          <div className="vs-projects">
          <h2>New</h2>
          {Object.values(REEL_TEMPLATES).map((t) => (
            <button key={t.id} type="button" className="vs-template" onClick={() => void newProject(t.id)}>
              <b>{t.label}</b>
              <span>{t.description}</span>
            </button>
          ))}
          <h2>Your reels</h2>
          {shown.length === 0 && <p className="vs-faint">None yet.</p>}
          <ul>
            {shown.map((p) => (
              <li key={p.id}>
                <button type="button" aria-current={p.id === current?.id} onClick={() => open(p)}>
                  {p.title}
                  <small>{orgs.find((o) => o.orgId === p.orgId)?.name ?? p.orgId}</small>
                </button>
              </li>
            ))}
          </ul>
          </div>
        }
        main={
          <div className="vs-stage">
          {template && input ? (
            <>
              <input
                className="vs-title"
                value={title}
                aria-label="Title"
                onChange={(e) => {
                  setTitle(e.target.value);
                  setSave('dirty');
                }}
              />
              <div className="vs-player">
                <Player
                  // Player is typed over Record<string, unknown> props; templates take ReelInput.
                  component={template.component as unknown as React.FC<Record<string, unknown>>}
                  inputProps={input as unknown as Record<string, unknown>}
                  durationInFrames={template.durationInFrames(input)}
                  compositionWidth={template.width}
                  compositionHeight={template.height}
                  fps={template.fps}
                  controls
                  loop
                  // Frame 0 is the logo fading in from black; open on the artwork.
                  initialFrame={45}
                  acknowledgeRemotionLicense
                  style={{ width: '100%', height: '100%' }}
                />
              </div>
              {lastFailed && <p className="studio-err">Last render failed: {lastFailed.error}</p>}
              {done?.outputPath && (
                <div className="vs-done">
                  <h3>Rendered {new Date(done.createdAt).toLocaleString()}</h3>
                  <video src={mediaUrl(mediaBase, done.outputPath)} controls playsInline poster={done.thumbPath ? mediaUrl(mediaBase, done.thumbPath) : undefined} />
                  <a className="studio-btn" href={mediaUrl(mediaBase, done.outputPath)} download>
                    Download MP4
                  </a>
                  <p className="vs-faint">Saved in your files: {done.outputPath.split('/').slice(-3).join(' / ')}</p>
                </div>
              )}
              {done?.outputPath && (
                <div className="vs-done vs-publish">
                  <h3>Publish</h3>
                  {publication?.status === 'published' ? (
                    <>
                      <p>
                        On your page
                        {links.pageBase ? (
                          <>
                            {': '}
                            <a href={`${links.pageBase}/${publication.slug}`} target="_blank" rel="noreferrer">
                              {`${links.pageBase}/${publication.slug}`.replace(/^https?:\/\//, '')} ↗
                            </a>
                          </>
                        ) : null}
                      </p>
                      <div className="vs-row">
                        <button type="button" className="studio-btn" disabled={publishing} onClick={() => void publish('publish')}>
                          Update to the latest render
                        </button>
                        <button type="button" className="vs-link" disabled={publishing} onClick={() => void publish('unpublish')}>
                          Unpublish
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="vs-faint">
                        Puts the latest render on your page as a piece{publication?.status === 'draft' ? ' again' : ''}. It is listed
                        where you are making it (“Making as”), and you can set more in Writing afterwards.
                      </p>
                      <label className="vs-field">
                        A line about it (optional)
                        <textarea rows={2} value={description} maxLength={600} onChange={(e) => setDescription(e.target.value)} />
                      </label>
                      <button
                        type="button"
                        className="studio-btn studio-btn--primary"
                        disabled={publishing || publication === undefined}
                        onClick={() => void publish('publish')}
                      >
                        {publishing ? 'Publishing…' : 'Publish to my page'}
                      </button>
                    </>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="vs-empty">
              <p>Start a reel from a template under Reels, or open one you made.</p>
              <p className="vs-faint">Files you add are stored in your Nextcloud folder; the finished video is saved next to them.</p>
            </div>
          )}
          </div>
        }
        settings={
          edit && current ? (
            <div className="vs-panel">
            <h2>Slots</h2>
            {SLOT_INFO.map((s) => {
              const ref = getSlot(edit, s.key);
              const pct = busy[s.key];
              const isVideo = s.key === 'clip' || s.key === 'clip2' || (s.key === 'extra' && (ref as { kind?: string })?.kind === 'video');
              return (
                <section key={s.key} className="vs-slot" data-filled={Boolean(ref?.path)}>
                  <header>
                    <b>
                      {s.label}
                      {s.required && <span className="vs-req"> required</span>}
                    </b>
                    {ref?.path && (
                      <button type="button" className="vs-link" onClick={() => change(setSlot(edit, s.key, undefined))}>
                        Remove
                      </button>
                    )}
                  </header>
                  <p className="vs-faint">{s.hint}</p>
                  {ref?.name && <p className="vs-file">{ref.name}{ref.duration ? ` · ${ref.duration.toFixed(1)} s` : ''}</p>}
                  {recording === s.key ? (
                    <Recorder
                      maxSeconds={RECORD_MAX[s.key] ?? 15}
                      onCancel={() => setRecording(null)}
                      onDone={(file, seconds) => {
                        setRecording(null);
                        void pickFile(s.key, file, seconds);
                      }}
                    />
                  ) : pct !== undefined ? (
                    <progress max={1} value={pct} />
                  ) : (
                    <>
                    {RECORD_MAX[s.key] && (
                      <button type="button" className="studio-btn vs-pick" onClick={() => setRecording(s.key)}>
                        Record…
                      </button>
                    )}{' '}
                    {props.libraryEndpoint && (
                      <button
                        type="button"
                        className="studio-btn vs-pick"
                        aria-expanded={libraryFor === s.key}
                        onClick={() => setLibraryFor(libraryFor === s.key ? null : s.key)}
                      >
                        From my files…
                      </button>
                    )}{' '}
                    <label className="studio-btn vs-pick">
                      {ref?.path ? 'Replace…' : 'Upload…'}
                      <input
                        type="file"
                        accept={s.accept}
                        hidden
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          e.target.value = '';
                          if (f) void pickFile(s.key, f);
                        }}
                      />
                    </label>
                    </>
                  )}
                  {libraryFor === s.key && props.libraryEndpoint && (
                    <SlotLibrary
                      kinds={SLOT_KINDS[s.key]}
                      endpoint={props.libraryEndpoint}
                      mediaBase={mediaBase}
                      finished={finished?.filter((f) => f.projectId !== current.id) ?? null}
                      onPick={(p) => pickLibrary(s.key, p)}
                      onClose={() => setLibraryFor(null)}
                    />
                  )}
                  {ref?.path && isVideo && (
                    <div className="vs-row">
                      <label>
                        Start at (s)
                        <input
                          type="number"
                          min={0}
                          step={0.1}
                          max={ref.duration ?? undefined}
                          value={ref.trimStart ?? 0}
                          onChange={(e) => change(setSlot(edit, s.key, { ...ref, trimStart: Math.max(0, Number(e.target.value) || 0) }))}
                        />
                      </label>
                      <label className="vs-check">
                        <input
                          type="checkbox"
                          checked={ref.voice !== false}
                          onChange={(e) => change(setSlot(edit, s.key, { ...ref, voice: e.target.checked }))}
                        />
                        Speaking (music drops)
                      </label>
                    </div>
                  )}
                </section>
              );
            })}

            <h2>Music</h2>
            <section className="vs-slot" data-filled={Boolean(edit.music?.path)}>
              {edit.music?.path ? (
                <>
                  <p className="vs-file">{edit.music.name ?? edit.music.path.split('/').pop()}</p>
                  <label className="vs-row">
                    Volume
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={edit.music.volume ?? 0.7}
                      onChange={(e) => change({ ...edit, music: { ...edit.music!, volume: Number(e.target.value) } })}
                    />
                  </label>
                  <button type="button" className="vs-link" onClick={() => change({ ...edit, music: undefined })}>
                    No music
                  </button>
                </>
              ) : (
                <p className="vs-faint">No music. Pick a track below or upload your own.</p>
              )}
              {busy.music !== undefined ? (
                <progress max={1} value={busy.music} />
              ) : (
                <label className="studio-btn vs-pick">
                  Upload a track…
                  <input
                    type="file"
                    accept="audio/*"
                    hidden
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = '';
                      if (f) void pickFile('music', f);
                    }}
                  />
                </label>
              )}
              <p className="vs-faint">Uploads go to your private Music folder. Share a track to make it available to everyone on the network.</p>
              {(['mine', 'network'] as const).map((group) => (
                <div key={group} className="vs-tracks">
                  <h3>{group === 'mine' ? 'Your music' : 'Network music'}</h3>
                  {!music && <p className="vs-faint">Loading…</p>}
                  {music && music[group].length === 0 && <p className="vs-faint">Nothing here yet.</p>}
                  {music?.[group].map((t) => (
                    <div key={t.path} className="vs-track" aria-current={edit.music?.path === t.path}>
                      <button
                        type="button"
                        onClick={() => change({ ...edit, music: { path: t.path, name: t.name, volume: edit.music?.volume ?? 0.7 } })}
                      >
                        {t.name}
                      </button>
                      {group === 'mine' && !music.network.some((n) => n.path.endsWith('/' + t.path.split('/').pop())) && (
                        <button type="button" className="vs-link" onClick={() => void share(t)}>
                          Share
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </section>

            <h2>Look and end card</h2>
            <section className="vs-slot">
              <label className="vs-field">
                Name in the intro (when there is no logo)
                <input
                  value={edit.brand?.name ?? ''}
                  placeholder={fallbackName}
                  onChange={(e) => change({ ...edit, brand: { ...(edit.brand ?? {}), name: e.target.value } })}
                />
              </label>
              <div className="vs-row">
                <label>
                  Background
                  <input
                    type="color"
                    value={edit.brand?.background ?? '#111111'}
                    onChange={(e) => change({ ...edit, brand: { ...(edit.brand ?? {}), background: e.target.value } })}
                  />
                </label>
                <label>
                  Text
                  <input
                    type="color"
                    value={edit.brand?.foreground ?? '#f4f1ea'}
                    onChange={(e) => change({ ...edit, brand: { ...(edit.brand ?? {}), foreground: e.target.value } })}
                  />
                </label>
              </div>
              {(['title', 'subtitle', 'link'] as const).map((f) => (
                <label key={f} className="vs-field">
                  {f === 'title' ? 'End card title' : f === 'subtitle' ? 'Subtitle (e.g. the work’s title)' : 'Link'}
                  <input
                    value={edit.endCard?.[f] ?? ''}
                    placeholder={f === 'title' ? fallbackName : ''}
                    onChange={(e) => change({ ...edit, endCard: { ...(edit.endCard ?? {}), [f]: e.target.value } })}
                  />
                </label>
              ))}
            </section>

            <button
              type="button"
              className="vs-link vs-archive"
              onClick={async () => {
                if (!window.confirm('Remove this reel from your list? Its files stay in your storage.')) return;
                const res = await actions.archiveProject(current.id);
                if (res.ok === false) return setError(res.error);
                setProjects((ps) => ps.filter((p) => p.id !== current.id));
                open(null);
              }}
            >
              Remove this reel from the list
            </button>
            </div>
          ) : null
        }
      />
    </>
  );
}
