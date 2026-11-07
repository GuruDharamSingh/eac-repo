"use client";

import * as React from "react";
import { SurfaceFrame, fmtDateTime, fmtShortDate, useSurface } from "../surface";
import { CoverField, MediaPicker, coverFrameStyle, type CoverFrame, type CoverValue } from "../files";
import { RichTextEditor } from "../editor";

/**
 * The planner for a meeting series: one form per coming week, so the person
 * hosting a given week can say what it is, write it up and attach what to
 * look at, and an organiser can see which weeks still have nobody.
 *
 * Reads and writes one endpoint (`/api/hub/series` by default) that the host
 * app backs with `getMeetingSeries` / `saveSeriesSession` / the rota writers
 * from @elkdonis/services. An organiser assigns hosts and writes any week;
 * a host writes and publishes the week they host and may step down from it
 * (2026-10-10: only organisers assign). A week is a draft until it has a
 * title and is published; drafts stay off the public pages. The server
 * decides; `canPlan` only shapes what is shown.
 */

export interface SeriesPlannerPerson {
  userId: string | null;
  displayName: string | null;
}

export interface SeriesPlannerMaterial {
  id: string;
  name: string;
  url: string;
  kind: "image" | "video" | "audio" | "document";
  external?: boolean;
}

export interface SeriesPlannerWeek {
  at: string;
  number: number;
  isPast: boolean;
  isNext: boolean;
  title: string | null;
  /** Optional line under the title (2026-10-13). */
  subtitle?: string | null;
  /** Plain text of the write-up; the only write-up of weeks saved before 2026-10-13. */
  summary: string | null;
  /** The write-up as rich text, sanitised by the server. */
  bodyHtml?: string | null;
  coverImageUrl: string | null;
  /** How the cover sits in its box; null = centred. */
  coverFrame?: CoverFrame | null;
  /** What the cover is (2026-10-18): a picture, a video file, or a YouTube/Vimeo link. */
  coverKind?: "image" | "video" | "embed";
  /** A video's still. */
  coverPosterUrl?: string | null;
  materials: SeriesPlannerMaterial[];
  host: SeriesPlannerPerson | null;
  coHost: SeriesPlannerPerson | null;
  rsvpCount: number;
  /** Has a title and has been published; otherwise a draft, off the public pages. */
  isPublished?: boolean;
  publishedAt?: string | null;
  /** The week's own public page, where its host can also edit it. */
  href?: string | null;
  /** The rule slot the week belongs to; differs from `at` when it was moved. */
  slotAt?: string | null;
  /** Cancelled: off the public pages and out of reminders until restored. */
  isCancelled?: boolean;
  isMoved?: boolean;
  /** Left behind by a schedule change; not public. */
  isOffSchedule?: boolean;
}

/** When the series meets, in its own zone. */
export interface SeriesPlannerSchedule {
  /** 0 = Sunday … 6 = Saturday. */
  weekday: number;
  /** "HH:MM", 24-hour. */
  time: string;
  timeZone: string;
  /** "YYYY-MM-DD" */
  firstDate: string;
  lastDate: string | null;
  durationMinutes: number;
  /** Zones the public pages print the time in. */
  alsoZones: string[] | null;
  /** Meets every n weeks (1 = weekly; 2026-10-18). */
  intervalWeeks?: number;
  /** The same weekday of each month (2026-11-02); `intervalWeeks` is then ignored. */
  monthly?: boolean;
}

/** The series' cover: a picture, an uploaded video, or a YouTube/Vimeo page ("embed"). */
export interface SeriesPlannerCover {
  url: string;
  kind: "image" | "video" | "embed";
  posterUrl?: string | null;
  frame?: CoverFrame | null;
}

/**
 * Series-level settings. The joining fields come back only to organisers;
 * an endpoint that omits `settings` hides the form.
 */
export interface SeriesPlannerSettings {
  title: string;
  lede: string | null;
  /** The thread's own excerpt, shown as the lede's placeholder. */
  excerpt?: string | null;
  /** Shown under the title on the series page and on the series' card (2026-10-13). */
  cover?: SeriesPlannerCover | null;
  /** "About the series", rich text (the thread's body), sanitised by the server. */
  bodyHtml?: string | null;
  /** The series' colour id on the public Series page (2026-10-18); one of `accents`. */
  accent?: string | null;
  /** Listed on the Series page. */
  listed?: boolean;
  /** In the landing page's slides (2026-10-18; absent = as `listed`). */
  landing?: boolean;
  /** First on the Series page and the landing page. */
  featured?: boolean;
  /** The colours offered: `color` marks (dot, edge), `text` labels on the dark public page. */
  accents?: Array<{ id: string; label: string; color: string; text?: string }>;
  /** The card's rhythm line in the organiser's words; null = from the schedule. */
  rhythm?: string | null;
  /** Whether the card shows its status label ("Running", "Starts 5 Nov"). */
  statusChip?: "auto" | "hide";
  /** The series' recurrence (WEEKLY, MONTHLY…), for the automatic rhythm line. */
  recurrencePattern?: string | null;
  joinUrl?: string | null;
  meetingId?: string | null;
  passcode?: string | null;
  otherWaysToJoin?: string | null;
  /** "link": a pasted join link; "talk": the series' Talk room. */
  joinMode?: "link" | "talk";
  /** The Talk room's link, once there is one. */
  talkUrl?: string | null;
  /** Days before each published week that subscribers are emailed; 0 = off. */
  reminderDays?: number;
  schedule?: SeriesPlannerSchedule | null;
  /** The zone a new series should default to (the host's own). */
  defaultTimeZone?: string;
}

export interface SeriesPlannerData {
  id: string;
  slug: string;
  title: string;
  timeZone: string | null;
  href?: string | null;
  settings?: SeriesPlannerSettings;
  weeks: SeriesPlannerWeek[];
  candidates: Array<{ userId: string; displayName: string }>;
  canPlan: boolean;
  viewerId?: string | null;
}

/** One person of the series, as the host's people endpoint returns them (`listSeriesPeople`). */
export interface SeriesPlannerPersonRow {
  userId: string;
  name: string;
  email: string;
  subscribed: boolean;
  weeksComing: number;
  weeksHosting: number;
  firstSeen: string | null;
  lastWeekAt: string | null;
  /** The address is unsubscribed from the org's own mail (`contacts`). */
  orgUnsubscribed: boolean;
}

export interface SeriesPlannerPeople {
  seriesId: string;
  slug: string;
  title: string;
  counts: { people: number; subscribed: number; coming: number; hosts: number; orgUnsubscribed: number };
  people: SeriesPlannerPersonRow[];
}

/**
 * Email figures, as the host's stats endpoint returns them
 * (`getSeriesEmailStats` in @elkdonis/services; mirrored here because
 * cms-ui does not import services). 2026-10-10.
 */
export interface SeriesPlannerEmailTracking {
  sent: number;
  sandboxed: number;
  failed: number;
  complained: number;
  delivered: number;
  opened: number;
  clicked: number;
  /** Rows with at least one SendGrid event. */
  withEvents: number;
}

export type SeriesPlannerLetterKind =
  | "confirmation"
  | "host-notice"
  | "attendee-reminder"
  | "subscriber-letter"
  | "host-reminder"
  | "series-letters"
  | "mailing"
  | "other";

export interface SeriesPlannerEmailLine {
  letter: SeriesPlannerLetterKind;
  /** "sends": `count` is ledger rows (one per recipient); "reminders": recipients from the reminder ledger. */
  source: "sends" | "reminders";
  count: number;
  tracking: SeriesPlannerEmailTracking | null;
  parts: Array<{ kind: string; count: number }>;
  lastAt: string | null;
}

export interface SeriesPlannerSessionStats {
  topicThreadId: string | null;
  number: number | null;
  at: string;
  slotAt: string | null;
  state: "published" | "draft" | "cancelled" | "removed" | "unknown";
  title: string | null;
  coming: number;
  emails: number;
  lines: SeriesPlannerEmailLine[];
  tracking: SeriesPlannerEmailTracking;
  lastAt: string | null;
}

export interface SeriesPlannerEmailStats {
  seriesId: string;
  slug: string;
  title: string;
  generatedAt: string;
  measurement: { orgEvents: number; seriesEvents: number };
  overall: {
    subscribers: number;
    emails: number;
    lines: SeriesPlannerEmailLine[];
    tracking: SeriesPlannerEmailTracking;
    lastEmailAt: string | null;
    mailings: {
      drafts: number;
      sent: number;
      recipients: number;
      list: Array<{ slug: string; title: string; sentAt: string | null; sentCount: number }>;
    };
  };
  sessions: SeriesPlannerSessionStats[];
}

const DEFAULT_ENDPOINT = "/api/hub/series";

type PlannerTab = "weeks" | "manage" | "new";

