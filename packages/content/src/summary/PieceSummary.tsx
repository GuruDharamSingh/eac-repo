'use client';

// ============================================================================
// The piece summary (canvas C, 2026-11-14) and the manage-piece pop-up
// (2026-11-15). Drawn over the piece's own cover and text instead of reopening
// the full form: Edit opens the site's quick form inline (or the form), Make
// into starts a linked draft of another kind, Open in Studio is the full form,
// and two lists: where it went (planned, then out) and next for this piece.
//
// Props only (types.ts); server-renderable (links for everything a server page
// drives: closeHref, editHref, closeEditHref). Themed by --ps-* custom
// properties on `.ps`, which fall back to the Studio's --st-* tokens; a site
// restyles it by setting --ps-* on `.ps` inside its own scope (summary.css).
// Left out until backed: Add ▾ (link, reference, media into this piece or a
// new one), Duplicate and Archive (docs/sessions/2026-11-14_studio-create-summary.md).
// ============================================================================

import * as React from 'react';
import { OutletMarks } from '../ui/piece-atoms';
import type { PieceSummaryOut, PieceSummaryProps } from './types';

/** "14 Nov": a fixed locale, and the host's time zone when it gives one, so a server render and the browser agree. */
function fmtDay(iso: string | null, timeZone?: string): string {
  if (!iso) return '';
  // A plain date (plan.md's "2026-11-20") is a calendar day, not midnight UTC: draw it as is in any zone.
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return fmtDay(`${iso}T12:00:00Z`, 'UTC');
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone }).format(d);
  } catch {
    return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(d);
  }
}

const STATE_WORD: Record<string, string> = {
  published: 'out',
  live: 'live',
  scheduled: 'planned',
  planned: 'planned',
  failed: 'failed',
  draft: 'draft',
  suggested: 'suggested',
};
/** Rows that have not gone out yet: drawn under Planned, soonest first. */
const PLANNED = new Set(['scheduled', 'planned', 'draft']);

