'use client';

// ============================================================================
// Gathering → Sessions: the series planner, list version (soft tissue, pass 2).
// Design: README §4 "Sessions planner (1c, list version)"; Publish Form.dc.html
// renderVals() `sessions`.
//
//   Sessions  8 sessions · 19 Nov to 21 Jan · 2 dates skipped   ← the section's summary (the shell)
//   No. | Date | Title and note | action                        ← Tendons' GridRows
//   1   Thu 19 Nov   Monotype basics / Aprons provided. Wear old shoes.   [skip]
//   6̶   T̶h̶u̶ ̶2̶4̶ ̶D̶e̶c̶   Skipped                                         [put back]
//   [Add a session] [Skip dates…]
//
// Driven by forms.sessions through rules/series.ts: the rows are the rule's
// dates with what was typed kept by date; every edit writes the rebuilt live
// list (and, in "N sessions" mode, the last date, since a skip pushes it out).
//
// Server truth (PLAN §12, Ligament's adapter, the bone's rulings):
//   numbers   the rule's own: a skipped week keeps its number, struck through
//             (meeting-series.ts:296, :1603-1622), so "Session 4" here is the
//             site's "Session 4". A recorded deviation from the design's live
//             renumbering.
//   title     saveSeriesSession.title (:1157); the note is its subtitle (:1158)
//   skip      cancelSeriesSession per date (:1603). No reason is stored (no
//             column, :1603-1608), so the row reads "Skipped" (deferred: skip-reason)
//   publish   titled, unskipped weeks are published with the series
//             (publishSeriesSession :1545); untitled ones stay drafts (:1561)
//   add       one more date ON the rule (count + 1, or the last date moved to the
//             next one). A date off the rule is refused by ensureSeriesSession
//             (:1297): deferred, sessions.off-rule.
// ============================================================================

import * as React from 'react';
import type { SectionProps } from '../../contract';
import { GridRows, type GridRow } from '../../fields/GridRows';
import { fieldAnchor } from '../../fields/ids';
import { datePart, dayLabel, num, untilForDate } from '../../rules/answers';
import {
  MAX_SESSIONS,
  seriesEnds,
  seriesRuleDate,
  seriesSessions,
  sessionEntries,
  untitledLabel,
  withSeriesSchedule,
  type SessionEntry,
  type SessionRow,
} from '../../rules/series';
import { Icon } from '../../theme/context';
import { Hint, Stack } from '../post/parts';

const SMALL_ACTION: React.CSSProperties = {
  alignSelf: 'flex-start',
  background: 'none',
  border: 0,
  padding: 0,
  font: 'inherit',
  fontSize: 12,
  color: 'var(--frm-accent-ink)',
  cursor: 'pointer',
};

function clean(e: SessionEntry): SessionEntry {
  return {
    date: e.date,
    ...(e.title ? { title: e.title } : {}),
    ...(e.note ? { note: e.note } : {}),
    ...(e.skipped ? { skipped: true } : {}),
    ...(e.reason ? { reason: e.reason } : {}),
  };
}