export function SeriesPlannerSurface({
  threadId,
  canPlan = false,
  endpoint = DEFAULT_ENDPOINT,
  uploadEndpoint = "/api/media/upload",
  libraryEndpoint = "/api/media/library",
  timeZone,
  peopleEndpoint,
  statsEndpoint,
  emailsHref,
  mailingsHref,
  createEndpoint,
  onCreated,
}: {
  threadId: string;
  canPlan?: boolean;
  endpoint?: string;
  uploadEndpoint?: string;
  libraryEndpoint?: string;
  timeZone?: string;
  /**
   * GET `?threadId=` returning `SeriesPlannerPeople`, and `&format=csv` for
   * the download. Optional: without it the planner shows no tabs, as before
   * (2026-10-10). IFAC: `/api/hub/series/people`.
   */
  peopleEndpoint?: string;
  /**
   * GET `?threadId=` returning `SeriesPlannerEmailStats`. Optional: without
   * it the Manage tab shows only the email list. IFAC: `/api/hub/series/stats`.
   */
  statsEndpoint?: string;
  /** Where this series' letters are edited; the link is left out when absent. */
  emailsHref?: string;
  /** Where a mailing to the series' subscribers is written; left out when absent. */
  mailingsHref?: string;
  /**
   * POST endpoint that starts a new series (organisers). Given, the planner
   * gains a "+ New series" tab (2026-10-18); IFAC: `/api/hub/series/new`.
   */
  createEndpoint?: string;
  /** Called with the new series' thread id once it exists; a page goes to its planner. */
  onCreated?: (id: string) => void;
}) {
  const surfaces = useSurface();
  const [tab, setTab] = React.useState<PlannerTab>("weeks");
  const [data, setData] = React.useState<SeriesPlannerData | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);
  const tz = { timeZone: timeZone ?? data?.timeZone ?? undefined };

  const load = React.useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`${endpoint}?threadId=${encodeURIComponent(threadId)}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "Could not load the series.");
        return;
      }
      setData(body as SeriesPlannerData);
    } catch {
      setError("Could not reach the server.");
    }
  }, [endpoint, threadId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function post(payload: Record<string, unknown>, failure: string): Promise<boolean> {
    setStatus("Saving…");
    setError(null);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ threadId, ...payload }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? failure);
        setStatus(null);
        return false;
      }
      setStatus("Saved");
      window.setTimeout(() => setStatus((s) => (s === "Saved" ? null : s)), 1500);
      await load();
      surfaces.connectors.onMutated?.();
      return true;
    } catch {
      setError("Could not reach the server.");
      setStatus(null);
      return false;
    }
  }

  /** A POST that reports its body and changes nothing on screen (the schedule's dry run). */
  async function ask(payload: Record<string, unknown>): Promise<{ ok: boolean; body: Record<string, unknown> }> {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ threadId, ...payload }),
      });
      const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      return { ok: res.ok, body };
    } catch {
      return { ok: false, body: { error: "Could not reach the server." } };
    }
  }

  /**
   * "+ New series": POST the name and schedule to the creation endpoint, which
   * makes the series; then save the rest of the form (description, about,
   * cover, colour, listing, joining…) through the planner's own endpoint, on
   * the new series' id, and hand the id to the host.
   */
  async function createSeries(createUrl: string, settings: Record<string, unknown>, schedule: Record<string, unknown>): Promise<boolean> {
    setStatus("Creating the series…");
    setError(null);
    try {
      const res = await fetch(createUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: settings.title, lede: settings.lede ?? "", ...schedule }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.id) {
        setError(body.error ?? "Could not start the series.");
        setStatus(null);
        return false;
      }
      const id = String(body.id);
      const rest = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ threadId: id, settings }),
      });
      if (!rest.ok) {
        const b = await rest.json().catch(() => ({}));
        setError(`The series exists, but its settings were not all saved: ${b.error ?? "try again in its planner"}.`);
      }
      setStatus("Created");
      onCreated?.(id);
      return true;
    } catch {
      setError("Could not reach the server.");
      setStatus(null);
      return false;
    }
  }

  const editable = data ? data.canPlan : canPlan;
  const viewerId = data?.viewerId ?? null;
  const weeks = data?.weeks ?? [];
  const open = weeks.filter((w) => !w.isPast && !w.host).length;
  const drafts = weeks.filter((w) => !w.isPast && w.isPublished === false).length;
  // Tabs only for organisers, and only when the host serves the people list
  // or the creation endpoint ("+ New series").
  const plannerTabs = React.useMemo(() => {
    const t: Array<{ id: PlannerTab; label: string; accent?: boolean }> = [{ id: "weeks", label: "Sessions" }];
    if (peopleEndpoint) t.push({ id: "manage", label: "Manage" });
    if (createEndpoint) t.push({ id: "new", label: "+ New series", accent: true });
    return t;
  }, [peopleEndpoint, createEndpoint]);
  const showTabs = Boolean(data) && editable && plannerTabs.length > 1;
  const tabIds = React.useId();
  const pastCount = weeks.filter((w) => w.isPast).length;
  const comingCount = weeks.length - pastCount;

  const weeksUi = (
    <>
      {!data && !error && <p className="eac-rota-intro">Loading the weeks…</p>}
      {data && (
        <p className="eac-rota-intro">
          Each session has a host, a title, a short write-up and the materials to look at before. A session shows on the
          public page once it has a title and is published.
          {editable && open > 0 ? ` ${open} coming ${open === 1 ? "session has" : "sessions have"} nobody yet.` : ""}
          {editable && drafts > 0 ? ` ${drafts} coming ${drafts === 1 ? "session is a draft" : "sessions are drafts"}.` : ""}
        </p>
      )}
      {editable && data?.settings && (
        <SeriesSettingsForm
          settings={data.settings}
          weeks={weeks}
          uploadEndpoint={uploadEndpoint}
          libraryEndpoint={libraryEndpoint}
          onSave={(settings) => post({ settings }, "Could not save the series settings.")}
          onSchedule={(schedule, dryRun) =>
            dryRun ? ask({ schedule, dryRun: true }) : post({ schedule }, "Could not change the schedule.").then((ok) => ({ ok, body: {} }))
          }
          onCreateTalk={() => post({ createTalkRoom: true }, "Could not make the Talk room.")}
        />
      )}
      {data && weeks.length > 0 && (
        <h3 className="eac-series__sessions-label">
          Sessions
          <span>
            {pastCount > 0 ? `${pastCount} past · ` : ""}
            {comingCount} coming
          </span>
        </h3>
      )}
      <ol className="eac-series">
        {weeks.map((w) => {
          const isHost = Boolean(viewerId) && (w.host?.userId === viewerId || w.coHost?.userId === viewerId);
          const canWrite = editable || isHost;
          return (
            <WeekForm
              key={w.at}
              week={w}
              tz={tz}
              editable={editable}
              canWrite={canWrite}
              viewerId={viewerId}
              candidates={data?.candidates ?? []}
              uploadEndpoint={uploadEndpoint}
              libraryEndpoint={libraryEndpoint}
              uploadFields={{ threadId, occurrenceAt: w.at }}
              onAssign={(role, userId) =>
                post({ occurrenceAt: w.at, role, userId }, "Could not change the host.")
              }
              onSave={(fields) => post({ occurrenceAt: w.at, ...fields }, "Could not save the week.")}
              onPublish={(published) =>
                post({ occurrenceAt: w.at, publish: published }, published ? "Could not publish the week." : "Could not unpublish the week.")
              }
              onCancel={(cancel) =>
                post({ occurrenceAt: w.at, cancel }, cancel ? "Could not cancel the week." : "Could not restore the week.")
              }
              onMove={(moveTo) => post({ occurrenceAt: w.at, moveTo }, "Could not move the week.")}
              seriesZone={data?.timeZone ?? "UTC"}
            />
          );
        })}
      </ol>
    </>
  );

  return (
    <SurfaceFrame
      kind="meeting"
      kicker="Series planner"
      title={data?.title ?? "Series"}
      status={error ?? status}
      statusTone={error ? "error" : "normal"}
      actions={data?.href ? [{ label: "Open the series page", href: data.href, external: true, quiet: true }] : undefined}
    >
      {showTabs && data ? (
        <>
          <TabStrip<PlannerTab> tabs={plannerTabs} label="Planner" idBase={tabIds} active={tab} onChange={setTab} />
          {/* The weeks stay mounted while hidden, so an unsaved week survives a look at Manage. */}
          <div role="tabpanel" id={`${tabIds}-weeks-panel`} aria-labelledby={`${tabIds}-weeks-tab`} hidden={tab !== "weeks"}>
            {weeksUi}
          </div>
          {tab === "manage" && peopleEndpoint && (
            <div role="tabpanel" id={`${tabIds}-manage-panel`} aria-labelledby={`${tabIds}-manage-tab`}>
              <SeriesManagePanel
                threadId={threadId}
                peopleEndpoint={peopleEndpoint}
                statsEndpoint={statsEndpoint}
                emailsHref={emailsHref}
                mailingsHref={mailingsHref}
                tz={tz}
              />
            </div>
          )}
          {tab === "new" && createEndpoint && (
            <div role="tabpanel" id={`${tabIds}-new-panel`} aria-labelledby={`${tabIds}-new-tab`}>
              <SeriesSettingsForm
                settings={{
                  title: "",
                  lede: null,
                  excerpt: null,
                  cover: null,
                  bodyHtml: null,
                  accent: null,
                  listed: false,
                  landing: false,
                  featured: false,
                  accents: data.settings?.accents,
                  rhythm: null,
                  statusChip: "auto",
                  recurrencePattern: "WEEKLY",
                  joinMode: "link",
                  reminderDays: 2,
                }}
                weeks={[]}
                uploadEndpoint={uploadEndpoint}
                libraryEndpoint={libraryEndpoint}
                onSave={async () => false}
                onSchedule={async () => ({ ok: false, body: {} })}
                onCreateTalk={async () => false}
                create={{
                  defaultZone: data.settings?.defaultTimeZone ?? data.timeZone ?? "America/New_York",
                  onCreate: ({ settings, schedule }) => createSeries(createEndpoint, settings, schedule),
                }}
              />
            </div>
          )}
        </>
      ) : (
        weeksUi
      )}
    </SurfaceFrame>
  );
}

const PLANNER_TABS: Array<{ id: PlannerTab; label: string }> = [
  { id: "weeks", label: "Sessions" },
  { id: "manage", label: "Manage" },
];

/**
 * A row of tabs (the WAI-ARIA tabs pattern; arrow keys, Home and End move
 * between them). Panels use the ids `${idBase}-${id}-panel` and are labelled
 * by `${idBase}-${id}-tab`. `sub` draws the smaller row used inside Manage.
 */
function TabStrip<T extends string>({
  tabs,
  label,
  idBase,
  active,
  onChange,
  sub = false,
}: {
  tabs: Array<{ id: T; label: string; accent?: boolean }>;
  label: string;
  idBase: string;
  active: T;
  onChange: (t: T) => void;
  sub?: boolean;
}) {
  const refs = React.useRef<Array<HTMLButtonElement | null>>([]);
  function onKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, i: number) {
    const last = tabs.length - 1;
    const next =
      e.key === "ArrowRight" ? (i === last ? 0 : i + 1)
      : e.key === "ArrowLeft" ? (i === 0 ? last : i - 1)
      : e.key === "Home" ? 0
      : e.key === "End" ? last
      : null;
    if (next === null) return;
    e.preventDefault();
    onChange(tabs[next].id);
    refs.current[next]?.focus();
  }
  return (
    <div className={`eac-series-tabs${sub ? " eac-series-tabs--sub" : ""}`} role="tablist" aria-label={label}>
      {tabs.map((t, i) => {
        const selected = t.id === active;
        return (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`${idBase}-${t.id}-tab`}
            aria-selected={selected}
            aria-controls={`${idBase}-${t.id}-panel`}
            tabIndex={selected ? 0 : -1}
            className={`eac-series-tabs__tab${selected ? " is-active" : ""}${t.accent ? " eac-series-tabs__tab--new" : ""}`}
            onClick={() => onChange(t.id)}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

type ManageTab = "list" | "sessions" | "overall";

/**
 * The planner's "Manage" tab (2026-10-10): the series' email list, its
 * letters per week, and its email figures overall, with links to the
 * series' letters and mailings. Organisers only; the endpoints enforce it.
 * Sessions and Overall appear only when the host passes `statsEndpoint`.
 * All three panels stay mounted once opened, so switching does not refetch.
 */
function SeriesManagePanel({
  threadId,
  peopleEndpoint,
  statsEndpoint,
  emailsHref,
  mailingsHref,
  tz,
}: {
  threadId: string;
  peopleEndpoint: string;
  statsEndpoint?: string;
  emailsHref?: string;
  mailingsHref?: string;
  tz: { timeZone?: string };
}) {
  const [tab, setTab] = React.useState<ManageTab>("list");
  const idBase = React.useId();
  const tabs: Array<{ id: ManageTab; label: string }> = statsEndpoint
    ? [
        { id: "list", label: "Email list" },
        { id: "sessions", label: "Sessions" },
        { id: "overall", label: "Overall" },
      ]
    : [{ id: "list", label: "Email list" }];
  const stats = useSeriesStats(statsEndpoint, threadId);

  return (
    <div className="eac-series-manage">
      {(emailsHref || mailingsHref) && (
        <nav className="eac-rota__record-actions eac-series-manage__links" aria-label="This series' email">
          {emailsHref && (
            <a className="eac-face-tool" href={emailsHref}>
              Edit this series&apos; letters
            </a>
          )}
          {mailingsHref && (
            <a className="eac-face-tool" href={mailingsHref}>
              Write a mailing to subscribers
            </a>
          )}
        </nav>
      )}
      {tabs.length > 1 && <TabStrip<ManageTab> tabs={tabs} label="Manage" idBase={idBase} active={tab} onChange={setTab} sub />}
      <div
        role={tabs.length > 1 ? "tabpanel" : undefined}
        id={`${idBase}-list-panel`}
        aria-labelledby={tabs.length > 1 ? `${idBase}-list-tab` : undefined}
        hidden={tab !== "list"}
      >
        <SeriesPeoplePanel threadId={threadId} endpoint={peopleEndpoint} tz={tz} />
      </div>
      {statsEndpoint && (
        <>
          <div role="tabpanel" id={`${idBase}-sessions-panel`} aria-labelledby={`${idBase}-sessions-tab`} hidden={tab !== "sessions"}>
            <StatsGate stats={stats}>{(s) => <SeriesSessionsStats stats={s} tz={tz} />}</StatsGate>
          </div>
          <div role="tabpanel" id={`${idBase}-overall-panel`} aria-labelledby={`${idBase}-overall-tab`} hidden={tab !== "overall"}>
            <StatsGate stats={stats}>
              {(s) => <SeriesOverallStats stats={s} tz={tz} mailingsHref={mailingsHref} />}
            </StatsGate>
          </div>
        </>
      )}
    </div>
  );
}

type StatsState = { data: SeriesPlannerEmailStats | null; problem: string | null };

/** Reads the stats endpoint once per mount of the Manage tab. */
function useSeriesStats(endpoint: string | undefined, threadId: string): StatsState {
  const [state, setState] = React.useState<StatsState>({ data: null, problem: null });
  React.useEffect(() => {
    if (!endpoint) return;
    let live = true;
    (async () => {
      try {
        const res = await fetch(`${endpoint}?threadId=${encodeURIComponent(threadId)}`, { cache: "no-store" });
        const body = await res.json().catch(() => ({}));
        if (!live) return;
        if (!res.ok) {
          setState({ data: null, problem: body.error ?? "Could not load the email figures." });
          return;
        }
        setState({ data: body as SeriesPlannerEmailStats, problem: null });
      } catch {
        if (live) setState({ data: null, problem: "Could not reach the server." });
      }
    })();
    return () => {
      live = false;
    };
  }, [endpoint, threadId]);
  return state;
}

function StatsGate({ stats, children }: { stats: StatsState; children: (s: SeriesPlannerEmailStats) => React.ReactNode }) {
  if (stats.problem) return <p className="eac-series__hint" role="alert">{stats.problem}</p>;
  if (!stats.data) return <p className="eac-rota-intro">Loading the email figures…</p>;
  return <>{children(stats.data)}</>;
}

const LETTER_LABEL: Record<SeriesPlannerLetterKind, [string, string]> = {
  confirmation: ["confirmation", "confirmations"],
  "host-notice": ["host notice", "host notices"],
  "attendee-reminder": ["attendee reminder", "attendee reminders"],
  "subscriber-letter": ["subscriber letter", "subscriber letters"],
  "host-reminder": ["host reminder", "host reminders"],
  "series-letters": ["series letter", "series letters"],
  mailing: ["mailing copy", "mailing copies"],
  other: ["other letter", "other letters"],
};

/** What each overall line is, for the Overall table's note column. */
const LETTER_NOTE: Record<SeriesPlannerLetterKind, string> = {
  confirmation: "To each person who says they are coming to a week.",
  "host-notice": "To the week's hosts (or the owner address) when someone says they are coming.",
  "attendee-reminder": "To the people coming, the day before and shortly before.",
  "subscriber-letter": "To subscribers, before each published week.",
  "host-reminder": "To the week's host and co-host, within the hour.",
  "series-letters": "Subscriber letters, host reminders and host-assigned notices.",
  mailing: "Mailings to subscribers, including test copies.",
  other: "Letters of another kind recorded against this series.",
};

const PART_LABEL: Record<string, string> = {
  "attendees-day": "day before",
  attendees: "shortly before",
  subscribers: "subscriber letters",
  host: "host reminders",
  "co-host": "co-host reminders",
};

const STATE_LABEL: Record<SeriesPlannerSessionStats["state"], string> = {
  published: "Published",
  draft: "Draft",
  cancelled: "Cancelled",
  removed: "Removed (moved or replaced)",
  unknown: "No week page",
};

function letterCount(n: number, letter: SeriesPlannerLetterKind): string {
  const [one, many] = LETTER_LABEL[letter];
  return `${n} ${n === 1 ? one : many}`;
}

/** "3 of 10 (30%)", over sends that left SendGrid (sandboxed copies excluded). */
function rate(part: number, t: SeriesPlannerEmailTracking | null): string {
  if (!t) return "";
  const base = t.sent - t.sandboxed;
  if (base <= 0) return "";
  return `${part} of ${base} (${Math.round((part / base) * 100)}%)`;
}

/** The split behind a line, e.g. "day before 2 · shortly before 1", plus what the split does not cover. */
function partsText(line: SeriesPlannerEmailLine): string {
  if (line.parts.length === 0) return "";
  const named = line.parts.map((p) => `${PART_LABEL[p.kind] ?? p.kind} ${p.count}`);
  if (line.letter === "series-letters") {
    const rest = line.count - line.parts.reduce((n, p) => n + p.count, 0);
    if (rest > 0) named.push(`host-assigned and other ${rest}`);
  }
  return named.join(" · ");
}

function MeasurementNote({ stats }: { stats: SeriesPlannerEmailStats }) {
  if (stats.measurement.orgEvents > 0) {
    return (
      <p className="eac-series-manage__note">
        Opens and clicks come from SendGrid&apos;s events. An open is counted when the recipient&apos;s mail program loads
        images or the recipient clicks a link; some programs load images for every letter, so opens are approximate.
      </p>
    );
  }
  return (
    <p className="eac-series-manage__note">
      Opens and clicks are not measured: no delivery events from SendGrid have reached this organisation&apos;s
      email ledger yet. The figures below count letters handed to SendGrid.
    </p>
  );
}

/** Per week: who is coming and which letters went out for it. */
function SeriesSessionsStats({ stats, tz }: { stats: SeriesPlannerEmailStats; tz: { timeZone?: string } }) {
  const measured = stats.measurement.orgEvents > 0;
  const weeks = stats.sessions;
  return (
    <div className="eac-series-people eac-series-manage__section">
      <p className="eac-rota-intro">
        Each week of the series with the people coming and the letters sent for it. Confirmations, host notices and
        attendee reminders are recorded against the week; subscriber letters and host reminders are recorded
        against the series and matched to the week they announce.
      </p>
      <MeasurementNote stats={stats} />
      {weeks.length === 0 ? (
        <p className="eac-rota__plan-empty">No week has a page or a letter yet.</p>
      ) : (
        <div className="eac-series-people__wrap" role="region" aria-label="Letters per week" tabIndex={0}>
          <table className="eac-series-people__table eac-series-manage__table">
            <caption className="eac-series-people__caption">
              {weeks.length} {weeks.length === 1 ? "week" : "weeks"} ·{" "}
              {weeks.reduce((n, w) => n + w.emails, 0)} letters
            </caption>
            <thead>
              <tr>
                <th scope="col">Week</th>
                <th scope="col">Date</th>
                <th scope="col">State</th>
                <th scope="col" className="is-num">Coming</th>
                <th scope="col">Letters sent</th>
                {measured && <th scope="col">Opened</th>}
                {measured && <th scope="col">Clicked</th>}
              </tr>
            </thead>
            <tbody>
              {weeks.map((w) => (
                <tr key={`${w.topicThreadId ?? "none"}-${w.at}`} data-week-state={w.state}>
                  <th scope="row">
                    {w.number ? `Week ${w.number}` : "Week"}
                    {w.title && <span className="eac-series-manage__sub">{w.title}</span>}
                  </th>
                  <td>
                    {fmtShortDate(w.at, tz)}
                    {w.slotAt && <span className="eac-series-manage__sub">moved from {fmtShortDate(w.slotAt, tz)}</span>}
                  </td>
                  <td>{STATE_LABEL[w.state]}</td>
                  <td className="is-num">{w.coming}</td>
                  <td>
                    {w.lines.length === 0 ? (
                      <span className="eac-series-people__off">None</span>
                    ) : (
                      <ul className="eac-series-manage__letters">
                        {w.lines.map((l) => {
                          const parts = l.letter === "attendee-reminder" || l.letter === "host-reminder" ? partsText(l) : "";
                          return (
                            <li key={l.letter}>
                              {letterCount(l.count, l.letter)}
                              {parts && <span className="eac-series-people__off"> ({parts})</span>}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </td>
                  {measured && <td>{rate(w.tracking.opened, w.tracking)}</td>}
                  {measured && <td>{rate(w.tracking.clicked, w.tracking)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {measured && (
        <p className="eac-series-manage__note">
          Opened and clicked cover the letters recorded against the week (confirmations, host notices, attendee
          reminders); the ledger cannot tie a subscriber letter&apos;s copy to a week.
        </p>
      )}
    </div>
  );
}

/** The series as a whole: subscribers, letters by kind, mailings, the last letter. */
function SeriesOverallStats({
  stats,
  tz,
  mailingsHref,
}: {
  stats: SeriesPlannerEmailStats;
  tz: { timeZone?: string };
  mailingsHref?: string;
}) {
  const o = stats.overall;
  const measured = stats.measurement.orgEvents > 0;
  return (
    <div className="eac-series-people eac-series-manage__section">
      <dl className="eac-series-people__counts">
        <div>
          <dt>Subscribers now</dt>
          <dd>{o.subscribers}</dd>
        </div>
        <div>
          <dt>Letters sent</dt>
          <dd>{o.emails}</dd>
        </div>
        <div>
          <dt>Mailings sent</dt>
          <dd>{o.mailings.sent}</dd>
        </div>
        <div>
          <dt>Last letter</dt>
          <dd className="eac-series-manage__date">{o.lastEmailAt ? fmtShortDate(o.lastEmailAt, tz) : "None yet"}</dd>
        </div>
      </dl>
      <MeasurementNote stats={stats} />
      {o.lines.length === 0 ? (
        <p className="eac-rota__plan-empty">No letter has been sent for this series yet.</p>
      ) : (
        <div className="eac-series-people__wrap" role="region" aria-label="Letters by kind" tabIndex={0}>
          <table className="eac-series-people__table eac-series-manage__table">
            <caption className="eac-series-people__caption">Letters by kind, one per recipient</caption>
            <thead>
              <tr>
                <th scope="col">Letter</th>
                <th scope="col" className="is-num">Sent</th>
                <th scope="col" className="is-num">Not sent</th>
                {measured && <th scope="col">Delivered</th>}
                {measured && <th scope="col">Opened</th>}
                {measured && <th scope="col">Clicked</th>}
                <th scope="col">Last</th>
                <th scope="col">What it is</th>
              </tr>
            </thead>
            <tbody>
              {o.lines.map((l) => {
                const parts = partsText(l);
                const [, many] = LETTER_LABEL[l.letter];
                return (
                  <tr key={l.letter}>
                    <th scope="row">{many.charAt(0).toUpperCase() + many.slice(1)}</th>
                    <td className="is-num">{l.count}</td>
                    <td className="is-num">{l.tracking ? l.tracking.failed + l.tracking.sandboxed : ""}</td>
                    {measured && <td>{rate(l.tracking?.delivered ?? 0, l.tracking)}</td>}
                    {measured && <td>{rate(l.tracking?.opened ?? 0, l.tracking)}</td>}
                    {measured && <td>{rate(l.tracking?.clicked ?? 0, l.tracking)}</td>}
                    <td>{l.lastAt ? fmtShortDate(l.lastAt, tz) : ""}</td>
                    <td>
                      {LETTER_NOTE[l.letter]}
                      {parts && <span className="eac-series-manage__sub">{parts}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">Total</th>
                <td className="is-num">{o.emails}</td>
                <td className="is-num">{o.tracking.failed + o.tracking.sandboxed}</td>
                {measured && <td>{rate(o.tracking.delivered, o.tracking)}</td>}
                {measured && <td>{rate(o.tracking.opened, o.tracking)}</td>}
                {measured && <td>{rate(o.tracking.clicked, o.tracking)}</td>}
                <td>{o.lastEmailAt ? fmtShortDate(o.lastEmailAt, tz) : ""}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      <p className="eac-series-manage__note">
        &ldquo;Not sent&rdquo; counts letters SendGrid refused or that went out in test (sandbox) mode.
      </p>

      <h3 className="eac-series-manage__h">Mailings</h3>
      {o.mailings.list.length === 0 ? (
        <p className="eac-rota__plan-empty">No mailing to this series yet.</p>
      ) : (
        <ul className="eac-series-manage__mailings">
          {o.mailings.list.map((m) => (
            <li key={m.slug}>
              <span className="eac-series-manage__mailing-title">{m.title}</span>{" "}
              <span className="eac-series-people__off">
                {m.sentAt ? `sent ${fmtShortDate(m.sentAt, tz)} to ${m.sentCount} ${m.sentCount === 1 ? "person" : "people"}` : "draft"}
              </span>
            </li>
          ))}
        </ul>
      )}
      {mailingsHref && (
        <p className="eac-series-manage__note">
          <a className="eac-series-manage__link" href={mailingsHref}>
            Write a mailing to subscribers
          </a>
        </p>
      )}
    </div>
  );
}

/**
 * The series' email list: its subscribers, the people coming to a week and
 * the hosts, read from the host's people endpoint when Manage opens.
 * Read-only; organisers only (the endpoint enforces it).
 */
function SeriesPeoplePanel({
  threadId,
  endpoint,
  tz,
}: {
  threadId: string;
  endpoint: string;
  tz: { timeZone?: string };
}) {
  const [list, setList] = React.useState<SeriesPlannerPeople | null>(null);
  const [problem, setProblem] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState("");
  const filterId = React.useId();

  React.useEffect(() => {
    let live = true;
    (async () => {
      try {
        const res = await fetch(`${endpoint}?threadId=${encodeURIComponent(threadId)}`, { cache: "no-store" });
        const body = await res.json().catch(() => ({}));
        if (!live) return;
        if (!res.ok) {
          setProblem(body.error ?? "Could not load the people of this series.");
          return;
        }
        setList(body as SeriesPlannerPeople);
      } catch {
        if (live) setProblem("Could not reach the server.");
      }
    })();
    return () => {
      live = false;
    };
  }, [endpoint, threadId]);

  const shown = React.useMemo(() => {
    const people = list?.people ?? [];
    const q = filter.trim().toLowerCase();
    if (!q) return people;
    return people.filter((p) => p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q));
  }, [list, filter]);

  if (problem) return <p className="eac-series__hint" role="alert">{problem}</p>;
  if (!list) return <p className="eac-rota-intro">Loading the people…</p>;

  const csvHref = `${endpoint}?threadId=${encodeURIComponent(threadId)}&format=csv`;
  const c = list.counts;

  return (
    <div className="eac-series-people">
      <dl className="eac-series-people__counts">
        <div>
          <dt>Subscribed</dt>
          <dd>{c.subscribed}</dd>
        </div>
        <div>
          <dt>Coming to a week</dt>
          <dd>{c.coming}</dd>
        </div>
        <div>
          <dt>Hosts</dt>
          <dd>{c.hosts}</dd>
        </div>
      </dl>
      <p className="eac-rota-intro">
        Everyone who subscribed to the series, said they are coming to a week, or hosts one.
        {c.orgUnsubscribed > 0
          ? ` ${c.orgUnsubscribed} of them ${c.orgUnsubscribed === 1 ? "has" : "have"} unsubscribed from the organisation's mail.`
          : ""}
      </p>

      <div className="eac-rota__record-actions">
        <a className="eac-face-tool" href={csvHref} download>
          Download CSV
        </a>
      </div>

      {list.people.length === 0 ? (
        <p className="eac-rota__plan-empty">Nobody has subscribed, said they are coming or been given a week yet.</p>
      ) : (
        <>
          <div className="eac-series__field eac-series-people__find">
            <label htmlFor={filterId}>Find</label>
            <input
              id={filterId}
              className="eac-input"
              type="search"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Name or address"
            />
          </div>
          {/* Focusable so a keyboard can scroll the table sideways on a phone. */}
          <div className="eac-series-people__wrap" role="region" aria-label="People of this series" tabIndex={0}>
            <table className="eac-series-people__table">
              <caption className="eac-series-people__caption">
                {filter.trim() ? `${shown.length} of ${list.people.length} people` : `${list.people.length} ${list.people.length === 1 ? "person" : "people"}`}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Email</th>
                  <th scope="col">Subscribed</th>
                  <th scope="col" className="is-num">Weeks coming</th>
                  <th scope="col" className="is-num">Weeks hosting</th>
                  <th scope="col">First seen</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((p) => (
                  <tr key={p.userId}>
                    <th scope="row">{p.name}</th>
                    <td className="eac-series-people__email">
                      {p.email}
                      {p.orgUnsubscribed && <span className="eac-series-people__off"> · unsubscribed</span>}
                    </td>
                    <td>{p.subscribed ? "Yes" : "No"}</td>
                    <td className="is-num">{p.weeksComing}</td>
                    <td className="is-num">{p.weeksHosting}</td>
                    <td>{p.firstSeen ? fmtShortDate(p.firstSeen, tz) : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {shown.length === 0 && <p className="eac-rota__plan-empty">Nobody matches that.</p>}
        </>
      )}
    </div>
  );
}

type SettingsFields = {
  title: string;
  lede: string;
  /** "About the series" HTML ('' = none). */
  bodyHtml: string;
  /** The cover as JSON ('' = none), so the dirty check stays a string compare. */
  cover: string;
  accent: string;
  /** "1" / "0", for the string compare. */
  listed: string;
  landing: string;
  featured: string;
  /** "" = from the schedule. */
  rhythm: string;
  rhythmOwn: string;
  statusChip: string;
  joinMode: "link" | "talk";
  joinUrl: string;
  meetingId: string;
  passcode: string;
  otherWaysToJoin: string;
  reminderDays: string;
};

function settingsFields(s: SeriesPlannerSettings): SettingsFields {
  return {
    title: s.title ?? "",
    lede: s.lede ?? "",
    bodyHtml: s.bodyHtml ?? "",
    cover: s.cover ? JSON.stringify(s.cover) : "",
    accent: s.accent ?? "",
    listed: s.listed === false ? "0" : "1",
    landing: s.landing === false ? "0" : "1",
    featured: s.featured ? "1" : "0",
    rhythm: s.rhythm ?? "",
    rhythmOwn: s.rhythm ? "1" : "0",
    statusChip: s.statusChip === "hide" ? "hide" : "auto",
    joinMode: s.joinMode ?? "link",
    joinUrl: s.joinUrl ?? "",
    meetingId: s.meetingId ?? "",
    passcode: s.passcode ?? "",
    otherWaysToJoin: s.otherWaysToJoin ?? "",
    reminderDays: String(s.reminderDays ?? 2),
  };
}

/** Zones offered for the series' home zone and for the times it prints. */
const ZONE_CHOICES: Array<{ id: string; label: string }> = [
  { id: "America/Los_Angeles", label: "Pacific (Los Angeles)" },
  { id: "America/Denver", label: "Mountain (Denver)" },
  { id: "America/Chicago", label: "Central (Chicago)" },
  { id: "America/New_York", label: "Eastern (New York)" },
  { id: "Europe/London", label: "London" },
  { id: "Europe/Paris", label: "Paris" },
  { id: "UTC", label: "UTC" },
];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type ScheduleFields = {
  weekday: string;
  time: string;
  timeZone: string;
  firstDate: string;
  lastDate: string;
  durationMinutes: string;
  alsoZones: string[];
  /** "1"–"4", or "monthly". */
  intervalWeeks: string;
};

/** The schedule's repeat, as the save endpoints read it. */
function repeatOf(value: string): { intervalWeeks: number; monthly: boolean } {
  return value === "monthly" ? { intervalWeeks: 1, monthly: true } : { intervalWeeks: Number.parseInt(value, 10) || 1, monthly: false };
}

function scheduleFields(s: SeriesPlannerSchedule, recurrencePattern?: string | null): ScheduleFields {
  return {
    weekday: String(s.weekday),
    time: s.time,
    timeZone: s.timeZone,
    firstDate: s.firstDate,
    lastDate: s.lastDate ?? "",
    durationMinutes: String(s.durationMinutes ?? 60),
    alsoZones: s.alsoZones ?? [],
    intervalWeeks: recurrencePattern === "MONTHLY" ? "monthly" : String(s.intervalWeeks ?? 1),
  };
}

type ScheduleMove = { from: string; to: string | null; number: number; newNumber: number | null };

/**
 * The series' own settings, for organisers: name and description, when it
 * meets, how people join, and the subscriber letter. Collapsed by default,
 * in the same row-and-form shape as a week. Renaming keeps the page address.
 *
 * The schedule saves on its own button: weeks are keyed by their date and
 * time, so a new day or time moves the planned weeks, and the server is
 * asked first which weeks would move (a dry run) so the organiser can see
 * them before anything changes.
 */
function SeriesSettingsForm({
  settings,
  weeks,
  uploadEndpoint,
  libraryEndpoint,
  onSave,
  onSchedule,
  onCreateTalk,
  create,
}: {
  settings: SeriesPlannerSettings;
  weeks: SeriesPlannerWeek[];
  uploadEndpoint: string;
  libraryEndpoint: string;
  onSave: (fields: Record<string, unknown>) => Promise<boolean>;
  onSchedule: (schedule: Record<string, unknown>, dryRun: boolean) => Promise<{ ok: boolean; body: Record<string, unknown> }>;
  onCreateTalk: () => Promise<boolean>;
  /**
   * "+ New series": the same form, blank (or with suggested text), always
   * open. Its schedule is part of the form and goes with it; `onCreate` makes
   * the series and applies the rest (2026-10-18).
   */
  create?: { onCreate: (args: { settings: Record<string, unknown>; schedule: Record<string, unknown> }) => Promise<boolean>; defaultZone: string };
}) {
  const [open, setOpen] = React.useState(Boolean(create));
  // "Edit series" on the public pages links to `#settings`.
  React.useEffect(() => {
    if (window.location.hash === "#settings") setOpen(true);
  }, []);
  const [sched, setSched] = React.useState<ScheduleFields>(() => ({
    weekday: "1",
    time: "18:00",
    timeZone: create?.defaultZone ?? "America/New_York",
    firstDate: "",
    lastDate: "",
    durationMinutes: "60",
    alsoZones: ["America/Los_Angeles", "America/New_York", "Europe/Paris"],
    intervalWeeks: "1",
  }));
  const [showPreview, setShowPreview] = usePreviewToggle();
  // Keyed by value, so a reload after saving a week does not wipe edits here.
  const savedKey = JSON.stringify(settingsFields(settings));
  const saved = React.useMemo(() => JSON.parse(savedKey) as SettingsFields, [savedKey]);
  const [fields, setFields] = React.useState<SettingsFields>(saved);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    setFields(saved);
  }, [saved]);

  const dirty = (Object.keys(saved) as Array<keyof SettingsFields>).some((k) => fields[k] !== saved[k]);
  const set = (k: keyof SettingsFields) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setFields((f) => ({ ...f, [k]: e.target.value }));

  const settingsPayload = () => {
    const days = Number.parseInt(fields.reminderDays, 10);
    return {
      title: fields.title,
      lede: fields.lede,
      bodyHtml: fields.bodyHtml,
      cover: fields.cover ? (JSON.parse(fields.cover) as SeriesPlannerCover) : null,
      ...(settings.accents
        ? {
            accent: fields.accent || null,
            listed: fields.listed === "1",
            landing: fields.landing === "1",
            featured: fields.featured === "1",
            rhythm: fields.rhythmOwn === "1" ? fields.rhythm : null,
            statusChip: fields.statusChip === "hide" ? "hide" : "auto",
          }
        : {}),
      joinMode: fields.joinMode,
      joinUrl: fields.joinUrl,
      meetingId: fields.meetingId,
      passcode: fields.passcode,
      otherWaysToJoin: fields.otherWaysToJoin,
      reminderDays: Number.isFinite(days) ? Math.max(0, Math.min(14, days)) : 2,
    };
  };

  async function save() {
    setSaving(true);
    await onSave(settingsPayload());
    setSaving(false);
  }

  async function createIt() {
    if (!create) return;
    setSaving(true);
    await create.onCreate({
      settings: settingsPayload(),
      schedule: {
        weekday: Number(sched.weekday),
        time: sched.time,
        timeZone: sched.timeZone,
        firstDate: sched.firstDate,
        lastDate: sched.lastDate || null,
        durationMinutes: Number.parseInt(sched.durationMinutes, 10) || 60,
        alsoZones: sched.alsoZones,
        ...repeatOf(sched.intervalWeeks),
      },
    });
    setSaving(false);
  }

  const talk = fields.joinMode === "talk";
  const cover = fields.cover ? (JSON.parse(fields.cover) as SeriesPlannerCover) : null;
  const savedCover = saved.cover ? (JSON.parse(saved.cover) as SeriesPlannerCover) : null;
  const joinSummary = saved.joinMode === "talk" ? (settings.talkUrl ? "Joining by Talk room" : "Talk room not made yet") : saved.joinUrl ? "Join link set" : saved.meetingId ? "Meeting ID set" : "No join link yet";
  const when = settings.schedule
    ? `${settings.recurrencePattern === "MONTHLY" ? `Monthly, ${WEEKDAYS[settings.schedule.weekday]}` : `${WEEKDAYS[settings.schedule.weekday]}s`} ${settings.schedule.time} · ${ZONE_CHOICES.find((z) => z.id === settings.schedule!.timeZone)?.label ?? settings.schedule.timeZone}`
    : null;

  return (
    <section className={`eac-series__week eac-series__settings${open ? " is-open" : ""}`} aria-label="Series settings">
      {/* The whole series, not a week: a banner of its own (2026-10-18), dark
          where the weeks beneath are light, with the series' name large. */}
      {create ? (
        <div className="eac-series__head eac-series__banner eac-series__banner--new">
          <CoverThumb cover={cover} />
          <span className="eac-series__sum">
            <span className="eac-series__kicker">A new series</span>
            <span className="eac-series__title">{fields.title.trim() || "Name it below"}</span>
            <span className="eac-series__host">
              {sched.firstDate ? `Meets ${WEEKDAYS[Number(sched.weekday)]}s ${sched.time} from ${sched.firstDate}` : "Say what it is and when it meets. Everything can change later."}
            </span>
          </span>
        </div>
      ) : (
      <button type="button" className="eac-series__head eac-series__banner" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <CoverThumb cover={savedCover} />
        <span className="eac-series__sum">
          <span className="eac-series__kicker">The series</span>
          <span className="eac-series__title">{saved.title}</span>
          <span className={`eac-series__host${saved.joinUrl || settings.talkUrl ? "" : " is-empty"}`}>
            {[when, joinSummary].filter(Boolean).join(" · ")}
          </span>
        </span>
        <span className="eac-series__settings-btn">
          Cover, about and schedule <span aria-hidden="true">{open ? "▴" : "▾"}</span>
        </span>
      </button>
      )}

      {open && (
        <div className="eac-series__form">
          <div className="eac-series__prevbar">
            <button type="button" className="eac-face-tool" aria-pressed={showPreview} onClick={() => setShowPreview((v) => !v)}>
              {showPreview ? "Hide preview" : "Show preview"}
            </button>
          </div>
          <div className={`eac-series__cardsplit${showPreview ? "" : " is-solo"}`}>
          <div className="eac-series__cardfields">
          <label className="eac-series__field">
            <span>Series name</span>
            <input className="eac-input" value={fields.title} onChange={set("title")} maxLength={200} required />
          </label>
          <p className="eac-series__hint">The page address stays the same when you rename the series.</p>
          <label className="eac-series__field">
            <span>Short description</span>
            <textarea
              className="eac-input"
              rows={3}
              value={fields.lede}
              onChange={set("lede")}
              maxLength={1000}
              placeholder={settings.excerpt ?? "One or two sentences under the title on the series page"}
            />
          </label>
          <div className="eac-series__field">
            <span>About the series</span>
            <RichTextEditor
              value={fields.bodyHtml}
              onChange={(html) => setFields((f) => ({ ...f, bodyHtml: emptyHtml(html) ? "" : html }))}
              toolbar="minimal"
              minHeight={160}
              ariaLabel="About the series"
              placeholder="What the series is, who it is for, how a session runs. Shown under the cover on the series page."
            />
          </div>

          <p className="eac-series__section">Cover and card</p>
          <CoverField
            name="series-cover-kind"
            shape={{ label: "Series page, under the title", aspect: 16 / 9 }}
            alsoShapes={[{ label: "Card, wide screens", aspect: 330 / 420 }]}
            overlay={
              <span className="eac-series__overlay">
                <b>{fields.title || "Series name"}</b>
                {(fields.lede || settings.excerpt) && <span>{shortText(fields.lede || settings.excerpt || "", 140)}</span>}
              </span>
            }
            cover={cover}
            onChange={(c) => setFields((f) => ({ ...f, cover: c ? JSON.stringify(c) : "" }))}
            uploadEndpoint={uploadEndpoint}
            libraryEndpoint={libraryEndpoint}
          />

          {settings.accents && (
            <>
              <p className="eac-series__section">How the card reads</p>
              <div className="eac-series__field" role="radiogroup" aria-label="Rhythm line">
                <span>Rhythm line</span>
                <div className="eac-series__checks eac-series__checks--col">
                  <label>
                    <input type="radio" name="series-rhythm" checked={fields.rhythmOwn !== "1"} onChange={() => setFields((f) => ({ ...f, rhythmOwn: "0" }))} />
                    From the schedule: “{autoRhythm(settings)}”
                  </label>
                  <label>
                    <input type="radio" name="series-rhythm" checked={fields.rhythmOwn === "1"} onChange={() => setFields((f) => ({ ...f, rhythmOwn: "1" }))} />
                    My own words
                  </label>
                </div>
                {fields.rhythmOwn === "1" && (
                  <input
                    className="eac-input"
                    value={fields.rhythm}
                    onChange={set("rhythm")}
                    maxLength={80}
                    placeholder="e.g. Every other Thursday · from 5 November"
                    aria-label="Rhythm line in your own words"
                  />
                )}
              </div>
              <div className="eac-series__field" role="radiogroup" aria-label="Status label">
                <span>Status label on the card</span>
                <div className="eac-series__checks eac-series__checks--col">
                  <label>
                    <input type="radio" name="series-status" checked={fields.statusChip !== "hide"} onChange={() => setFields((f) => ({ ...f, statusChip: "auto" }))} />
                    Automatic: “Starts 5 Nov” before the first session, then “Running”
                  </label>
                  <label>
                    <input type="radio" name="series-status" checked={fields.statusChip === "hide"} onChange={() => setFields((f) => ({ ...f, statusChip: "hide" }))} />
                    Hide
                  </label>
                </div>
              </div>

              <p className="eac-series__section">Where it shows</p>
              <div className="eac-series__field">
                <span>Colour on the Series page</span>
                <div className="eac-series__swatches" role="radiogroup" aria-label="Colour">
                  {settings.accents.map((a) => {
                    return (
                      <button
                        key={a.id}
                        type="button"
                        role="radio"
                        aria-checked={fields.accent === a.id}
                        aria-label={a.label}
                        title={a.label}
                        className={`eac-series__swatch${fields.accent === a.id ? " is-on" : ""}`}
                        style={{ background: a.color }}
                        onClick={() => setFields((f) => ({ ...f, accent: a.id }))}
                      />
                    );
                  })}
                </div>
                <p className="eac-series__hint">The dot, the row edge and the calendar chip for this series&apos; sessions.{fields.accent ? "" : " None chosen: the page assigns one by position."}</p>
              </div>
              <div className="eac-series__switches">
                <Switch on={fields.listed === "1"} onChange={(v) => setFields((f) => ({ ...f, listed: v ? "1" : "0" }))} label="Listed on the Series page" />
                <Switch on={fields.landing === "1"} onChange={(v) => setFields((f) => ({ ...f, landing: v ? "1" : "0" }))} label="In the landing page slides" />
                <Switch
                  on={fields.featured === "1"}
                  onChange={(v) => setFields((f) => ({ ...f, featured: v ? "1" : "0" }))}
                  label="Featured"
                  hint="First on the Series page and the landing page. One series at a time."
                />
              </div>
            </>
          )}
          </div>
          {showPreview && (
            <aside className="eac-series__cardprev" aria-label="Preview">
              <SeriesCardPreview
                settings={
                  create
                    ? { ...settings, schedule: { weekday: Number(sched.weekday), time: sched.time, timeZone: sched.timeZone, firstDate: sched.firstDate, lastDate: sched.lastDate || null, durationMinutes: Number.parseInt(sched.durationMinutes, 10) || 60, alsoZones: sched.alsoZones, intervalWeeks: Number.parseInt(sched.intervalWeeks, 10) || 1 } }
                    : settings
                }
                fields={fields}
                cover={cover}
                weeks={weeks}
              />
            </aside>
          )}
          </div>

          {create && (
            <ScheduleForm
              schedule={{ weekday: 1, time: "18:00", timeZone: create.defaultZone, firstDate: "", lastDate: null, durationMinutes: 60, alsoZones: null }}
              weeks={[]}
              onSchedule={onSchedule}
              controlled={{ value: sched, onChange: setSched }}
            />
          )}

          <p className="eac-series__section">How people join</p>
          <div className="eac-series__field" role="radiogroup" aria-label="How people join">
            <div className="eac-series__checks">
              <label>
                <input type="radio" name="series-join-mode" checked={!talk} onChange={() => setFields((f) => ({ ...f, joinMode: "link" }))} />
                A link I paste (Zoom or any other)
              </label>
              <label>
                <input type="radio" name="series-join-mode" checked={talk} disabled={Boolean(create)} onChange={() => setFields((f) => ({ ...f, joinMode: "talk" }))} />
                A Talk room{create ? " (once the series exists)" : ""}
              </label>
            </div>
            <p className="eac-series__hint">
              Shown only to people who have said they are coming, and sent in their confirmation and reminder emails. Never on the public page.
            </p>
          </div>
          {talk ? (
            <div className="eac-series__field">
              <span>Talk room</span>
              {settings.talkUrl ? (
                <p className="eac-series__hint">
                  <a href={settings.talkUrl} target="_blank" rel="noreferrer">{settings.talkUrl}</a>
                </p>
              ) : (
                <div className="eac-rota__record-actions">
                  <button type="button" className="eac-face-tool" onClick={() => void onCreateTalk()}>
                    Create a Talk room
                  </button>
                </div>
              )}
              <p className="eac-series__hint">
                {saved.joinMode === "talk"
                  ? "People join in the browser; no account is needed."
                  : "Saving switches joining to the Talk room and clears the pasted link, meeting ID and passcode."}
              </p>
            </div>
          ) : (
            <>
              <label className="eac-series__field">
                <span>Join link</span>
                <input className="eac-input" type="url" inputMode="url" value={fields.joinUrl} onChange={set("joinUrl")} placeholder="https://zoom.us/j/…" maxLength={1000} />
              </label>
              <div className="eac-series__pair">
                <label className="eac-series__field">
                  <span>Meeting ID</span>
                  <input className="eac-input" value={fields.meetingId} onChange={set("meetingId")} placeholder="123 4567 8901" maxLength={100} autoComplete="off" />
                </label>
                <label className="eac-series__field">
                  <span>Passcode</span>
                  <input className="eac-input" value={fields.passcode} onChange={set("passcode")} maxLength={100} autoComplete="off" />
                </label>
              </div>
            </>
          )}
          {/* "Other ways to join" left the form on 2026-10-18 (developer). A
              value saved before stays stored and is still sent unchanged. */}

          <p className="eac-series__section">Subscribers</p>
          <label className="eac-series__field">
            <span>Email subscribers this many days before each published week</span>
            <input className="eac-input" type="number" min={0} max={14} value={fields.reminderDays} onChange={set("reminderDays")} />
          </label>
          <p className="eac-series__hint">0 turns the letter off. Drafts are never sent.</p>

          {create ? (
            <div className="eac-rota__record-actions">
              <button
                type="button"
                className="eac-face-tool eac-rota__save"
                disabled={saving || fields.title.trim().length < 2 || !sched.firstDate || !sched.time}
                onClick={() => void createIt()}
              >
                {saving ? "Creating…" : "Create the series"}
              </button>
              <span className="eac-series__hint">It is unlisted unless you switch “Listed on the Series page” on. Its weeks begin as drafts.</span>
            </div>
          ) : (
            <>
              <div className="eac-rota__record-actions">
                <button type="button" className="eac-face-tool eac-rota__save" disabled={!dirty || saving || !fields.title.trim()} onClick={() => void save()}>
                  {saving ? "Saving…" : dirty ? "Save series settings" : "Saved"}
                </button>
              </div>

              {settings.schedule && <ScheduleForm recurrencePattern={settings.recurrencePattern} schedule={settings.schedule} weeks={weeks} onSchedule={onSchedule} />}
            </>
          )}
        </div>
      )}
    </section>
  );
}

