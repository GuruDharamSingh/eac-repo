'use client';

// ============================================================================
// The Studio's Meetings kind (2026-11-01): make and edit a dated thread — a
// one-off or a repeating meeting — under the acting org. Registered by the
// host as a StudioExtension (meetingExtension in ./index.ts), like Post.
//
// The form is NOT written here. Its fields are the shared list in
// `@elkdonis/cms-ui/compose` (content-fields.ts), rendered by ContentComposer,
// the same one every org hub's compose popup uses; this file only splits it
// over the Studio's columns and converts between the form's wall-clock
// answers and the instants the save takes.
//
//   drawer    the org's meetings: upcoming, drafts, past
//   main      what and when: title, description, schedule, hosting,
//             attendance, links and rooms
//   settings  cover, where it goes, status, the page, delete
//
// No autosave: a meeting with a half-typed date is not a draft worth keeping,
// and saving one puts it on the org's calendar. "Save draft" and "Publish"
// are explicit, as in the hubs.
// ============================================================================

import * as React from 'react';
import {
  ContentComposer,
  emptyContentAnswers,
  knownTimeZone,
  localTimeZone,
  wallClockToInstant,
  type ContentFieldContext,
} from '@elkdonis/cms-ui/compose';
import { RichTextEditor } from '@elkdonis/cms-ui/editor';
import { MediaPicker } from '@elkdonis/cms-ui/files';
import { StudioColumns, StudioTopActions, StudioTopStatus, useStudioFrame } from '../frame';
import type { MeetingContextView, MeetingInputView, MeetingKindProps, MeetingRecordView, MeetingSummaryView } from './types';

type Answers = Record<string, unknown>;

const MAIN_GROUPS = ['identity', 'summary', 'schedule', 'gathering-detail', 'hosting', 'attendance', 'integrations'];
const SIDE_GROUPS = ['media', 'placement'];

// ── answers ⇄ input ──────────────────────────────────────────────────────────