export function GatheringSessions({ answers: a, patch, field, issues }: SectionProps) {
  // Rows that fell off the end (a restore in "N sessions" mode drops the last date):
  // what was typed on them comes back if they return, within this visit.
  const kept = React.useRef(new Map<string, SessionEntry>());
  const extra = () => [...kept.current.values()];
  const rows = seriesSessions(a, undefined, extra());
  const ends = seriesEnds(a);
  const addRef = React.useRef<HTMLButtonElement>(null);
  const [notesOpen, setNotesOpen] = React.useState<string[]>([]);
  const [bulk, setBulk] = React.useState<{ open: boolean; from: string; to: string; none: boolean }>({ open: false, from: '', to: '', none: false });

  /** Write one or more dates' entries, then the rebuilt list (and the last date in count mode). */
  const write = (changes: SessionEntry[]) => {
    const byDate = new Map(sessionEntries(a).map((e) => [e.date, e]));
    for (const r of rows) if (!byDate.has(r.date)) byDate.set(r.date, { date: r.date });
    for (const c of changes) {
      const next = clean({ ...(byDate.get(c.date) ?? kept.current.get(c.date) ?? { date: c.date }), ...c });
      byDate.set(c.date, next);
      kept.current.set(c.date, next);
    }
    patch(withSeriesSchedule(a, { 'forms.sessions': [...byDate.values()] }, extra()));
  };

  const edit = (row: SessionRow, change: Partial<SessionEntry>) =>
    write([{ date: row.date, title: row.title, note: row.note, skipped: row.skipped, reason: row.reason, ...change }]);

  /** One more date on the rule: "N sessions" counts up; "until" moves to the next date. */
  const addOne = () => {
    if (ends === 'count') {
      const n = num(a['forms.repeat_count']) ?? rows.filter((r) => !r.skipped).length;
      patch(withSeriesSchedule(a, { 'forms.repeat_count': Math.min(MAX_SESSIONS, n + 1) }, extra()));
    } else if (ends === 'until') {
      const last = rows[rows.length - 1]?.date ?? datePart(a.scheduled_at);
      let k = 0;
      while (k < MAX_SESSIONS * 2 && seriesRuleDate(a, k) <= last) k++;
      patch(withSeriesSchedule(a, { recurrence_until: untilForDate(seriesRuleDate(a, k)) }, extra()));
    }
  };

  /** "Skip dates…": every date of the rule from `from` to `to` (including dates a count run reaches only after the skips). */
  const skipRange = () => {
    const from = bulk.from;
    const to = bulk.to || bulk.from;
    if (!from) return;
    const lo = from <= to ? from : to;
    const hi = from <= to ? to : from;
    const hits: SessionEntry[] = [];
    for (let k = 0; k < MAX_SESSIONS * 2; k++) {
      const d = seriesRuleDate(a, k);
      if (!d || d > hi) break;
      if (d >= lo) hits.push({ date: d, skipped: true });
    }
    if (!hits.length) return setBulk((b) => ({ ...b, none: true }));
    write(hits);
    setBulk({ open: false, from: '', to: '', none: false });
  };

  const problem = issues.find((i) => i.fields.includes('forms.sessions'));

  if (!rows.length) {
    return <Hint>Pick the day of the first session under When, and the sessions appear here.</Hint>;
  }

  const day = (r: SessionRow) => dayLabel(r.date, { weekday: true });

  const titleCell = (r: SessionRow): React.ReactNode =>
    r.skipped ? (
      <span style={{ fontSize: 14, lineHeight: 1.5, fontStyle: 'italic' }}>Skipped</span>
    ) : (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
        {field(`forms.sessions.${r.date}.title`, {
          input: 'text',
          label: `Title of session ${r.number}, ${day(r)}`,
          hideLabel: true,
          placeholder: untitledLabel(r),
          value: r.title,
          onChange: (v) => edit(r, { title: typeof v === 'string' ? v : '' }),
        })}
        {r.note || notesOpen.includes(r.date) ? (
          field(`forms.sessions.${r.date}.note`, {
            input: 'text',
            label: `Note for session ${r.number}`,
            hideLabel: true,
            placeholder: 'A line under the title',
            value: r.note,
            onChange: (v) => edit(r, { note: typeof v === 'string' ? v : '' }),
          })
        ) : (
          <button type="button" style={SMALL_ACTION} onClick={() => setNotesOpen((o) => [...o, r.date])}>
            + note
          </button>
        )}
      </div>
    );

  const gridRows: GridRow[] = rows.map((r) => ({
    key: r.date,
    state: r.skipped ? 'muted' : 'normal',
    cells: {
      no: <span style={{ fontSize: 15, fontWeight: r.skipped ? 400 : 600, lineHeight: '36px' }}>{r.number}</span>,
      date: <span style={{ fontSize: 13, lineHeight: '36px' }}>{day(r)}</span>,
      title: titleCell(r),
    },
    action: r.skipped
      ? { icon: 'restore', label: `Put ${day(r)} back`, tone: 'accent', onClick: () => edit(r, { skipped: false }) }
      : { icon: 'skip', label: `Skip ${day(r)}`, onClick: () => edit(r, { skipped: true }) },
  }));

  return (
    <Stack gap={10}>
      <GridRows
        id={fieldAnchor('forms.sessions')}
        label="Sessions"
        columns={[
          { id: 'no', label: 'No.', strikeWhenMuted: true },
          { id: 'date', label: 'Date', strikeWhenMuted: true },
          { id: 'title', label: 'Title and note' },
        ]}
        template="24px 82px minmax(0,1fr)"
        actionLabel="Skip or put back"
        rows={gridRows}
        afterRef={addRef}
      />

      {problem && (
        <p className="frm-msg" data-tone={problem.severity === 'block' ? 'error' : 'warning'}>
          <Icon name={problem.severity === 'block' ? 'error' : 'warning'} size={16} />
          <span>{problem.message}</span>
        </p>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', marginLeft: -5 }}>
        {ends !== 'open' && (
          <button ref={addRef} type="button" className="frm-btn frm-btn--ghost frm-btn--sm" onClick={addOne}>
            <Icon name="plus" size={14} />
            Add a session
          </button>
        )}
        <button
          type="button"
          className="frm-btn frm-btn--ghost frm-btn--sm"
          aria-expanded={bulk.open}
          onClick={() => setBulk((b) => ({ ...b, open: !b.open, none: false }))}
        >
          <Icon name="skip" size={15} />
          Skip dates…
        </button>
      </div>

      {bulk.open && (
        <Stack gap={8}>
          <div className="frm-k-row" data-row="sessions-skip" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 10 }}>
            <div style={{ flex: '1 1 150px', minWidth: 0 }}>
              {field('forms.skip_from', {
                input: 'date',
                label: 'From',
                value: bulk.from,
                onChange: (v) => setBulk((b) => ({ ...b, from: typeof v === 'string' ? v : '', none: false })),
              })}
            </div>
            <div style={{ flex: '1 1 150px', minWidth: 0 }}>
              {field('forms.skip_to', {
                input: 'date',
                label: 'To',
                value: bulk.to,
                onChange: (v) => setBulk((b) => ({ ...b, to: typeof v === 'string' ? v : '', none: false })),
              })}
            </div>
            <div style={{ flex: '0 0 auto' }}>
              <button type="button" className="frm-btn frm-btn--secondary" disabled={!bulk.from} onClick={skipRange}>
                Skip these dates
              </button>
            </div>
          </div>
          <Hint>{bulk.none ? 'No session falls between those dates.' : 'Every session from the first date to the second is skipped. Put any of them back from the list.'}</Hint>
        </Stack>
      )}

      <Hint>Titled sessions go on the series page, each with its own RSVP, when you publish. Untitled ones wait as drafts until they have a title.</Hint>
    </Stack>
  );
}