function ScheduleForm({
  recurrencePattern,
  schedule,
  weeks,
  onSchedule,
  controlled,
}: {
  schedule: SeriesPlannerSchedule;
  weeks: SeriesPlannerWeek[];
  onSchedule: (schedule: Record<string, unknown>, dryRun: boolean) => Promise<{ ok: boolean; body: Record<string, unknown> }>;
  /** Create mode: the parent owns the values and saves them with the new series; there is nothing to move. */
  controlled?: { value: ScheduleFields; onChange: (next: ScheduleFields) => void };
  recurrencePattern?: string | null;
}) {
  const savedKey = JSON.stringify(scheduleFields(schedule, recurrencePattern));
  const saved = React.useMemo(() => JSON.parse(savedKey) as ScheduleFields, [savedKey]);
  const [ownFields, setOwnFields] = React.useState<ScheduleFields>(saved);
  const fields = controlled ? controlled.value : ownFields;
  const setFields = (u: ScheduleFields | ((f: ScheduleFields) => ScheduleFields)) => {
    if (controlled) controlled.onChange(typeof u === "function" ? u(controlled.value) : u);
    else setOwnFields(u);
  };
  const [busy, setBusy] = React.useState(false);
  const [problem, setProblem] = React.useState<string | null>(null);
  const [moves, setMoves] = React.useState<ScheduleMove[] | null>(null);

  React.useEffect(() => {
    if (controlled) return;
    setOwnFields(saved);
    setMoves(null);
  }, [saved]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = JSON.stringify(fields) !== JSON.stringify(saved);
  const set = (k: keyof ScheduleFields) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setMoves(null);
    setFields((f) => ({ ...f, [k]: e.target.value }));
  };
  const zones = ZONE_CHOICES.some((z) => z.id === fields.timeZone)
    ? ZONE_CHOICES
    : [...ZONE_CHOICES, { id: fields.timeZone, label: fields.timeZone }];
  const shownZones = new Set([fields.timeZone, ...fields.alsoZones]);
  const toggleZone = (id: string) => {
    setMoves(null);
    setFields((f) => ({ ...f, alsoZones: f.alsoZones.includes(id) ? f.alsoZones.filter((z) => z !== id) : [...f.alsoZones, id] }));
  };

  const payload = () => ({
    weekday: Number(fields.weekday),
    time: fields.time,
    timeZone: fields.timeZone,
    firstDate: fields.firstDate,
    lastDate: fields.lastDate || null,
    durationMinutes: Number.parseInt(fields.durationMinutes, 10) || null,
    alsoZones: fields.alsoZones,
    ...repeatOf(fields.intervalWeeks),
  });

  async function check() {
    setBusy(true);
    setProblem(null);
    const res = await onSchedule(payload(), true);
    setBusy(false);
    if (!res.ok) {
      setProblem(String(res.body.error ?? "Could not check the schedule."));
      return;
    }
    const found = (res.body.moves as ScheduleMove[] | undefined) ?? [];
    if (found.length === 0) {
      await commit();
      return;
    }
    setMoves(found);
  }

  async function commit() {
    setBusy(true);
    setProblem(null);
    const res = await onSchedule(payload(), false);
    setBusy(false);
    if (res.ok) setMoves(null);
  }

  const byAt = new Map(weeks.map((w) => [w.at, w]));
  const day = (iso: string) =>
    new Date(iso).toLocaleString(undefined, { timeZone: fields.timeZone, weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

  return (
    <>
      <p className="eac-series__section">When it meets</p>
      <div className="eac-series__pair">
        <label className="eac-series__field">
          <span>Repeats</span>
          <select className="eac-input" value={fields.intervalWeeks} onChange={set("intervalWeeks")}>
            <option value="1">Every week</option>
            <option value="2">Every 2 weeks</option>
            <option value="3">Every 3 weeks</option>
            <option value="4">Every 4 weeks</option>
            <option value="monthly">Monthly (same weekday)</option>
          </select>
        </label>
        <label className="eac-series__field">
          <span>Day</span>
          <select className="eac-input" value={fields.weekday} onChange={set("weekday")}>
            {WEEKDAYS.map((d, i) => (
              <option key={d} value={String(i)}>{d}</option>
            ))}
          </select>
        </label>
        <label className="eac-series__field">
          <span>Time</span>
          <input className="eac-input" type="time" value={fields.time} onChange={set("time")} required />
        </label>
        <label className="eac-series__field">
          <span>Time zone</span>
          <select className="eac-input" value={fields.timeZone} onChange={set("timeZone")}>
            {zones.map((z) => (
              <option key={z.id} value={z.id}>{z.label}</option>
            ))}
          </select>
        </label>
        <label className="eac-series__field">
          <span>Length (minutes)</span>
          <input className="eac-input" type="number" min={15} max={600} step={5} value={fields.durationMinutes} onChange={set("durationMinutes")} />
        </label>
      </div>
      <div className="eac-series__pair">
        <label className="eac-series__field">
          <span>First session on or after</span>
          <input className="eac-input" type="date" value={fields.firstDate} onChange={set("firstDate")} required />
        </label>
        <label className="eac-series__field">
          <span>Last date (optional)</span>
          <input className="eac-input" type="date" value={fields.lastDate} onChange={set("lastDate")} />
        </label>
      </div>
      <div className="eac-series__field">
        <span>Show times in</span>
        <div className="eac-series__checks">
          {ZONE_CHOICES.filter((z) => z.id !== "UTC").map((z) => (
            <label key={z.id}>
              <input
                type="checkbox"
                checked={shownZones.has(z.id)}
                disabled={z.id === fields.timeZone}
                onChange={() => toggleZone(z.id)}
              />
              {z.label}
            </label>
          ))}
        </div>
        <p className="eac-series__hint">The series&apos; own zone is always shown first. Times keep their local hour across daylight-saving changes.</p>
      </div>

      {moves && (
        <div className="eac-series__warn" role="alert">
          <strong>Planned weeks move to the new dates.</strong>
          <ul>
            {moves.map((m) => {
              const w = byAt.get(m.from);
              const what = [w?.title ?? null, w?.host?.displayName ? `host ${w.host.displayName}` : null, w && w.rsvpCount > 0 ? `${w.rsvpCount} coming` : null]
                .filter(Boolean)
                .join(", ");
              return (
                <li key={m.from}>
                  Session {m.number} ({day(m.from)}) {m.to ? `moves to ${day(m.to)}` : "has no new date and stays behind: it will no longer show"}
                  {what ? `: ${what}` : ""}
                </li>
              );
            })}
          </ul>
          People who said they are coming are not emailed about the change.
          <div className="eac-rota__record-actions">
            <button type="button" className="eac-face-tool eac-rota__save" disabled={busy} onClick={() => void commit()}>
              {busy ? "Saving…" : "Save and move the weeks"}
            </button>
            <button type="button" className="eac-face-tool" disabled={busy} onClick={() => setMoves(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {problem && <p className="eac-series__hint" role="alert">{problem}</p>}
      {!moves && !controlled && (
        <div className="eac-rota__record-actions">
          <button type="button" className="eac-face-tool eac-rota__save" disabled={!dirty || busy || !fields.time || !fields.firstDate} onClick={() => void check()}>
            {busy ? "Checking…" : dirty ? "Save schedule" : "Schedule saved"}
          </button>
        </div>
      )}
    </>
  );
}

type WeekFields = {
  title?: string | null;
  subtitle?: string | null;
  bodyHtml?: string | null;
  coverImageUrl?: string | null;
  coverFrame?: CoverFrame | null;
  coverKind?: "image" | "video" | "embed";
  coverPosterUrl?: string | null;
  materials?: SeriesPlannerMaterial[];
};

function WeekForm({
  week,
  tz,
  editable,
  canWrite,
  viewerId,
  candidates,
  uploadEndpoint,
  libraryEndpoint,
  uploadFields,
  onAssign,
  onSave,
  onPublish,
  onCancel,
  onMove,
  seriesZone = "UTC",
}: {
  week: SeriesPlannerWeek;
  tz: { timeZone?: string };
  editable: boolean;
  canWrite: boolean;
  viewerId: string | null;
  candidates: Array<{ userId: string; displayName: string }>;
  uploadEndpoint: string;
  libraryEndpoint: string;
  /** Sent with each upload: the series and the week, which admit the week's host. */
  uploadFields?: Record<string, string>;
  onAssign: (role: "host" | "co-host", userId: string | null) => Promise<boolean>;
  onSave: (fields: WeekFields) => Promise<boolean>;
  onPublish: (published: boolean) => Promise<boolean>;
  /** Organisers: cancel (true) or restore (false) the week. */
  onCancel?: (cancel: boolean) => Promise<boolean>;
  /** Organisers: move the week to a local "YYYY-MM-DDTHH:MM" in the series' zone. */
  onMove?: (moveTo: string) => Promise<boolean>;
  /** The zone the move input is read in: the series' own (the server reads it there too). */
  seriesZone?: string;
}) {
  const [open, setOpen] = React.useState(week.isNext);
  // A week written before the rich write-up opens with its plain text as paragraphs.
  const savedBody = week.bodyHtml ?? textToHtml(week.summary);
  const savedCover = JSON.stringify(weekCoverValue(week));
  const [title, setTitle] = React.useState(week.title ?? "");
  const [subtitle, setSubtitle] = React.useState(week.subtitle ?? "");
  const [body, setBody] = React.useState(savedBody);
  // The editor rewrites markup as it loads; only a change the person made counts.
  const [bodyTouched, setBodyTouched] = React.useState(false);
  const [cover, setCover] = React.useState<CoverValue | null>(weekCoverValue(week));
  const [showPreview, setShowPreview] = usePreviewToggle();
  const [materials, setMaterials] = React.useState<SeriesPlannerMaterial[]>(week.materials);
  const [linkName, setLinkName] = React.useState("");
  const [linkUrl, setLinkUrl] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    setTitle(week.title ?? "");
    setSubtitle(week.subtitle ?? "");
    setBody(savedBody);
    setBodyTouched(false);
    setCover(JSON.parse(savedCover) as CoverValue | null);
    setMaterials(week.materials);
  }, [week.title, week.subtitle, savedBody, savedCover, week.materials]);

  const dirty =
    title !== (week.title ?? "") ||
    subtitle !== (week.subtitle ?? "") ||
    (bodyTouched && body !== savedBody) ||
    JSON.stringify(cover) !== savedCover ||
    JSON.stringify(materials) !== JSON.stringify(week.materials);

  async function save() {
    setSaving(true);
    await onSave({
      title,
      subtitle,
      // Sent only when edited, so a week saved before 2026-10-13 keeps its
      // plain summary until someone rewrites it here.
      ...(bodyTouched ? { bodyHtml: body } : {}),
      coverImageUrl: cover?.url ?? "",
      coverFrame: cover?.kind === "image" ? cover.frame ?? null : null,
      coverKind: cover?.kind ?? "image",
      coverPosterUrl: cover && cover.kind !== "image" ? cover.posterUrl ?? null : null,
      materials,
    });
    setSaving(false);
  }

  function addMaterial(url: string, name?: string, external = false) {
    const clean = url.trim();
    if (!clean) return;
    const lower = clean.toLowerCase();
    const kind: SeriesPlannerMaterial["kind"] = /\.(png|jpe?g|gif|webp|avif|svg)(\?|$)/.test(lower)
      ? "image"
      : /\.(mp4|mov|webm|m4v)(\?|$)/.test(lower) || /youtube\.com|youtu\.be|vimeo\.com/.test(lower)
        ? "video"
        : /\.(mp3|m4a|wav|ogg)(\?|$)/.test(lower)
          ? "audio"
          : "document";
    const fallback = decodeURIComponent(clean.split("/").pop()?.split("?")[0] ?? "") || clean;
    setMaterials((m) => [
      ...m,
      { id: Math.random().toString(36).slice(2, 10), name: (name ?? "").trim() || fallback, url: clean, kind, external },
    ]);
  }

  const when = fmtDateTime(week.at, tz);
  const label = week.isPast ? "Past" : week.isNext ? "This week" : null;
  const cancelled = week.isCancelled === true;
  const [moving, setMoving] = React.useState(false);
  const [moveTo, setMoveTo] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  async function act(run: () => Promise<boolean>) {
    setBusy(true);
    const ok = await run();
    setBusy(false);
    return ok;
  }
  // Older endpoints send no flag; treat those weeks as published, as they were.
  const published = week.isPublished !== false;
  const [publishing, setPublishing] = React.useState(false);
  async function publish(next: boolean) {
    setPublishing(true);
    await onPublish(next);
    setPublishing(false);
  }

  return (
    <li className={`eac-series__week${open ? " is-open" : ""}${week.isPast ? " is-past" : ""}`}>
      <button type="button" className="eac-series__head" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <CoverThumb cover={week.coverImageUrl ? { url: week.coverImageUrl, kind: "image", frame: week.coverFrame ?? null } : null} />
        <span className="eac-series__when">
          <strong>{when}</strong>
          {label && <em className="eac-series__tag">{label}</em>}
          {cancelled && <em className="eac-series__tag is-draft">Cancelled</em>}
          {!cancelled && week.isMoved && <em className="eac-series__tag">Moved</em>}
          {!week.isPast && !published && !cancelled && <em className="eac-series__tag is-draft">Draft</em>}
          <span className="eac-series__n">Session {week.number}</span>
        </span>
        <span className="eac-series__sum">
          <span className={`eac-series__title${week.title ? "" : " is-empty"}`}>{week.title ?? "Untitled week"}</span>
          {week.subtitle && <span className="eac-series__subtitle">{week.subtitle}</span>}
          <span className={`eac-series__host${week.host ? "" : " is-empty"}`}>
            {week.host?.displayName ?? "Nobody hosting yet"}
            {week.coHost?.displayName ? ` · with ${week.coHost.displayName}` : ""}
            {week.rsvpCount > 0 ? ` · ${week.rsvpCount} going` : ""}
          </span>
        </span>
        <span className="eac-series__chev" aria-hidden="true">{open ? "▴" : "▾"}</span>
      </button>

      {open && (
        <div className="eac-series__form">
          <div className="eac-series__roles">
            <RoleSlot label="Host" role="host" person={week.host} editable={editable} viewerId={viewerId} candidates={candidates} onAssign={onAssign} />
            <RoleSlot label="Co-host" role="co-host" person={week.coHost} editable={editable} viewerId={viewerId} candidates={candidates} onAssign={onAssign} />
          </div>

          {canWrite ? (
            <>
              <div className="eac-series__prevbar">
                <button type="button" className="eac-face-tool" aria-pressed={showPreview} onClick={() => setShowPreview((v) => !v)}>
                  {showPreview ? "Hide preview" : "Show preview"}
                </button>
              </div>
              <div className={`eac-series__cardsplit${showPreview ? "" : " is-solo"}`}>
              <div className="eac-series__cardfields">
              <label className="eac-series__field">
                <span>Title</span>
                <input className="eac-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What this week is called" maxLength={200} />
              </label>
              <label className="eac-series__field">
                <span>Subtitle or short summary <em className="eac-series__optional">(optional)</em></span>
                <input
                  className="eac-input"
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  placeholder="One line under the title, e.g. “Paint loose, paint simple, have fun”"
                  maxLength={300}
                />
              </label>
              <div className="eac-series__field">
                <span>Write-up</span>
                <RichTextEditor
                  value={body}
                  onChange={(html) => {
                    setBodyTouched(true);
                    setBody(emptyHtml(html) ? "" : html);
                  }}
                  toolbar="minimal"
                  minHeight={200}
                  ariaLabel={`Write-up for session ${week.number}`}
                  placeholder="What you'll do, what to bring, what to look at before…"
                />
                <p className="eac-series__hint">Headings, lists, bold and links show on the series page and the week&apos;s own page. Emails carry it as plain text.</p>
              </div>
              <div className="eac-series__field">
                <span>Cover</span>
                <CoverField
                  name={`week-cover-${week.number}`}
                  cover={cover}
                  onChange={setCover}
                  uploadEndpoint={uploadEndpoint}
                  libraryEndpoint={libraryEndpoint}
                  uploadFields={uploadFields}
                  shape={{ label: "Session card and week page (wide)", aspect: 16 / 9 }}
                  hint="Shown on the session's card and at the top of its page. A video plays silently on a loop."
                  overlay={
                    <span className="eac-series__overlay">
                      <b>{title || "Untitled week"}</b>
                      {subtitle && <span>{subtitle}</span>}
                    </span>
                  }
                />
              </div>
              </div>
              {showPreview && (
                <aside className="eac-series__cardprev" aria-label="Preview">
                  <SessionPreview week={week} title={title} subtitle={subtitle} body={body} cover={cover} tz={tz} />
                </aside>
              )}
              </div>
              <div className="eac-series__field">
                <span>Materials</span>
                <MaterialList items={materials} editable onRemove={(id) => setMaterials((m) => m.filter((x) => x.id !== id))} />
                <div className="eac-series__addlink">
                  <input className="eac-input" value={linkName} onChange={(e) => setLinkName(e.target.value)} placeholder="Name" />
                  <input className="eac-input" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://… (a page, a recording, a document)" />
                  <button
                    type="button"
                    className="eac-face-tool"
                    disabled={!linkUrl.trim()}
                    onClick={() => {
                      addMaterial(linkUrl, linkName, true);
                      setLinkName("");
                      setLinkUrl("");
                    }}
                  >
                    Add link
                  </button>
                </div>
                <MediaPicker value="" onChange={(url) => addMaterial(url)} uploadEndpoint={uploadEndpoint} libraryEndpoint={libraryEndpoint} uploadFields={uploadFields} label="" hint="Upload or pick a file to add it to the materials" accept="*/*" />
              </div>
              <div className="eac-rota__record-actions">
                <button type="button" className="eac-face-tool eac-rota__save" disabled={!dirty || saving} onClick={() => void save()}>
                  {saving ? "Saving…" : dirty ? "Save this week" : "Saved"}
                </button>
                {!week.isPast && week.isPublished !== undefined && (
                  published ? (
                    <button type="button" className="eac-face-tool" disabled={publishing} onClick={() => void publish(false)}>
                      {publishing ? "…" : "Unpublish"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="eac-face-tool"
                      disabled={publishing || dirty || !week.title}
                      title={!week.title ? "Give the week a title first" : dirty ? "Save the week first" : undefined}
                      onClick={() => void publish(true)}
                    >
                      {publishing ? "…" : "Publish week"}
                    </button>
                  )
                )}
                {week.href && (
                  <a className="eac-face-tool" href={week.href} target="_blank" rel="noreferrer">
                    Open its page
                  </a>
                )}
              </div>
              {!week.isPast && !published && !cancelled && (
                <p className="eac-series__hint">
                  {week.title ? "A draft: it shows on the public page once you publish it." : "A draft: give it a title, save, then publish it."}
                </p>
              )}
              {editable && (onCancel || onMove) && (
                <div className="eac-rota__record-actions">
                  {onCancel && (
                    <button type="button" className="eac-face-tool" disabled={busy} onClick={() => void act(() => onCancel(!cancelled))}>
                      {cancelled ? "Restore" : "Cancel this week"}
                    </button>
                  )}
                  {onMove && !moving && (
                    <button
                      type="button"
                      className="eac-face-tool"
                      disabled={busy}
                      onClick={() => {
                        setMoveTo(localInputValue(week.at, seriesZone));
                        setMoving(true);
                      }}
                    >
                      Move…
                    </button>
                  )}
                  {onMove && moving && (
                    <>
                      <label className="eac-series__field">
                        <span>New date and time ({seriesZone.replace(/_/g, " ")})</span>
                        <input className="eac-input" type="datetime-local" value={moveTo} onChange={(e) => setMoveTo(e.target.value)} />
                      </label>
                      <button
                        type="button"
                        className="eac-face-tool"
                        disabled={busy || !moveTo}
                        onClick={() => void act(() => onMove(moveTo)).then((ok) => ok && setMoving(false))}
                      >
                        Move
                      </button>
                      <button type="button" className="eac-face-tool" disabled={busy} onClick={() => setMoving(false)}>
                        Keep
                      </button>
                    </>
                  )}
                </div>
              )}
              {cancelled && (
                <p className="eac-series__hint">Cancelled: off the public pages, no RSVPs and no reminders. Nobody was emailed.</p>
              )}
              {!cancelled && week.isMoved && week.slotAt && (
                <p className="eac-series__hint">Moved from {fmtDateTime(week.slotAt, tz)}.</p>
              )}
            </>
          ) : (
            <div className="eac-series__read">
              {week.subtitle && <p className="eac-series__subtitle">{week.subtitle}</p>}
              {week.bodyHtml ? (
                // Sanitised by the server (sanitizeRichText on write).
                <div className="eac-series__rich" dangerouslySetInnerHTML={{ __html: week.bodyHtml }} />
              ) : week.summary ? (
                <p>{week.summary}</p>
              ) : (
                <p className="eac-rota__plan-empty">Nothing written yet.</p>
              )}
              <MaterialList items={week.materials} editable={false} />
            </div>
          )}
        </div>
      )}
    </li>
  );
}

/** `at` as the value of a datetime-local input, read in `timeZone` (the browser's zone when absent). */
function localInputValue(at: string, timeZone?: string): string {
  const parts: Record<string, string> = {};
  try {
    for (const p of new Intl.DateTimeFormat("en-CA", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).formatToParts(new Date(at))) {
      if (p.type !== "literal") parts[p.type] = p.value;
    }
  } catch {
    return "";
  }
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour === "24" ? "00" : parts.hour}:${parts.minute}`;
}

function RoleSlot({
  label,
  role,
  person,
  editable,
  viewerId,
  candidates,
  onAssign,
}: {
  label: string;
  role: "host" | "co-host";
  person: SeriesPlannerPerson | null;
  editable: boolean;
  viewerId: string | null;
  candidates: Array<{ userId: string; displayName: string }>;
  onAssign: (role: "host" | "co-host", userId: string | null) => Promise<boolean>;
}) {
  const mine = Boolean(viewerId) && person?.userId === viewerId;
  if (editable) {
    return (
      <label className="eac-series__role">
        <span>{label}</span>
        <select className="eac-input" value={person?.userId ?? ""} onChange={(e) => void onAssign(role, e.target.value || null)}>
          <option value="">Nobody yet</option>
          {candidates.map((c) => (
            <option key={c.userId} value={c.userId}>{c.displayName}</option>
          ))}
        </select>
      </label>
    );
  }
  return (
    <div className="eac-series__role">
      <span>{label}</span>
      <div className="eac-series__role-val">
        {person?.displayName ?? <em>Nobody yet</em>}
        {mine && (
          <button type="button" className="eac-face-tool eac-rota__self" onClick={() => void onAssign(role, null)}>
            Step down
          </button>
        )}
      </div>
    </div>
  );
}

function MaterialList({
  items,
  editable,
  onRemove,
}: {
  items: SeriesPlannerMaterial[];
  editable: boolean;
  onRemove?: (id: string) => void;
}) {
  if (items.length === 0) return <p className="eac-rota__plan-empty">No materials yet.</p>;
  return (
    <ul className="eac-series__materials">
      {items.map((m) => (
        <li key={m.id}>
          <a href={m.url} target="_blank" rel="noreferrer">
            <span className="eac-series__mkind">{m.kind}</span> {m.name}
          </a>
          {editable && onRemove && (
            <button type="button" className="eac-rota__plan-edit" onClick={() => onRemove(m.id)} aria-label={`Remove ${m.name}`}>
              Remove
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

/** TipTap's empty document. */
function emptyHtml(html: string): boolean {
  return html.replace(/<p>(\s|<br\s*\/?>)*<\/p>/gi, "").trim() === "";
}

/** A plain write-up as paragraphs: a blank line starts one, a single newline breaks a line. */
function textToHtml(text: string | null | undefined): string {
  const t = (text ?? "").trim();
  if (!t) return "";
  const esc = (x: string) => x.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return t
    .split(/\n\s*\n/)
    .map((para) => `<p>${esc(para.trim()).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

/** A small framed thumbnail at the start of a planner row; an empty slot when there is no picture. */
function CoverThumb({ cover }: { cover: SeriesPlannerCover | null }) {
  const still = cover ? (cover.kind === "image" ? cover.url : cover.posterUrl ?? null) : null;
  return (
    <span className={`eac-series__thumb${still ? "" : " is-empty"}`} aria-hidden="true">
      {still ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={still} alt="" style={cover?.kind === "image" ? coverFrameStyle(cover.frame) : { objectFit: "cover" }} />
      ) : cover?.kind === "video" || cover?.kind === "embed" ? (
        <span className="eac-series__thumb-play">▶</span>
      ) : null}
    </span>
  );
}

/** "Weekly · Mondays", from the schedule. */
function autoRhythm(settings: SeriesPlannerSettings): string {
  const p = settings.recurrencePattern;
  const n = settings.schedule?.intervalWeeks ?? 1;
  const r = p === "MONTHLY" ? "Monthly" : p === "DAILY" ? "Daily" : n > 1 ? `Every ${n} weeks` : "Weekly";
  return settings.schedule ? `${r} · ${WEEKDAYS[settings.schedule.weekday]}s` : r;
}

/**
 * The series' card as the public Series page draws it, and its landing
 * slide, updated as the organiser types (2026-10-18, mockup E). Drawn on a
 * dark ground like the public site; the classes are `.eac-cardprev*`
 * (surface.css), self-contained so any host shows the same preview.
 */
function SeriesCardPreview({
  settings,
  fields,
  cover,
  weeks,
}: {
  settings: SeriesPlannerSettings;
  fields: SettingsFields;
  cover: SeriesPlannerCover | null;
  weeks: SeriesPlannerWeek[];
}) {
  const accents = settings.accents ?? [];
  const a = accents.find((x) => x.id === fields.accent) ?? accents[0];
  const mark = a?.color ?? "#c9a24a";
  const text = a?.text ?? mark;
  const sched = settings.schedule;
  const tz = sched?.timeZone;
  const first = sched ? new Date(`${sched.firstDate}T12:00:00Z`) : null;
  const upcoming = first ? first.getTime() > Date.now() : false;
  const status = upcoming && first ? `Starts ${first.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })}` : "Running";
  const rhythmLine = fields.rhythmOwn === "1" && fields.rhythm.trim() ? fields.rhythm.trim() : autoRhythm(settings);
  const next = weeks.find((w) => !w.isPast && w.isPublished !== false && w.title) ?? null;
  const nextDate = next
    ? new Date(next.at).toLocaleDateString("en-GB", { timeZone: tz, weekday: "short", day: "numeric", month: "short" })
    : null;
  const lede = (fields.lede || settings.excerpt || "").trim();
  const shortLede = lede.length > 160 ? `${lede.slice(0, 157).replace(/\s+\S*$/, "")}…` : lede;
  const still = cover ? (cover.kind === "image" ? cover.url : cover.posterUrl ?? null) : null;
  const style = { "--cp-acc": mark, "--cp-acc-text": text } as React.CSSProperties;

  const media = (
    <span className="eac-cardprev__cover">
      {cover?.kind === "video" ? (
        <video src={cover.url} poster={cover.posterUrl ?? undefined} muted loop autoPlay playsInline />
      ) : still ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={still} alt="" style={cover?.kind === "image" ? coverFrameStyle(cover.frame) : { objectFit: "cover" }} />
      ) : (
        <span className="eac-cardprev__blank">{cover?.kind === "embed" ? "▶ video" : "No cover yet"}</span>
      )}
    </span>
  );

  return (
    <div className="eac-cardprev" style={style}>
      <p className="eac-cardprev__k">Preview · Series page card</p>
      <div className={`eac-cardprev__card${fields.listed === "1" ? "" : " is-unlisted"}`}>
        <span className="eac-cardprev__media">
          {media}
          {fields.statusChip !== "hide" && <span className="eac-cardprev__tag">{status}</span>}
        </span>
        <span className="eac-cardprev__body">
          <span className="eac-cardprev__rhythm">
            <i aria-hidden="true" />
            {rhythmLine}
            {fields.featured === "1" ? " · Featured" : ""}
          </span>
          <span className="eac-cardprev__t">{fields.title || "Series name"}</span>
          {shortLede && <span className="eac-cardprev__lede">{shortLede}</span>}
          {sched && <span className="eac-cardprev__time">{sched.time} · Online · free</span>}
          <span className="eac-cardprev__next">
            {next ? (
              <>
                <b>{nextDate}</b> {next.title}
              </>
            ) : (
              "The first session will be announced here."
            )}
          </span>
        </span>
      </div>
      {fields.listed !== "1" && <p className="eac-cardprev__note">Not listed: this card is not shown on the Series page.</p>}

      <p className="eac-cardprev__k">Preview · landing slide</p>
      <div className={`eac-cardprev__slide${fields.landing === "1" ? "" : " is-unlisted"}`}>
        <span className="eac-cardprev__slidebody">
          <span className="eac-cardprev__rhythm">
            <i aria-hidden="true" />
            {fields.featured === "1" ? "Current series · first" : "Series"}
          </span>
          <span className="eac-cardprev__t eac-cardprev__t--slide">{fields.title || "Series name"}</span>
          <span className="eac-cardprev__lede">{next ? `Next: ${nextDate} · ${next.title}` : "The next session will be announced."}</span>
        </span>
        {media}
      </div>
      {fields.landing !== "1" && <p className="eac-cardprev__note">Not in the landing page slides.</p>}
    </div>
  );
}

/** The preview's show/hide choice, remembered in this browser (2026-10-18). */
function usePreviewToggle(): [boolean, React.Dispatch<React.SetStateAction<boolean>>] {
  const [on, setOn] = React.useState(true);
  React.useEffect(() => {
    try {
      if (window.localStorage.getItem("eac:series-preview") === "0") setOn(false);
    } catch {
      /* storage unavailable: shown */
    }
  }, []);
  React.useEffect(() => {
    try {
      window.localStorage.setItem("eac:series-preview", on ? "1" : "0");
    } catch {
      /* not remembered */
    }
  }, [on]);
  return [on, setOn];
}

/** An on/off switch (mockup E's "Where it shows"): a button with role="switch". */
function Switch({ on, onChange, label, hint }: { on: boolean; onChange: (on: boolean) => void; label: string; hint?: string }) {
  return (
    <div className="eac-switch">
      <button type="button" role="switch" aria-checked={on} className={`eac-switch__btn${on ? " is-on" : ""}`} onClick={() => onChange(!on)}>
        <span className="eac-switch__track" aria-hidden="true">
          <span className="eac-switch__knob" />
        </span>
        <span className="eac-switch__label">{label}</span>
      </button>
      {hint && <span className="eac-switch__hint">{hint}</span>}
    </div>
  );
}

/** A week's stored cover as the form edits it. */
function weekCoverValue(week: SeriesPlannerWeek): CoverValue | null {
  if (!week.coverImageUrl) return null;
  const kind = week.coverKind ?? "image";
  return kind === "image"
    ? { url: week.coverImageUrl, kind, frame: week.coverFrame ?? null }
    : { url: week.coverImageUrl, kind, posterUrl: week.coverPosterUrl ?? null };
}

function shortText(text: string, max: number): string {
  const t = text.trim();
  return t.length > max ? `${t.slice(0, max - 3).replace(/\s+\S*$/, "")}…` : t;
}

/**
 * A week as the public pages show it, updated as the host types
 * (2026-10-18): its row on the series page, and the next-session band it
 * becomes when it is the coming week. Dark ground, `.eac-cardprev*`.
 */
function SessionPreview({
  week,
  title,
  subtitle,
  body,
  cover,
  tz,
}: {
  week: SeriesPlannerWeek;
  title: string;
  subtitle: string;
  body: string;
  cover: CoverValue | null;
  tz: { timeZone?: string };
}) {
  const d = new Date(week.at);
  const dow = d.toLocaleDateString("en-GB", { ...tz, weekday: "short" });
  const day = d.toLocaleDateString("en-GB", { ...tz, day: "numeric" });
  const mon = d.toLocaleDateString("en-GB", { ...tz, month: "short" });
  const time = d.toLocaleTimeString("en-US", { ...tz, hour: "numeric", minute: "2-digit" }).toLowerCase();
  const still = cover ? (cover.kind === "image" ? cover.url : cover.posterUrl ?? null) : null;
  const plain = body.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
  const thumb = (
    <span className="eac-cardprev__thumb">
      {cover?.kind === "video" && !still ? (
        <video src={cover.url} muted loop autoPlay playsInline />
      ) : still ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={still} alt="" style={cover?.kind === "image" ? coverFrameStyle(cover.frame) : { objectFit: "cover" }} />
      ) : (
        <span className="eac-cardprev__blank">{cover ? "▶" : ""}</span>
      )}
    </span>
  );
  const dateBox = (
    <span className="eac-cardprev__date" aria-hidden="true">
      <small>{dow}</small>
      <b>{day}</b>
      <small>{mon}</small>
    </span>
  );
  return (
    <div className="eac-cardprev">
      <p className="eac-cardprev__k">Preview · row on the series page</p>
      <div className="eac-cardprev__row">
        {dateBox}
        {thumb}
        <span className="eac-cardprev__rowbody">
          <span className="eac-cardprev__rhythm"><i aria-hidden="true" />Session {week.number}</span>
          <span className="eac-cardprev__t eac-cardprev__t--row">{title || "Untitled week"}</span>
          {subtitle && <span className="eac-cardprev__sub">{subtitle}</span>}
          <span className="eac-cardprev__time">{week.host?.displayName ?? "Host to be announced"} · {time}</span>
        </span>
      </div>
      <p className="eac-cardprev__k">Preview · next-session band</p>
      <div className="eac-cardprev__band">
        {dateBox}
        <span className="eac-cardprev__rowbody">
          <span className="eac-cardprev__rhythm"><i aria-hidden="true" />Next session · Session {week.number}</span>
          <span className="eac-cardprev__t">{title || "Untitled week"}</span>
          {subtitle && <span className="eac-cardprev__sub">{subtitle}</span>}
          <span className="eac-cardprev__btn">I&apos;m coming</span>
        </span>
      </div>
      {plain && (
        <>
          <p className="eac-cardprev__k">Preview · start of the write-up</p>
          <p className="eac-cardprev__lede">{shortText(plain, 220)}</p>
        </>
      )}
      {!(week.isPublished ?? true) && <p className="eac-cardprev__note">A draft: none of this is public until the week is published.</p>}
    </div>
  );
}