function str(v: unknown): string {
  return typeof v === 'string' ? v : v == null ? '' : String(v);
}
function optStr(v: unknown): string | null {
  const s = str(v).trim();
  return s === '' ? null : s;
}
function optNum(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** `YYYY-MM-DDTHH:mm` as the wall clock in `zone` — the datetime field's format. */
function toWallClock(isoValue: string | null | undefined, zone: string): string {
  if (!isoValue) return '';
  const d = new Date(isoValue);
  if (Number.isNaN(d.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  const hour = get('hour') === '24' ? '00' : get('hour');
  return `${get('year')}-${get('month')}-${get('day')}T${hour}:${get('minute')}`;
}

function formZone(a: Answers): string {
  return knownTimeZone(optStr(a.time_zone)) ?? localTimeZone();
}

function toInput(a: Answers, kind: MeetingInputView['kind'], askHosts: boolean): MeetingInputView {
  const zone = formZone(a);
  const at = (v: unknown) => wallClockToInstant(optStr(v), zone)?.toISOString() ?? null;
  const pattern = optStr(a.recurrence_pattern);
  return {
    kind,
    title: str(a.title),
    body: str(a.body) || null,
    excerpt: optStr(a.excerpt),
    coverImageUrl: optStr(a.cover_image_url),
    timeZone: zone,
    scheduledAt: at(a.scheduled_at),
    durationMinutes: optNum(a.duration_minutes) ?? 60,
    format: (optStr(a.format) as MeetingInputView['format']) ?? 'in_person',
    location: optStr(a.location),
    recurrencePattern: !pattern || pattern === 'NONE' ? null : (pattern as MeetingInputView['recurrencePattern']),
    recurrenceUntil: at(a.recurrence_until),
    recurrenceCustomRule: optStr(a.recurrence_custom_rule),
    meetingUrl: optStr(a.meeting_url),
    videoLink: optStr(a.video_link),
    isRsvpEnabled: a.is_rsvp_enabled !== false,
    attendeeLimit: optNum(a.attendee_limit),
    rsvpDeadline: at(a.rsvp_deadline),
    minAttendees: optNum(a.min_attendees),
    notifyOnMinAttendees: a.notify_on_min_attendees === true,
    section: optStr(a.feed_slug),
    visibility: (optStr(a.visibility) as MeetingInputView['visibility']) ?? 'PUBLIC',
    shareToNetwork: a.share_to_network === true,
    createTalkRoom: a.create_talk_room === true,
    createDocument: a.create_document === true,
    // undefined = the form had no hosting fields; "" = "Nobody".
    ...(askHosts && a.host_user_id !== undefined ? { hostUserId: str(a.host_user_id) } : {}),
    ...(askHosts && a.co_host_user_id !== undefined ? { coHostUserId: str(a.co_host_user_id) } : {}),
  };
}

function toAnswers(r: MeetingRecordView, ctx: ContentFieldContext): Answers {
  const i = r.input;
  const zone = knownTimeZone(i.timeZone) ?? localTimeZone();
  const wc = (v: string | null | undefined) => toWallClock(v, zone);
  return {
    ...emptyContentAnswers('meeting', ctx),
    kind: 'meeting',
    title: i.title,
    body: i.body ?? '',
    excerpt: i.excerpt ?? '',
    cover_image_url: i.coverImageUrl ?? '',
    scheduled_at: wc(i.scheduledAt),
    time_zone: i.timeZone ?? '',
    duration_minutes: i.durationMinutes ?? 60,
    format: i.format ?? 'in_person',
    location: i.location ?? '',
    recurrence_pattern: i.recurrencePattern ?? 'NONE',
    recurrence_until: wc(i.recurrenceUntil).slice(0, 10),
    recurrence_custom_rule: i.recurrenceCustomRule ?? '',
    meeting_url: i.meetingUrl ?? '',
    video_link: i.videoLink ?? '',
    is_rsvp_enabled: i.isRsvpEnabled ?? true,
    attendee_limit: i.attendeeLimit ?? undefined,
    rsvp_deadline: wc(i.rsvpDeadline),
    min_attendees: i.minAttendees ?? undefined,
    notify_on_min_attendees: Boolean(i.notifyOnMinAttendees),
    feed_slug: i.section ?? ctx.feeds?.[0]?.slug,
    visibility: i.visibility ?? 'PUBLIC',
    share_to_network: Boolean(i.shareToNetwork),
    create_talk_room: Boolean(i.createTalkRoom),
    create_document: Boolean(i.createDocument),
    ...(i.hostUserId !== undefined ? { host_user_id: i.hostUserId } : {}),
    ...(i.coHostUserId !== undefined ? { co_host_user_id: i.coHostUserId } : {}),
  };
}

function fieldContext(c: MeetingContextView | null): ContentFieldContext {
  if (!c) return {};
  return {
    feeds: c.feeds,
    hostCandidates: c.hostCandidates,
    canCreateTalkRoom: c.canCreateTalkRoom,
    canCreateDocument: c.canCreateDocument,
    canShareToNetwork: c.canShareToNetwork,
  };
}

// ── list ─────────────────────────────────────────────────────────────────────

function fmtWhen(isoValue: string | null): string {
  if (!isoValue) return 'No date';
  return new Date(isoValue).toLocaleString('en-CA', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

const REPEAT_LABEL: Record<string, string> = { DAILY: 'daily', WEEKLY: 'weekly', MONTHLY: 'monthly', CUSTOM: 'repeats' };
const STATUS_LABEL: Record<string, string> = { draft: 'Draft', pending: 'Waiting for a look', published: 'Published' };

function sections(list: MeetingSummaryView[]) {
  const now = Date.now();
  const drafts: MeetingSummaryView[] = [];
  const upcoming: MeetingSummaryView[] = [];
  const past: MeetingSummaryView[] = [];
  for (const m of list) {
    if (m.status !== 'published') drafts.push(m);
    else if (m.recurrencePattern || !m.scheduledAt || Date.parse(m.scheduledAt) >= now - 3 * 36e5) upcoming.push(m);
    else past.push(m);
  }
  upcoming.sort((a, b) => Date.parse(a.scheduledAt ?? '') - Date.parse(b.scheduledAt ?? ''));
  return [
    { id: 'upcoming', label: 'Coming up', items: upcoming },
    { id: 'drafts', label: 'Drafts', items: drafts },
    { id: 'past', label: 'Past', items: past },
  ].filter((s) => s.items.length > 0);
}

// ── the kind ─────────────────────────────────────────────────────────────────

type Current = { id: string | null; record: MeetingRecordView | null };

export function MeetingKind(props: MeetingKindProps) {
  const frame = useStudioFrame();
  const { actions, uploadEndpoint, libraryEndpoint } = props;
  const orgId = frame.orgId;
  const setError = frame.setError;
  const orgSlug = frame.orgs.find((o) => o.orgId === orgId)?.slug ?? orgId;

  const [list, setList] = React.useState<MeetingSummaryView[]>(props.initialOrgId === orgId ? props.initialMeetings : []);
  const [ctx, setCtx] = React.useState<MeetingContextView | null>(props.initialOrgId === orgId ? props.initialContext : null);
  const [current, setCurrent] = React.useState<Current | null>(null);
  const [answers, setAnswers] = React.useState<Answers>({});
  const [dirty, setDirty] = React.useState(false);
  const [busy, setBusy] = React.useState<null | 'draft' | 'published' | 'loading'>(null);
  const [notes, setNotes] = React.useState<string[]>([]);

  const fctx = React.useMemo(() => fieldContext(ctx), [ctx]);
  const askHosts = (ctx?.hostCandidates.length ?? 0) > 0;

  // The list and what may be made follow the acting org.
  const loadedFor = React.useRef<string | null>(props.initialOrgId === orgId ? orgId : null);
  React.useEffect(() => {
    if (loadedFor.current === orgId) return;
    loadedFor.current = orgId;
    setCurrent(null);
    setDirty(false);
    setNotes([]);
    Promise.all([actions.context(orgId), actions.listMeetings(orgId)])
      .then(([c, l]) => {
        setCtx(c);
        setList(l);
      })
      .catch(() => setError('Could not load the meetings.'));
  }, [orgId, actions, setError]);

  // `?kind=meeting&id=…` opens that one.
  const opened = React.useRef(false);
  React.useEffect(() => {
    if (opened.current || !props.initialMeetingId) return;
    opened.current = true;
    void open(props.initialMeetingId);
  }, [props.initialMeetingId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Unsaved changes survive a misclick on the tab close, not a deliberate leave.
  React.useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function leaveOk(): boolean {
    return !dirty || window.confirm('Leave this meeting without saving your changes?');
  }

  async function open(id: string) {
    if (!leaveOk()) return;
    setBusy('loading');
    setNotes([]);
    const r = await actions.loadMeeting(id).catch(() => null);
    setBusy(null);
    if (!r) return setError('That meeting could not be opened.');
    setCurrent({ id: r.id, record: r });
    setAnswers(toAnswers(r, fctx));
    setDirty(false);
  }

  function newMeeting() {
    if (!ctx?.canEdit) return setError(ctx?.reason ?? 'Meetings cannot be made here.');
    if (!leaveOk()) return;
    setCurrent({ id: null, record: null });
    setAnswers({ ...emptyContentAnswers('meeting', fctx), time_zone: localTimeZone() });
    setDirty(false);
    setNotes([]);
  }

  function change(next: Answers) {
    setAnswers(next);
    setDirty(true);
  }

  async function save(intent: 'draft' | 'published') {
    if (!current) return;
    const kind = current.record?.input.kind ?? 'meeting';
    setBusy(intent);
    setNotes([]);
    const r = await actions
      .saveMeeting(orgId, toInput(answers, kind, askHosts), intent, current.id)
      .catch(() => ({ ok: false as const, error: 'Could not reach the server.' }));
    setBusy(null);
    if (r.ok === false) return setError(r.error);
    const rec = r.value.record;
    setCurrent({ id: rec.id, record: rec });
    setAnswers(toAnswers(rec, fctx));
    setDirty(false);
    setNotes([
      rec.status === 'pending' ? 'Sent for a look: an owner or guide publishes it.' : rec.status === 'published' ? 'Published.' : 'Saved as a draft.',
      ...r.value.warnings,
    ]);
    setList((l) => [rec, ...l.filter((m) => m.id !== rec.id)]);
  }

  async function remove() {
    if (!current?.id || !window.confirm('Remove this meeting? It comes off the site and the calendar.')) return;
    const r = await actions.removeMeeting(current.id).catch(() => ({ ok: false as const, error: 'Could not reach the server.' }));
    if (r.ok === false) return setError(r.error);
    setList((l) => l.filter((m) => m.id !== current.id));
    setCurrent(null);
    setDirty(false);
  }

  const slots = React.useMemo(
    () => ({
      body: ({ value, onChange }: { value: string; onChange: (html: string) => void }) => (
        <RichTextEditor value={value} onChange={onChange} toolbar="full" placeholder="What happens, who it is for, what to bring." />
      ),
      media: ({ value, onChange, label, hint }: { value: unknown; onChange: (v: unknown) => void; label?: string; hint?: string }) => (
        <MediaPicker
          value={typeof value === 'string' ? value : undefined}
          onChange={onChange}
          uploadEndpoint={uploadEndpoint}
          libraryEndpoint={libraryEndpoint ? libraryEndpoint.replace(':org', encodeURIComponent(orgSlug)) : undefined}
          uploadFields={{ orgSlug, context: 'content' }}
          label={label ?? 'Cover image'}
          hint={hint}
        />
      ),
    }),
    [uploadEndpoint, libraryEndpoint, orgSlug]
  );

  const rec = current?.record ?? null;
  const isSeries = Boolean(rec?.isSeries);
  const published = rec?.status === 'published';

  const drawer = (
    <>
      <div className="studio-panel__h">
        <span>Meetings</span>
        {ctx?.canEdit && (
          <button type="button" className="studio-btn studio-btn--primary" onClick={newMeeting}>
            New
          </button>
        )}
      </div>
      {list.length === 0 ? (
        <p className="studio-hint">{ctx?.canEdit ? 'Nothing on the calendar here yet.' : (ctx?.reason ?? '')}</p>
      ) : (
        sections(list).map((s) => (
          <div key={s.id} className="sm-section">
            <p className="sm-section__h">{s.label}</p>
            <div className="studio-list">
              {s.items.map((m) => (
                <button key={m.id} type="button" className={`sp-row ${current?.id === m.id ? 'is-current' : ''}`} onClick={() => void open(m.id)}>
                  {m.coverImageUrl ? <img src={m.coverImageUrl} alt="" /> : <span className="sp-row__noimg" aria-hidden>◷</span>}
                  <span className="sp-row__text">
                    <span className="sp-row__title">{m.title || 'Untitled'}</span>
                    <span className="sp-row__meta">
                      {m.isSeries ? 'Series · ' : ''}
                      {fmtWhen(m.scheduledAt)}
                      {m.recurrencePattern && !m.isSeries ? ` · ${REPEAT_LABEL[m.recurrencePattern] ?? 'repeats'}` : ''}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))
      )}
    </>
  );

  let main: React.ReactNode;
  if (!current) {
    main = (
      <div className="sp-empty">
        <p>
          A meeting or event on {frame.orgs.find((o) => o.orgId === orgId)?.name ?? 'this organisation'}&rsquo;s site and calendar: when and
          where, who is hosting, RSVPs, a joining link or a Talk room.
        </p>
        {ctx?.canEdit ? (
          <button type="button" className="studio-btn studio-btn--primary" onClick={newMeeting}>
            New meeting
          </button>
        ) : (
          <p className="studio-hint">{ctx?.reason}</p>
        )}
      </div>
    );
  } else if (isSeries) {
    main = (
      <div className="sm-main">
        <h2 className="sm-title">{rec?.title}</h2>
        <p>
          This is a weekly series. Its weeks, hosts and letters are planned in the series planner, where moving the schedule moves the weeks
          already planned with it, so it is not edited here.
        </p>
        {rec?.href && (
          <a className="studio-btn" href={rec.href} target="_blank" rel="noreferrer">
            Open its page
          </a>
        )}
      </div>
    );
  } else {
    main = (
      <div className="sm-main" aria-busy={busy === 'loading'}>
        <ContentComposer kind="meeting" context={fctx} answers={answers} onChange={change} slots={slots} groups={MAIN_GROUPS} />
      </div>
    );
  }

  const settings =
    current && !isSeries ? (
      <>
        <div className="studio-panel__h">
          <span>{rec ? (STATUS_LABEL[rec.status] ?? rec.status) : 'Not saved yet'}</span>
        </div>
        {notes.length > 0 && (
          <div className="sm-notes" role="status">
            {notes.map((n, i) => (
              <p key={i} className="studio-hint">
                {n}
              </p>
            ))}
          </div>
        )}
        <div className="sm-side">
          <ContentComposer kind="meeting" context={fctx} answers={answers} onChange={change} slots={slots} groups={SIDE_GROUPS} />
        </div>
        {rec && (
          <>
            <div className="studio-panel__h">
              <span>Its page</span>
            </div>
            {rec.href && published ? (
              <a className="studio-addr" href={rec.href} target="_blank" rel="noreferrer">
                {rec.href.replace(/^https?:\/\//, '')}
              </a>
            ) : (
              <p className="studio-hint">Shown on the site once it is published.</p>
            )}
            {rec.talkToken && <p className="studio-hint">Has a Talk room.</p>}
            {rec.documentUrl && (
              <a className="studio-hint" href={rec.documentUrl} target="_blank" rel="noreferrer">
                Its shared document
              </a>
            )}
            <div className="studio-history">
              <div>
                <span>Updated</span>
                <span>{fmtWhen(rec.updatedAt)}</span>
              </div>
              <div>
                <span>Created</span>
                <span>{fmtWhen(rec.createdAt)}</span>
              </div>
            </div>
            <button type="button" className="studio-btn studio-btn--dangertext" onClick={() => void remove()}>
              Remove this meeting
            </button>
          </>
        )}
      </>
    ) : null;

  const status = busy === 'loading' ? 'Opening…' : busy ? 'Saving…' : current && !isSeries ? (dirty ? 'Unsaved changes' : rec ? 'Saved' : 'New') : '';

  return (
    <>
      <StudioTopStatus>{status}</StudioTopStatus>
      <StudioTopActions>
        {current && !isSeries ? (
          <>
            <button type="button" className="studio-btn" disabled={Boolean(busy)} onClick={() => void save('draft')}>
              {published ? 'Unpublish' : 'Save draft'}
            </button>
            <button type="button" className="studio-btn studio-btn--primary" disabled={Boolean(busy)} onClick={() => void save('published')}>
              {busy === 'published' ? 'Publishing…' : published ? 'Update' : 'Publish'}
            </button>
          </>
        ) : ctx?.canEdit ? (
          <button type="button" className="studio-btn studio-btn--primary" onClick={newMeeting}>
            New meeting
          </button>
        ) : null}
      </StudioTopActions>
      <StudioColumns drawer={drawer} main={main} settings={settings} wideSettings />
    </>
  );
}
