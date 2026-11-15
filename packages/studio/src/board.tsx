'use client';

import * as React from 'react';
import type { StudioPieceRef } from './frame';
import type { StudioBoardItem, StudioBoardLoader, StudioBoardState, StudioBoardView } from './types';

// ============================================================================
// The Board sheet (canvas R1, "In Channel"; developer, 2026-11-11): the open
// item as Channel sees it, beside the work. The next three weeks by lane,
// what the board suggests next, where it has gone, and the ways into Channel.
// The host loads the view (StudioShellProps.loadBoard); this only draws it.
// Writes (accepting a suggestion, moving a date) stay in Channel.
// ============================================================================

const STATE_WORD: Record<StudioBoardState, string> = {
  published: 'out',
  scheduled: 'planned',
  live: 'live',
  draft: 'draft',
  failed: 'failed',
  suggested: 'suggested',
  info: '',
};

type Load = { status: 'loading' } | { status: 'ready'; view: StudioBoardView } | { status: 'missing' } | { status: 'error' };

export interface BoardSheetProps {
  piece: StudioPieceRef;
  load: StudioBoardLoader;
  /** Channel's home, for the "not in Channel" state (the item's own board would not be found). */
  fallbackHref: string | null;
  /** Distance from the top of the window (under the Studio's bar). */
  top: number;
  onClose: () => void;
  /** Other kinds to start from this piece (2026-11-12). Nothing carries over yet: Make into's carry is not built. */
  makeInto?: Array<{ id: string; label: string }>;
  onMakeInto?: (kindId: string) => void;
}

function weekLabel(date: string): string {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
}

function dayLabel(at: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone }).format(new Date(at));
}

function Cell({ items, timeZone }: { items: StudioBoardItem[]; timeZone: string }) {
  if (items.length === 0) return <span className="studio-board__cell" />;
  const shown = items.slice(0, 2);
  return (
    <span className="studio-board__cell">
      {shown.map((it) => (
        <span key={it.id} className="studio-board__chip" data-state={it.state} title={`${dayLabel(it.at, timeZone)} · ${it.label}${STATE_WORD[it.state] ? ` · ${STATE_WORD[it.state]}` : ''}`}>
          {it.label}
        </span>
      ))}
      {items.length > shown.length && <span className="studio-board__more">+{items.length - shown.length}</span>}
    </span>
  );
}

