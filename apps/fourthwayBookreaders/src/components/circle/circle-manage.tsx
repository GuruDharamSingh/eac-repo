import Link from "next/link";
import { ArrowDown, ArrowUp, X } from "lucide-react";
import type { Thread } from "@/lib/types";
import type { CirclePageData } from "@/lib/circle-page";
import {
  addCircleUnitsAction,
  moveCircleUnitAction,
  removeCircleUnitAction,
  saveCircleCover,
  saveCircleExcerpt,
  saveCircleSchedule,
  recordCircleStopAction,
  saveCircleStructure,
  saveSessionNotes,
  saveSessionPlan,
  setCircleUnitStatus,
  setSessionHost,
  stageCircleSession,
  stageNextCircleSessions,
} from "@/lib/circle-actions";
import { formatWhen } from "@/lib/format";
import { RichField } from "./circle-client";

/**
 * Owners and guides: staging the circle. Part of the circle page (at the
 * bottom), so it is read in context; /manage/groups links here.
 */

const STATUS_LABEL = { planned: "to read", open: "in progress", done: "read", skipped: "skipped" } as const;

export function CircleManage({ group, data }: { group: Thread; data: CirclePageData }) {
  const hidden = <input type="hidden" name="groupId" value={group.id} />;
  const hostName = (id: string | null) => data.hostCandidates.find((c) => c.userId === id)?.name ?? null;

  return (
    <section id="manage" className="band circle-manage">
      <div className="band__head">
        <h2 className="band__title">Manage this circle</h2>
        <span className="eyebrow">owners &amp; guides · <Link href="/manage/groups">all groups</Link></span>
      </div>

      <h3 className="circle-manage__h">Coming sessions</h3>
      {data.stage.length === 0 ? (
        <p className="empty">Set a schedule below to stage sessions.</p>
      ) : (
        <>
          <table className="circle-manage__table">
            <thead>
              <tr><th>Session</th><th>Host</th><th>Plan line</th><th>Host notes</th><th>Topic</th></tr>
            </thead>
            <tbody>
              {data.stage.map((s) => (
                <tr key={s.occurrenceAt}>
                  <td><strong>{s.number}</strong><br /><span className="circle-manage__muted">{formatWhen(new Date(s.occurrenceAt))}</span></td>
                  <td>
                    <form action={setSessionHost} className="circle-manage__inline">
                      {hidden}
                      <input type="hidden" name="occurrenceAt" value={s.occurrenceAt} />
                      <select name="userId" className="field field--small" defaultValue={s.hostId ?? ""} aria-label="Host">
                        <option value="">— no host —</option>
                        {data.hostCandidates.map((c) => <option key={c.userId} value={c.userId}>{c.name}</option>)}
                        {s.hostId && !hostName(s.hostId) && <option value={s.hostId}>current host</option>}
                      </select>
                      <button className="btn btn--small">Set</button>
                    </form>
                  </td>
                  <td>
                    <form action={saveSessionPlan} className="circle-manage__inline">
                      {hidden}
                      <input type="hidden" name="occurrenceAt" value={s.occurrenceAt} />
                      <input name="plan" className="field field--small" defaultValue={s.plan ?? ""} placeholder="e.g. Finish TOTM 3, discuss p. 12" />
                      <button className="btn btn--small">Save</button>
                    </form>
                  </td>
                  <td>
                    <form action={saveSessionNotes} className="circle-manage__inline">
                      {hidden}
                      <input type="hidden" name="occurrenceAt" value={s.occurrenceAt} />
                      <textarea name="notes" rows={2} className="field field--small" defaultValue={s.notes ?? ""} placeholder="What to bring, what to look at…" />
                      <button className="btn btn--small">Save</button>
                    </form>
                  </td>
                  <td>
                    {s.staged ? (
                      <span className="circle-manage__muted">ready{s.hasDocument ? " · document" : ""}</span>
                    ) : (
                      <form action={stageCircleSession}>
                        {hidden}
                        <input type="hidden" name="occurrenceAt" value={s.occurrenceAt} />
                        <button className="btn btn--small">Stage</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <form action={stageNextCircleSessions} className="circle-manage__inline" style={{ marginTop: 10 }}>
            {hidden}
            <input type="hidden" name="count" value="4" />
            <button className="btn">Stage the next 4 sessions</button>
            <span className="circle-manage__muted">Makes each session&rsquo;s topic in the circle&rsquo;s forum category, for RSVPs, comments and its document.</span>
          </form>
        </>
      )}

      <h3 id="stop" className="circle-manage__h" style={{ marginTop: 26 }}>Where did we stop?</h3>
      {data.stopSittings.length === 0 || data.units.length === 0 ? (
        <p className="empty">Nothing to record yet: no recent session{data.units.length === 0 ? " and no plan" : ""}.</p>
      ) : (
        <form action={recordCircleStopAction} className="card circle-manage__form" style={{ maxWidth: 720 }}>
          {hidden}
          <label><span className="eyebrow">Session</span>
            <select name="sitting" className="field" defaultValue={data.stopSittings[0].occurrenceAt}>
              {data.stopSittings.map((t) => (
                <option key={t.occurrenceAt} value={t.occurrenceAt}>
                  Session {t.number} · {formatWhen(new Date(t.occurrenceAt))}{t.stoppedAt ? ` (stopped at ${t.stoppedAt})` : ""}
                </option>
              ))}
            </select></label>
          <label><span className="eyebrow">Reading</span>
            <select name="unitId" className="field" defaultValue={data.units.find((u) => u.status === "open" || u.status === "planned")?.id}>
              {data.units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select></label>
          <label><span className="eyebrow">Stopped at (page, or mm:ss)</span>
            <input name="position" className="field" inputMode="numeric" placeholder="e.g. 7" /></label>
          <label className="session__check"><input type="checkbox" name="finished" /> We finished it</label>
          <label><span className="eyebrow">Passage from where we stopped (optional — shown on the home page)</span>
            <textarea name="excerpt" rows={4} className="field" placeholder="Paste a few paragraphs. A blank line starts a new paragraph." /></label>
          <div><button className="btn btn--primary">Save where we stopped</button></div>
        </form>
      )}

      <div className="split" style={{ marginTop: 26 }}>
        <form action={saveCircleSchedule} className="card circle-manage__form">
          {hidden}
          <p className="card__title" style={{ margin: 0 }}>Schedule</p>
          <label><span className="eyebrow">First session (Toronto time)</span>
            <input type="datetime-local" name="scheduledAt" className="field" defaultValue={data.schedule.startLocal} /></label>
          <label><span className="eyebrow">Repeats</span>
            <select name="recurrence" className="field" defaultValue={data.schedule.recurrence ?? ""}>
              <option value="">does not repeat</option>
              <option value="WEEKLY">every week</option>
              <option value="MONTHLY">every month</option>
              <option value="DAILY">every day</option>
            </select></label>
          <label><span className="eyebrow">Length (minutes)</span>
            <input type="number" name="durationMinutes" min={15} max={600} className="field" defaultValue={data.schedule.durationMinutes ?? 60} /></label>
          <label><span className="eyebrow">Ends on (optional)</span>
            <input type="date" name="until" className="field" defaultValue={data.schedule.untilLocal} /></label>
          <div><button className="btn btn--primary">Save schedule</button></div>
        </form>

        <form action={saveCircleStructure} className="card circle-manage__form">
          {hidden}
          <p className="card__title" style={{ margin: 0 }}>Reading structure</p>
          <span className="eyebrow">How a session runs (shown on the page)</span>
          <RichField name="structure" defaultValue={data.structureRaw} />
          <label><span className="eyebrow">Units per session (for the estimate)</span>
            <input type="number" name="pace" min={1} max={20} className="field" defaultValue={data.progress.pace} /></label>
          <div><button className="btn">Save</button></div>
        </form>
      </div>

      <form action={saveCircleExcerpt} className="card circle-manage__form" style={{ marginTop: 18 }}>
        {hidden}
        <p className="card__title" style={{ margin: 0 }}>Where we are — for the home page</p>
        <p className="circle-manage__muted" style={{ margin: 0 }}>
          Paste a passage from where the circle stopped. When this group is featured, the home page shows it as
          &ldquo;The page we&rsquo;re on&rdquo;. Leave the text empty to clear it.
        </p>
        <textarea name="excerpt" rows={6} className="field" defaultValue={data.excerpt?.text ?? ""} placeholder="Paste the text here. A blank line starts a new paragraph." />
        <div className="circle-manage__inline">
          <input name="excerptWhere" className="field field--small" defaultValue={data.excerpt?.where ?? ""} placeholder="From, e.g. TOTM 3 — Phenomenal Pen-Pal" />
          <input name="excerptPage" type="number" min={1} className="field field--small" style={{ minWidth: "6rem" }} defaultValue={data.excerpt?.page ?? ""} placeholder="Page" />
        </div>
        <div><button className="btn btn--primary">Post to the home page</button></div>
      </form>

      <form action={saveCircleCover} className="card circle-manage__form" style={{ marginTop: 18 }}>
        {hidden}
        <p className="card__title" style={{ margin: 0 }}>Cover image</p>
        <label><span className="eyebrow">Media path in this org&rsquo;s folder (/api/media/EAC_Network/…)</span>
          <input name="coverUrl" className="field" defaultValue={data.coverUrl} /></label>
        <div><button className="btn">Save cover</button></div>
      </form>

      <h3 id="plan" className="circle-manage__h" style={{ marginTop: 26 }}>The plan ({data.planUnits.length} units)</h3>
      <details>
        <summary className="eyebrow" style={{ cursor: "pointer", marginBottom: 8 }}>Show and edit units</summary>
        <ol className="circle__plan">
          {data.planUnits.map((u, i) => (
            <li key={u.id} data-status={u.status}>
              <span className="circle__plan-name">{u.label ? `${u.label} — ${u.title}` : u.title}</span>
              <span className="circle__plan-meta">
                {[u.length != null ? (u.lengthUnit === "pages" ? `${u.length} pp.` : `${Math.round(u.length / 60)} min`) : null, STATUS_LABEL[u.status], u.hasFile ? null : "no file"].filter(Boolean).join(" · ")}
              </span>
              <span className="circle__plan-tools">
                <form action={setCircleUnitStatus}>
                  {hidden}
                  <input type="hidden" name="unitId" value={u.id} />
                  <select name="status" defaultValue={u.status} className="field field--small" aria-label="Status">
                    {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  <button className="btn btn--small">Set</button>
                </form>
                <form action={moveCircleUnitAction}>
                  {hidden}
                  <input type="hidden" name="unitId" value={u.id} />
                  <button className="btn btn--small" name="dir" value="up" disabled={i === 0} aria-label="Move up"><ArrowUp size={12} /></button>
                  <button className="btn btn--small" name="dir" value="down" disabled={i === data.planUnits.length - 1} aria-label="Move down"><ArrowDown size={12} /></button>
                </form>
                <form action={removeCircleUnitAction}>
                  {hidden}
                  <input type="hidden" name="unitId" value={u.id} />
                  <button className="btn btn--small" aria-label="Remove"><X size={12} /></button>
                </form>
              </span>
            </li>
          ))}
        </ol>
      </details>

      <form action={addCircleUnitsAction} className="card circle-manage__form" style={{ marginTop: 14 }}>
        {hidden}
        <p className="card__title" style={{ margin: 0 }}>Add units</p>
        <p className="eyebrow" style={{ margin: 0 }}>One per line: label | title | length | file (a name in Material/, or a path from the org root)</p>
        <textarea name="lines" rows={4} className="field" placeholder={"Ch. 1 | The Force | 12 | chapter1.pdf"} />
        <label><span className="eyebrow">Kind</span>
          <select name="kind" className="field" defaultValue="document">
            <option value="document">document (pages)</option>
            <option value="chapter">chapter (pages)</option>
            <option value="audio">audio (mm:ss)</option>
            <option value="video">video (mm:ss)</option>
          </select></label>
        <div><button className="btn">Add to the plan</button></div>
      </form>
    </section>
  );
}
