'use client';

// ============================================================================
// Studio · Create (canvas A, "Studio pipeline frame", 2026-11-14).
//
// Start something (New), bring something in, or turn what you have into
// something else (the Library's Make into). Each choice opens a draft in the
// kind that makes it ("Develop"). The left column holds the pipeline nav, the
// next move from the acting channel's queue and the material not yet used.
//
// Data comes from the host's `load(orgId)` and is drawn as given. Make into
// links go to the host's Make into route (`makeBase`), which opens the target
// kind; nothing carries over yet (docs/open/MAKE_INTO_CARRY_2026-11-11.md).
// Left out until something backs them: Photo, Upload files, Import a link and
// Workshop (docs/sessions/2026-11-14_studio-create-summary.md, open items).
// ============================================================================

import * as React from 'react';
import { StudioColumns, useStudioFrame } from '../frame';
import { makeIntoFor, makeIntoHref } from '../make-into';
import type { CreateKindProps, CreateLibraryItem, StudioCreateData } from './types';

const PERSONAL_ORG_ID = 'oad';
/** Library rows shown before "All N in the library". */
const SHOWN = 6;

function fmtDay(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function statusLine(item: CreateLibraryItem): string {
  const day = fmtDay(item.date);
  switch (item.status) {
    case 'published':
      return day ? `published ${day}` : 'published';
    case 'scheduled':
      return day ? `scheduled ${day}` : 'scheduled';
    case 'live':
      return 'live';
    default:
      return 'draft';
  }
}

const Icon = ({ d, size = 22 }: { d: React.ReactNode; size?: number }) => (
  <svg className="studio-create__ic" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    {d}
  </svg>
);

/**
 * The pipeline nav at the top of the left column (canvas A, B, C): Create, Develop and the acting
 * org's Channel. Shared by Create and, later, the piece summary.
 */
export function PipelineNav({
  current,
  developCount,
  onCreate,
  onDevelop,
  channelHref,
  channelLabel,
}: {
  current: 'create' | 'develop';
  developCount?: number;
  onCreate?: () => void;
  onDevelop?: () => void;
  channelHref?: string | null;
  channelLabel: string;
}) {
  return (
    <nav className="studio-pipe" aria-label="Pipeline">
      <button type="button" className="studio-pipe__item" aria-current={current === 'create' ? 'page' : undefined} onClick={onCreate}>
        <span className="studio-pipe__mk" data-step="create" aria-hidden="true" />
        Create
      </button>
      <button type="button" className="studio-pipe__item" aria-current={current === 'develop' ? 'page' : undefined} onClick={onDevelop}>
        <span className="studio-pipe__mk" data-step="develop" aria-hidden="true" />
        Develop
        {developCount ? (
          <span className="studio-pipe__n" aria-label={`${developCount} drafts`}>
            {developCount}
          </span>
        ) : null}
      </button>
      {channelHref && (
        <a className="studio-pipe__item studio-pipe__item--out" href={channelHref}>
          <span className="studio-pipe__mk" data-step="channel" aria-hidden="true" />
          {channelLabel}
          <span className="studio-pipe__ext" aria-hidden="true">
            ↗
          </span>
        </a>
      )}
    </nav>
  );
}

export function CreateKind({ load, makeBase, channelBase, liveHref, nextcloudHref }: CreateKindProps) {
  const f = useStudioFrame();
  const { orgId } = f;
  const personal = orgId === PERSONAL_ORG_ID;
  const orgName = personal ? null : f.orgs.find((o) => o.orgId === orgId)?.name ?? null;

  const [data, setData] = React.useState<StudioCreateData | null>(null);
  const [state, setState] = React.useState<'loading' | 'ready' | 'error'>('loading');
  React.useEffect(() => {
    let live = true;
    setState('loading');
    load(orgId)
      .then((d) => {
        if (!live) return;
        setData(d);
        setState(d ? 'ready' : 'error');
      })
      .catch(() => {
        if (live) setState('error');
      });
    return () => {
      live = false;
    };
  }, [load, orgId]);

  const orgQuery = personal ? '' : `org=${encodeURIComponent(orgId)}`;
  const channelHref = channelBase ? `${channelBase}${orgQuery ? `?${orgQuery}` : ''}` : null;
  const channelLabel = orgName ? `${orgName}’s Channel` : 'Your Channel';
  const makeHref = (from: string, to: string) => makeIntoHref(makeBase, from, to, orgId);
  const open = (kind: string) => f.switchKind?.(kind);

  const library = data?.library ?? [];
  const drafts = library.filter((i) => i.status === 'draft').length;

  const drawer = (
    <div className="studio-create__side">
      <PipelineNav current="create" developCount={drafts} onDevelop={() => open('writing')} channelHref={channelHref} channelLabel={channelLabel} />
      {data?.next && (
        <section className="studio-create__next" aria-labelledby="create-next">
          <div className="studio-create__nexth">
            <span className="studio-create__eb" id="create-next">
              Next · from your queue
            </span>
            {data.nextMore > 0 && channelHref && <a href={channelHref}>{data.nextMore} more</a>}
          </div>
          <b>{data.next.title}</b>
          <span className="studio-create__mut">{data.next.reason ?? data.next.kicker}</span>
          {data.next.href && (
            <a className="studio-btn studio-btn--primary" href={data.next.href}>
              {data.next.label}
            </a>
          )}
        </section>
      )}
      <section className="studio-create__mat" aria-labelledby="create-mat">
        <span className="studio-create__eb" id="create-mat">
          Material not yet used
        </span>
        {state === 'loading' && <p className="studio-hint">Looking…</p>}
        {state !== 'loading' && (data?.material.length ?? 0) === 0 && (
          <p className="studio-hint">Nothing waiting. Recordings and files you bring in stay here until something is made from them.</p>
        )}
        {data?.material.map((m) => (
          <button key={m.id} type="button" className="studio-row studio-create__matrow" onClick={() => open('recording')}>
            <span>{m.title}</span>
            <span className="studio-create__mut">
              {m.kind === 'recording' ? 'Recording' : 'File'} · {fmtDay(m.updatedAt)}
            </span>
          </button>
        ))}
        {data && data.materialMore > 0 && (
          <button type="button" className="studio-row studio-create__matrow" onClick={() => open('recording')}>
            <span className="studio-create__mut">All material ({data.material.length + data.materialMore})</span>
          </button>
        )}
      </section>
    </div>
  );

  const main = (
    <div className="studio-create">
      <header>
        <h1>Create</h1>
        <p className="studio-create__lede">Start something, bring something in, or turn what you have into something else. Each choice opens a draft in Develop.</p>
      </header>

      <section className="studio-create__sec" aria-labelledby="create-new">
        <h2 className="studio-create__eb" id="create-new">
          New
        </h2>
        <div className="studio-create__tiles">
          <button type="button" className="studio-create__tile" onClick={() => open('post')}>
            <Icon d={<path d="M5 6h14M5 11h14M5 16h9" />} />
            <span>
              <b>Text</b>
              <small>A post: words, a few pictures</small>
            </span>
          </button>
          <button type="button" className="studio-create__tile" onClick={() => open('writing')}>
            <Icon
              d={
                <>
                  <path d="M7 3h7l5 5v13H7z" />
                  <path d="M14 3v5h5" />
                </>
              }
            />
            <span>
              <b>Doc</b>
              <small>Essay on the canvas</small>
            </span>
          </button>
          <button type="button" className="studio-create__tile" onClick={() => open('video')}>
            <Icon
              d={
                <>
                  <rect x="3" y="6" width="13" height="12" rx="2" />
                  <path d="m16 10 5-3v10l-5-3" />
                </>
              }
            />
            <span>
              <b>Video</b>
              <small>Record or upload, cut, overlays: opens the clip editor</small>
            </span>
          </button>
          {liveHref && (
            <a className="studio-create__tile" href={liveHref}>
              <Icon
                d={
                  <>
                    <circle cx="12" cy="12" r="2.5" />
                    <path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M4.9 4.9a10 10 0 0 0 0 14.2M19.1 4.9a10 10 0 0 1 0 14.2" />
                  </>
                }
              />
              <span>
                <b>Live</b>
                <small>Go live from the booth, to your outlets</small>
              </span>
            </a>
          )}
        </div>
      </section>

      <section className="studio-create__sec" aria-labelledby="create-in">
        <h2 className="studio-create__eb" id="create-in">
          Bring in
        </h2>
        <div className="studio-create__bring">
          <button type="button" className="studio-btn" onClick={() => open('recording')}>
            <Icon
              size={16}
              d={
                <>
                  <rect x="7" y="3" width="10" height="18" rx="2" />
                  <path d="M11 17h2" />
                </>
              }
            />
            Record on a phone
          </button>
          {nextcloudHref && (
            <a className="studio-btn" href={nextcloudHref} target="_blank" rel="noreferrer">
              <Icon size={16} d={<path d="M3 7h6l2 2h10v10H3z" />} />
              From Nextcloud
            </a>
          )}
        </div>
      </section>

      <Library items={library} state={state} query={f.query ?? ''} orgName={orgName} makeHref={makeHref} />

      <div className="studio-create__pair">
        <section className="studio-create__card" aria-labelledby="create-prod">
          <div className="studio-create__cardh">
            <h2 id="create-prod">Products</h2>
          </div>
          <div className="studio-create__products">
            <button type="button" className="studio-create__tile studio-create__tile--small" onClick={() => open('service-form')}>
              <span>
                <b>Offering</b>
                <small>Sessions people book and pay for</small>
              </span>
            </button>
            <button type="button" className="studio-create__tile studio-create__tile--small" onClick={() => open('artwork-form')}>
              <span>
                <b>Artwork</b>
                <small>A work for sale or to show</small>
              </span>
            </button>
          </div>
        </section>

        <section className="studio-create__card" aria-labelledby="create-kit">
          <div className="studio-create__cardh">
            <h2 id="create-kit">Brand kit</h2>
            {data?.kit.editHref && (
              <a className="studio-btn" href={data.kit.editHref}>
                Edit kit
              </a>
            )}
          </div>
          {state === 'loading' ? (
            <p className="studio-hint">Looking…</p>
          ) : data && (data.kit.colors.length > 0 || data.kit.fonts.length > 0) ? (
            <div className="studio-create__kit">
              <span className="studio-create__mark" aria-hidden="true">
                {(orgName ?? f.viewer.displayName).slice(0, 1).toUpperCase()}
              </span>
              <div className="studio-create__kitbody">
                {data.kit.colors.length > 0 && (
                  <ul className="studio-create__swatches" aria-label="Colours">
                    {data.kit.colors.map((c) => (
                      <li key={c} className="studio-create__swatch" style={{ background: c }} title={c}>
                        <span className="studio-sr">{c}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {data.kit.fonts.length > 0 && <span className="studio-create__mut">{data.kit.fonts.join(' / ')}</span>}
              </div>
            </div>
          ) : (
            <p className="studio-hint">No colours or fonts saved for {orgName ?? 'your page'} yet.</p>
          )}
          <span className="studio-create__mut">{orgName ? `${orgName}’s site look.` : 'Your own page’s look.'} Video templates, covers and social cards will read it.</span>
        </section>
      </div>
    </div>
  );

  return <StudioColumns drawer={drawer} main={main} />;
}

function Library({
  items,
  state,
  query,
  orgName,
  makeHref,
}: {
  items: CreateLibraryItem[];
  state: 'loading' | 'ready' | 'error';
  /** The bar's search text. */
  query: string;
  orgName: string | null;
  makeHref: (from: string, to: string) => string;
}) {
  const [type, setType] = React.useState<string | null>(null);
  const [own, setOwn] = React.useState('');
  const [all, setAll] = React.useState(false);

  const groups = React.useMemo(() => {
    const by = new Map<string, { type: string; label: string; n: number }>();
    for (const i of items) {
      const g = by.get(i.type) ?? { type: i.type, label: i.typeLabel, n: 0 };
      g.n += 1;
      by.set(i.type, g);
    }
    return [...by.values()].sort((a, b) => b.n - a.n);
  }, [items]);

  const q = (own || query).trim().toLowerCase();
  const rows = items.filter((i) => (!type || i.type === type) && (!q || i.title.toLowerCase().includes(q)));
  const shown = all ? rows : rows.slice(0, SHOWN);

  return (
    <section className="studio-create__card" aria-labelledby="create-lib">
      <div className="studio-create__cardh">
        <h2 id="create-lib">Library</h2>
        <p className="studio-create__mut">
          Everything {orgName ? `you and ${orgName} have` : 'you have'} made. The buttons on the right make a piece into another kind.
        </p>
      </div>
      {items.length > 0 && (
        <div className="studio-create__filters">
          <button type="button" className="studio-create__chip" aria-pressed={type === null} onClick={() => setType(null)}>
            All {items.length}
          </button>
          {groups.map((g) => (
            <button key={g.type} type="button" className="studio-create__chip" aria-pressed={type === g.type} onClick={() => setType(type === g.type ? null : g.type)}>
              {g.label} {g.n}
            </button>
          ))}
          <label className="studio-create__search">
            <span className="studio-sr">Search the library</span>
            <input type="search" placeholder="Search the library" value={own} onChange={(e) => setOwn(e.target.value)} />
          </label>
        </div>
      )}
      {state === 'loading' && <p className="studio-hint">Loading the library…</p>}
      {state === 'error' && <p className="studio-hint">The library could not be read just now.</p>}
      {state === 'ready' && items.length === 0 && <p className="studio-hint">Nothing here yet. Start with New above.</p>}
      {state === 'ready' && items.length > 0 && rows.length === 0 && <p className="studio-hint">Nothing matches.</p>}
      {shown.length > 0 && (
        <ul className="studio-create__list">
          {shown.map((i) => {
            // makeIntoFor leaves out the source's own kind unless it means something (a meeting's next meeting).
            const targets = makeIntoFor(i.type);
            return (
              <li key={i.key} className="studio-create__prow">
                <span className="studio-create__thumb" aria-hidden="true">
                  {i.cover ? <img src={i.cover} alt="" loading="lazy" /> : null}
                </span>
                <span className="studio-create__ptext">
                  <b>{i.title || 'Untitled'}</b>
                  <span className="studio-create__mut">{[i.typeLabel, statusLine(i), i.meta].filter(Boolean).join(' · ')}</span>
                </span>
                <span className="studio-create__make" role="group" aria-label={`Make “${i.title || 'Untitled'}” into`}>
                  {/* The three likeliest as chips; the rest (2026-11-15: every kind Studio opens) under More. */}
                  {targets.slice(0, 3).map((t) => (
                    <a key={t.to + t.label} className="studio-create__chip" href={makeHref(i.key, t.to)}>
                      {t.label}
                    </a>
                  ))}
                  {targets.length > 3 && (
                    <details className="studio-create__makemore">
                      <summary className="studio-create__chip">More</summary>
                      <span className="studio-create__makelist">
                        {targets.slice(3).map((t) => (
                          <a key={t.to + t.label} href={makeHref(i.key, t.to)}>
                            {t.label}
                          </a>
                        ))}
                      </span>
                    </details>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {rows.length > SHOWN && (
        <button type="button" className="studio-btn studio-create__more" onClick={() => setAll((v) => !v)}>
          {all ? 'Show fewer' : `All ${rows.length} in the library`}
        </button>
      )}
    </section>
  );
}