export function BoardSheet({ piece, load, fallbackHref, top, onClose, makeInto = [], onMakeInto }: BoardSheetProps) {
  const [state, setState] = React.useState<Load>({ status: 'loading' });
  const [attempt, setAttempt] = React.useState(0);
  const closeRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    let live = true;
    setState({ status: 'loading' });
    load({ store: piece.store, id: piece.id, orgId: piece.orgId })
      .then((view) => live && setState(view ? { status: 'ready', view } : { status: 'missing' }))
      .catch(() => live && setState({ status: 'error' }));
    return () => {
      live = false;
    };
  }, [load, piece.store, piece.id, piece.orgId, attempt]);

  React.useEffect(() => {
    closeRef.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onClose]);

  const view = state.status === 'ready' ? state.view : null;

  return (
    <aside className="studio-board" aria-label="This piece in Channel" style={{ top }}>
      <div className="studio-board__head">
        <span className="studio-board__titles">
          <span className="studio-board__eb">In Channel</span>
          <span className="studio-board__title">{view ? view.title : state.status === 'loading' ? 'Loading…' : 'Board'}</span>
          {view && <span className="studio-board__meta">{`${view.typeLabel} · ${view.status}`}</span>}
        </span>
        <button ref={closeRef} type="button" className="studio-btn studio-btn--icon" aria-label="Close" onClick={onClose}>
          ✕
        </button>
      </div>

      <div className="studio-board__body" aria-busy={state.status === 'loading' || undefined}>
        {state.status === 'loading' && <p className="studio-board__quiet">Reading Channel…</p>}

        {state.status === 'missing' && (
          <p className="studio-board__quiet">
            Channel does not list this yet. It shows what you made and what the orgs you own or guide made, once saved.
            {fallbackHref && (
              <>
                {' '}
                <a href={fallbackHref}>Open Channel</a>
              </>
            )}
          </p>
        )}

        {state.status === 'error' && (
          <p className="studio-board__quiet">
            Channel could not be read.{' '}
            <button type="button" className="studio-board__link" onClick={() => setAttempt((n) => n + 1)}>
              Try again
            </button>
          </p>
        )}

        {view && (
          <>
            <section className="studio-board__sec" aria-labelledby="studio-board-weeks">
              <div className="studio-board__row">
                <span className="studio-board__eb" id="studio-board-weeks">
                  Board · next 3 weeks
                </span>
                <a href={view.links.board}>Open board</a>
              </div>
              {view.lanes.length === 0 ? (
                <p className="studio-board__quiet">Nothing is planned for it in these three weeks.</p>
              ) : (
                <div className="studio-board__grid" role="table" aria-label="The next three weeks by lane">
                  <span role="row" className="studio-board__gridrow">
                    <span role="columnheader" />
                    {view.weeks.map((w) => (
                      <span key={w} role="columnheader" className="studio-board__lane">
                        {weekLabel(w)}
                      </span>
                    ))}
                  </span>
                  {view.lanes.map((l) => (
                    <span key={l.id} role="row" className="studio-board__gridrow">
                      <span role="rowheader" className="studio-board__lane">
                        {l.label}
                      </span>
                      {l.cells.map((c, i) => (
                        <span key={i} role="cell">
                          <Cell items={c} timeZone={view.timeZone} />
                        </span>
                      ))}
                    </span>
                  ))}
                </div>
              )}
            </section>

            <section className="studio-board__sec" aria-labelledby="studio-board-next">
              <span className="studio-board__eb" id="studio-board-next">
                Next for this piece
              </span>
              {view.next.length === 0 ? (
                <p className="studio-board__quiet">{view.planning ? 'The board has no suggestions for it now.' : 'Channel planning is not set up yet.'}</p>
              ) : (
                <div className="studio-board__chips">
                  {view.next.map((n) => (
                    <a key={n.id} className="studio-board__next" href={n.href} title={n.reason || n.text}>
                      {n.text || n.chip}
                    </a>
                  ))}
                </div>
              )}
            </section>

            {makeInto.length > 0 && onMakeInto && (
              <section className="studio-board__sec" aria-labelledby="studio-board-make">
                <span className="studio-board__eb" id="studio-board-make">
                  Make into
                </span>
                <div className="studio-board__chips">
                  {makeInto.map((k) => (
                    <button key={k.id} type="button" className="studio-board__next" onClick={() => onMakeInto(k.id)}>
                      {k.label}
                    </button>
                  ))}
                </div>
                <p className="studio-board__quiet">Starts a new draft of that kind. Carrying this piece’s parts over is not built yet.</p>
              </section>
            )}

            {view.recent.length > 0 && (
              <section className="studio-board__sec" aria-labelledby="studio-board-recent">
                <span className="studio-board__eb" id="studio-board-recent">
                  Where it has gone
                </span>
                <ul className="studio-board__list">
                  {view.recent.map((r) => (
                    <li key={r.id}>
                      <span className="studio-board__when">{dayLabel(r.at, view.timeZone)}</span>
                      {r.href ? <a href={r.href}>{r.label}</a> : <span>{r.label}</span>}
                      {STATE_WORD[r.state] && (
                        <span className="studio-board__chip" data-state={r.state}>
                          {STATE_WORD[r.state]}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>

      {view && (
        <div className="studio-board__foot">
          <a className="studio-btn studio-btn--primary" href={view.links.board}>
            Open board
          </a>
          <a className="studio-btn" href={view.links.queue}>
            Queue
          </a>
          {view.links.compose && (
            <a className="studio-btn" href={view.links.compose}>
              New post about this
            </a>
          )}
        </div>
      )}
    </aside>
  );
}