function MakeIntoMenu({ items, menuId }: { items: Array<{ to: string; label: string; href: string }>; menuId: string }) {
  const [open, setOpen] = React.useState(false);
  const root = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open]);
  return (
    <div className="ps-menu" ref={root}>
      <button type="button" className="ps-btn" aria-haspopup="true" aria-expanded={open} aria-controls={menuId} onClick={() => setOpen((v) => !v)}>
        Make into
        <svg className="ps-ic" width="13" height="13" viewBox="0 0 24 24" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <ul className="ps-menu__list" id={menuId}>
          {items.map((t) => (
            <li key={t.to + t.label}>
              <a className="ps-menu__item" href={t.href}>
                {t.label}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function OutRow({ o, actions, timeZone }: { o: PieceSummaryOut; actions?: React.ReactNode; timeZone?: string }) {
  return (
    <li className="ps-row">
      <span className="ps-row__main">
        {o.href ? <a href={o.href}>{o.label}</a> : o.label}
        {o.sub && <span className="ps-mut"> · {o.sub}</span>}
      </span>
      {o.at && <span className="ps-mut">{fmtDay(o.at, timeZone)}</span>}
      <span className="ps-pill" data-state={o.state}>
        {STATE_WORD[o.state] ?? o.state}
      </span>
      {actions}
    </li>
  );
}

export function PieceSummary({
  view,
  layout = 'page',
  onEdit,
  editHref,
  edit,
  editing = false,
  closeEditHref,
  makeInto = [],
  studioHref,
  channelLabel,
  onClose,
  closeHref,
  nextRows,
  plan,
  outActions,
  actions,
  children,
  timeZone,
}: PieceSummaryProps) {
  // Ids from the piece key, not useId (the forms' rule: stable ids in markup that may render on the server).
  const titleId = `ps-${view.key.replace(/[^A-Za-z0-9_-]/g, '-')}`;
  const facts = view.facts.slice(0, 4);
  const statusDay = fmtDay(view.status.at, timeZone);
  const floating = layout === 'sheet' || layout === 'popup';
  const isEditing = editing && edit != null;

  const planned = view.out.filter((o) => PLANNED.has(o.state)).sort((a, b) => (a.at ?? '').localeCompare(b.at ?? ''));
  const gone = view.out.filter((o) => !PLANNED.has(o.state));

  const close = floating
    ? onClose
      ? (
          <button type="button" className="ps-btn ps-cover__close" aria-label="Close" onClick={onClose}>
            <CloseIcon />
          </button>
        )
      : closeHref
        ? (
            <a className="ps-btn ps-cover__close" aria-label="Close" href={closeHref}>
              <CloseIcon />
            </a>
          )
        : null
    : null;

  const article = (
    <article className="ps" data-layout={layout} data-editing={isEditing ? '' : undefined} aria-labelledby={titleId}>
      {layout === 'popup' && <span className="ps-grab" aria-hidden="true" />}
      <section className="ps-cover" data-pictures={view.pictures.length} aria-label="The piece">
        {view.pictures.length > 0 && (
          <div className="ps-cover__pics" aria-hidden="true">
            {view.pictures.map((src) => (
              <img key={src} src={src} alt="" />
            ))}
          </div>
        )}
        {view.pictureCount > 0 && !isEditing && (
          <span className="ps-cover__tag">
            Cover · {view.pictureCount} {view.pictureCount === 1 ? 'picture' : 'pictures'}
          </span>
        )}
        {close}
        <div className="ps-card">
          <span className="ps-eb">{[view.typeLabel, view.byline].filter(Boolean).join(' · ')}</span>
          <h1 className="ps-title" id={titleId}>
            {view.title || 'Untitled'}
          </h1>
          {!isEditing && (
            <>
              {view.excerpt && <p className="ps-excerpt">{view.excerpt}</p>}
              {facts.length > 0 ? (
                <dl className="ps-facts">
                  {facts.map((f) => (
                    <div key={f.label} className="ps-fact">
                      <dt className="ps-eb">{f.label}</dt>
                      <dd>{f.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : view.meta ? (
                <p className="ps-mut ps-meta">{view.meta}</p>
              ) : null}
              {view.marks && view.marks.length > 0 && (
                <div className="ps-coverage">
                  <span className="ps-eb">Coverage</span>
                  <OutletMarks marks={view.marks} />
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {isEditing ? (
        <div className="ps-edit">
          {closeEditHref && (
            <a className="ps-back" href={closeEditHref}>
              <span aria-hidden="true">←</span> Back to the piece
            </a>
          )}
          {edit}
        </div>
      ) : (
        <>
          {actions ? (
            <div className="ps-actions">{actions}</div>
          ) : (
            <div className="ps-actions">
              {(onEdit || editHref) &&
                (onEdit ? (
                  <button type="button" className="ps-btn ps-btn--primary" onClick={onEdit}>
                    Edit
                  </button>
                ) : (
                  <a className="ps-btn ps-btn--primary" href={editHref ?? undefined}>
                    Edit
                  </a>
                ))}
              {makeInto.length > 0 && <MakeIntoMenu items={makeInto} menuId={`${titleId}-make`} />}
              {/* With the Plan box drawn below, the plan is already here: no link out. */}
              {view.links.plan && !plan && (
                <a className="ps-btn" href={view.links.plan}>
                  <svg className="ps-ic" width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
                    <rect x="4" y="5" width="16" height="15" rx="2" />
                    <path d="M4 10h16M9 3v4M15 3v4" />
                  </svg>
                  Plan it
                </a>
              )}
              {studioHref && (
                <a className="ps-btn" href={studioHref}>
                  Open in Studio <span aria-hidden="true">↗</span>
                </a>
              )}
              {view.links.view && (
                <a className="ps-btn" href={view.links.view} target="_blank" rel="noreferrer">
                  View live
                </a>
              )}
              {view.links.channel && (
                <a className="ps-btn" href={view.links.channel}>
                  {channelLabel ?? 'Open in Channel'} <span aria-hidden="true">↗</span>
                </a>
              )}
              <span className="ps-spacer" />
              <span className="ps-mut">{statusDay ? `${view.status.label} ${statusDay}` : view.status.label}</span>
            </div>
          )}

          <div className="ps-cards">
            {plan && (
              <section className="ps-box ps-plan" aria-labelledby={`${titleId}-plan`}>
                <h2 className="ps-eb" id={`${titleId}-plan`}>
                  Plan
                </h2>
                {plan.goal && <p className="ps-plan__goal">{plan.goal}</p>}
                {plan.state === 'none' ? (
                  <p className="ps-mut">No plan yet. A plan lists the steps that carry this piece out: the posts, the letter, the clip.</p>
                ) : plan.steps.length === 0 ? (
                  <p className="ps-mut">No steps yet.</p>
                ) : (
                  <ol className="ps-list ps-steps">
                    {plan.steps.map((s) => {
                      const due = fmtDay(s.due ?? null, timeZone);
                      return (
                        <li key={s.id} className="ps-row ps-step" data-done={s.done ? '' : undefined}>
                          {s.control ?? (
                            <span className="ps-step__mark" aria-label={s.done ? 'Done' : 'Not done'}>
                              {s.done ? '✓' : ''}
                            </span>
                          )}
                          <span className="ps-row__main">
                            {s.label}
                            {due && <span className="ps-mut ps-row__why">{due}</span>}
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                )}
                {plan.actions && <div className="ps-row__acts ps-plan__acts">{plan.actions}</div>}
              </section>
            )}
            <section className="ps-box" aria-labelledby={`${titleId}-out`}>
              <h2 className="ps-eb" id={`${titleId}-out`}>
                Where it went
              </h2>
              {planned.length === 0 && gone.length === 0 && <p className="ps-mut">Nowhere yet.</p>}
              {planned.length > 0 && (
                <>
                  <h3 className="ps-sub">Planned</h3>
                  <ul className="ps-list">
                    {planned.map((o) => (
                      <OutRow key={o.id} o={o} actions={outActions?.[o.id]} timeZone={timeZone} />
                    ))}
                  </ul>
                </>
              )}
              {gone.length > 0 && (
                <>
                  {planned.length > 0 && <h3 className="ps-sub">Out</h3>}
                  <ul className="ps-list">
                    {gone.map((o) => (
                      <OutRow key={o.id} o={o} actions={outActions?.[o.id]} timeZone={timeZone} />
                    ))}
                  </ul>
                </>
              )}
            </section>
            <section className="ps-box" aria-labelledby={`${titleId}-next`}>
              <h2 className="ps-eb" id={`${titleId}-next`}>
                Next for this piece
              </h2>
              {nextRows ? (
                nextRows.length === 0 ? (
                  <p className="ps-mut">Nothing suggested right now.</p>
                ) : (
                  <ul className="ps-list">
                    {nextRows.map((n) => (
                      <li key={n.id} className="ps-row ps-row--next">
                        <span className="ps-row__main">
                          {n.title}
                          {n.reason && <span className="ps-mut ps-row__why">{n.reason}</span>}
                        </span>
                        {n.actions && <span className="ps-row__acts">{n.actions}</span>}
                      </li>
                    ))}
                  </ul>
                )
              ) : view.next.length === 0 ? (
                <p className="ps-mut">Nothing suggested right now.</p>
              ) : (
                <ul className="ps-list">
                  {view.next.map((n) => (
                    <li key={n.id} className="ps-row ps-row--next">
                      <span className="ps-row__main">
                        {n.title}
                        {n.reason && <span className="ps-mut ps-row__why">{n.reason}</span>}
                      </span>
                      {n.href && (
                        <a className="ps-btn ps-btn--small" href={n.href}>
                          {n.label}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
          {children}
        </>
      )}
    </article>
  );

  if (layout !== 'popup') return article;
  return (
    <PopupFrame titleId={titleId} onClose={onClose} closeHref={closeHref}>
      {article}
    </PopupFrame>
  );
}

/**
 * The manage-piece pop-up's frame: a scrim that closes it, and the panel (from the right at 640px and
 * up, from the bottom below). Escape closes it; focus moves into the panel; the page behind stops scrolling.
 */
function PopupFrame({ titleId, onClose, closeHref, children }: { titleId: string; onClose?: () => void; closeHref?: string | null; children: React.ReactNode }) {
  const panel = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    panel.current?.focus({ preventScroll: true });
    const body = document.body;
    const before = body.style.overflow;
    body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      if (onClose) onClose();
      else if (closeHref) window.location.assign(closeHref);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      body.style.overflow = before;
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose, closeHref]);
  return (
    <div className="ps-pop" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      {onClose ? (
        <button type="button" className="ps-pop__scrim" aria-label="Close" tabIndex={-1} onClick={onClose} />
      ) : closeHref ? (
        <a className="ps-pop__scrim" aria-label="Close" tabIndex={-1} href={closeHref} />
      ) : (
        <span className="ps-pop__scrim" aria-hidden="true" />
      )}
      <div className="ps-pop__panel" ref={panel} tabIndex={-1}>
        {children}
      </div>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg className="ps-ic" width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}
