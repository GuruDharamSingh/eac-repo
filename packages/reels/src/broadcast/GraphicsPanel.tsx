'use client';

// Graphics on OBS's "Overlays" source: EBU OGraf v1 graphics in layers
// (docker/obs/overlay/, docker/obs/agent.mjs "Graphics"). Add a graphic from
// the catalog, fill its fields (a form built from the manifest's JSON
// Schema), then Play / Stop / Update; graphics with steps get Next and
// Back, custom actions without parameters get a button each. Admins can
// upload a graphic folder; its code runs in OBS's browser source.

import * as React from 'react';
import type { BroadcastGraphic, BroadcastGraphics, BroadcastGraphicsCommand, BroadcastLayer, BroadcastResult, BroadcastSchema } from './types';

interface Props {
  graphics?: BroadcastGraphics;
  send(cmd: BroadcastGraphicsCommand): Promise<BroadcastResult>;
  /** Upload a folder (FormData: tabId, folder, path/file pairs); absent hides the upload. */
  upload?(folder: string, files: { path: string; file: File }[]): Promise<{ ok: boolean; error?: string }>;
  deleteFolder?(folder: string): Promise<BroadcastResult>;
  disabled?: boolean;
}

type Data = Record<string, unknown>;

function SchemaFields({ schema, value, onChange }: { schema: BroadcastSchema | null; value: Data; onChange(v: Data): void }) {
  const props = Object.entries(schema?.properties ?? {});
  if (!props.length) return <p className="vs-faint">This graphic has no fields.</p>;
  return (
    <>
      {props.map(([key, s]) => {
        const label = s.title ?? key;
        const v = value[key];
        const set = (x: unknown) => onChange({ ...value, [key]: x });
        if (Array.isArray(s.enum)) {
          return (
            <label key={key} className="vs-field">
              {label}
              <select value={String(v ?? s.default ?? '')} onChange={(e) => set(e.target.value)}>
                {s.enum.map((o) => (
                  <option key={String(o)} value={String(o)}>
                    {s.gddOptions?.labels?.[String(o)] ?? String(o)}
                  </option>
                ))}
              </select>
            </label>
          );
        }
        if (s.type === 'boolean') {
          return (
            <label key={key} className="vs-check">
              <input type="checkbox" checked={Boolean(v)} onChange={(e) => set(e.target.checked)} />
              {label}
            </label>
          );
        }
        if (s.type === 'number' || s.type === 'integer') {
          return (
            <label key={key} className="vs-field">
              {label}
              <input
                type="number"
                min={s.minimum}
                max={s.maximum}
                step={s.type === 'integer' ? 1 : 'any'}
                value={v === undefined || v === null ? '' : String(v)}
                onChange={(e) => set(e.target.value === '' ? undefined : Number(e.target.value))}
              />
            </label>
          );
        }
        if (s.type === 'string' && s.gddType === 'color-rrggbb') {
          return (
            <label key={key} className="vs-field gp-color">
              {label}
              <input type="color" value={/^#[0-9a-f]{6}$/i.test(String(v)) ? String(v) : '#000000'} onChange={(e) => set(e.target.value)} />
            </label>
          );
        }
        if (s.type === 'string') {
          return (
            <label key={key} className="vs-field">
              {label}
              {s.gddType === 'multi-line' ? (
                <textarea rows={3} maxLength={s.maxLength} value={String(v ?? '')} onChange={(e) => set(e.target.value)} />
              ) : (
                <input maxLength={s.maxLength} value={String(v ?? '')} onChange={(e) => set(e.target.value)} />
              )}
            </label>
          );
        }
        return (
          <p key={key} className="vs-faint">
            {label}: set in the graphic’s defaults (this form edits text, numbers, choices and colours).
          </p>
        );
      })}
    </>
  );
}

function LayerCard({
  layer,
  graphic,
  index,
  count,
  run,
  off,
}: {
  layer: BroadcastLayer;
  graphic: BroadcastGraphic | undefined;
  index: number;
  count: number;
  run(cmd: BroadcastGraphicsCommand): Promise<void>;
  off: boolean;
}) {
  // The draft follows the agent's data until edited here.
  const [draft, setDraft] = React.useState<Data>(layer.data);
  const [dirty, setDirty] = React.useState(false);
  const live = JSON.stringify(layer.data);
  React.useEffect(() => {
    if (!dirty) setDraft(JSON.parse(live) as Data);
  }, [live, dirty]);
  const changed = dirty && JSON.stringify(draft) !== live;
  const steps = graphic?.stepCount ?? 1;

  async function update() {
    await run({ op: 'update', layerId: layer.id, data: draft });
    setDirty(false);
  }

  return (
    <section className="vs-slot gp-layer" data-playing={layer.playing ? 'true' : 'false'}>
      <h3>
        <span>{graphic?.name ?? layer.graphicId}</span>
        {layer.playing && <b className="gp-live">On air{steps > 1 ? ` · step ${layer.step + 1}/${steps}` : ''}</b>}
        <span className="gp-tools">
          <button type="button" className="vs-link" title="Bring forward" disabled={off || index === count - 1} onClick={() => void run({ op: 'move', layerId: layer.id, delta: 1 })}>
            ↑
          </button>
          <button type="button" className="vs-link" title="Send back" disabled={off || index === 0} onClick={() => void run({ op: 'move', layerId: layer.id, delta: -1 })}>
            ↓
          </button>
          <button
            type="button"
            className="vs-link"
            title="Remove this layer"
            disabled={off}
            onClick={() => void run({ op: 'remove', layerId: layer.id })}
          >
            ×
          </button>
        </span>
      </h3>
      {!graphic && <p className="studio-err">This graphic is no longer installed.</p>}
      {graphic && (
        <SchemaFields
          schema={graphic.schema}
          value={draft}
          onChange={(v) => {
            setDraft(v);
            setDirty(true);
          }}
        />
      )}
      <div className="vs-row gp-actions">
        {layer.playing ? (
          <button type="button" className="studio-btn" disabled={off} onClick={() => void run({ op: 'stop', layerId: layer.id })}>
            Stop
          </button>
        ) : (
          <button
            type="button"
            className="studio-btn studio-btn--primary"
            disabled={off || !graphic}
            onClick={async () => {
              if (changed) await update();
              await run({ op: 'play', layerId: layer.id });
            }}
          >
            Play
          </button>
        )}
        {changed && (
          <button type="button" className={layer.playing ? 'studio-btn studio-btn--primary' : 'studio-btn'} disabled={off} onClick={() => void update()}>
            Update
          </button>
        )}
        {layer.playing && (steps > 1 || steps === -1) && (
          <>
            <button type="button" className="studio-btn" disabled={off || layer.step === 0} onClick={() => void run({ op: 'step', layerId: layer.id, delta: -1 })}>
              Back
            </button>
            <button type="button" className="studio-btn" disabled={off} onClick={() => void run({ op: 'step', layerId: layer.id, delta: 1 })}>
              Next
            </button>
          </>
        )}
        {layer.playing &&
          graphic?.customActions
            .filter((a) => a.schema === null || a.schema === undefined)
            .map((a) => (
              <button
                key={a.id}
                type="button"
                className="studio-btn"
                title={a.description || undefined}
                disabled={off}
                onClick={() => void run({ op: 'custom', layerId: layer.id, actionId: a.id })}
              >
                {a.name}
              </button>
            ))}
      </div>
    </section>
  );
}

export function GraphicsPanel({ graphics, send, upload, deleteFolder, disabled }: Props) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [note, setNote] = React.useState<string | null>(null);
  const [pick, setPick] = React.useState('');
  const catalog = React.useMemo(
    () => [...(graphics?.catalog ?? [])].sort((a, b) => (a.source === b.source ? a.name.localeCompare(b.name) : a.source === 'repo' ? -1 : 1)),
    [graphics?.catalog]
  );
  const byId = React.useMemo(() => new Map(catalog.map((g) => [g.id, g])), [catalog]);
  const layers = graphics?.layers ?? [];
  const off = disabled || busy || !graphics;
  const chosen = pick && byId.has(pick) ? pick : (catalog[0]?.id ?? '');
  const uploadedFolders = [...new Set(catalog.filter((g) => g.source === 'uploads').map((g) => g.folder))];

  async function run(cmd: BroadcastGraphicsCommand) {
    setBusy(true);
    setError(null);
    const r = await send(cmd);
    setBusy(false);
    if (r.ok === false) setError(r.error);
  }

  async function onFolder(list: FileList | null) {
    if (!list?.length || !upload) return;
    const all = Array.from(list);
    // webkitRelativePath is "<folder>/<path inside it>".
    const folder = (all[0] as File & { webkitRelativePath?: string }).webkitRelativePath?.split('/')[0] ?? '';
    const files = all
      .map((file) => ({ path: ((file as File & { webkitRelativePath?: string }).webkitRelativePath ?? file.name).split('/').slice(1).join('/'), file }))
      .filter((f) => f.path && !f.path.split('/').some((seg) => seg.startsWith('.')));
    setBusy(true);
    setError(null);
    setNote(null);
    const r = await upload(folder, files);
    setBusy(false);
    if (!r.ok) setError(r.error ?? 'Upload failed');
    else setNote(`Uploaded “${folder}”.`);
  }

  return (
    <div className="gp">
      <section className="vs-slot">
        <div className="vs-row">
          <label className="vs-field gp-grow">
            Graphic
            <select value={chosen} onChange={(e) => setPick(e.target.value)} disabled={!catalog.length}>
              {catalog.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                  {g.source === 'uploads' ? ' (uploaded)' : ''}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="studio-btn studio-btn--primary gp-add" disabled={off || !chosen} onClick={() => void run({ op: 'add', graphicId: chosen })}>
            Add
          </button>
        </div>
        {byId.get(chosen)?.description && <p className="vs-faint">{byId.get(chosen)!.description}</p>}
      </section>

      {layers.length === 0 && <p className="vs-faint gp-empty">No graphics yet. Add one, fill it in, then Play.</p>}
      {/* Top layer first, as it sits on screen. */}
      {[...layers].reverse().map((l) => (
        <LayerCard key={l.id} layer={l} graphic={byId.get(l.graphicId)} index={layers.indexOf(l)} count={layers.length} run={run} off={off} />
      ))}

      <section className="vs-slot">
        <div className="vs-row">
          <button type="button" className="studio-btn" disabled={off || !layers.some((l) => l.playing)} onClick={() => void run({ op: 'clear' })}>
            Stop all
          </button>
          {upload && (
            <label className={`studio-btn gp-upload${off ? ' is-off' : ''}`}>
              Upload a graphic folder
              <input
                type="file"
                multiple
                disabled={off}
                // Folder picking: not in React's typings.
                {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
                onChange={(e) => {
                  void onFolder(e.target.files);
                  e.target.value = '';
                }}
              />
            </label>
          )}
        </div>
        {uploadedFolders.length > 0 && deleteFolder && (
          <ul className="gp-folders">
            {uploadedFolders.map((f) => (
              <li key={f}>
                <code>{f}</code>
                <button
                  type="button"
                  className="vs-link"
                  disabled={off}
                  onClick={async () => {
                    if (!window.confirm(`Remove the uploaded graphic folder “${f}” from OBS? Its layers go too.`)) return;
                    setBusy(true);
                    const r = await deleteFolder(f);
                    setBusy(false);
                    if (r.ok === false) setError(r.error);
                  }}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        {error && <p className="studio-err">{error}</p>}
        {note && <p className="vs-faint">{note}</p>}
        <p className="vs-faint">
          Graphics follow EBU OGraf v1: a folder with a <code>*.ograf.json</code> manifest and its module, up to 25 MB. An uploaded
          graphic’s code runs in OBS. They sit on the “Overlays” source over Holding, Browser and Media; add it to your own scenes
          in the desktop with Add existing source.
        </p>
      </section>
    </div>
  );
}
