"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Repeat } from "lucide-react";
import { fmtTime, type Outlet, type RoutineView } from "@/lib/channel/model";
import { addRoutineAction, archiveRoutineAction, updateRoutineAction } from "@/lib/channel/actions";
import { CHANNEL_BASE, useChannel } from "./context";
import { OutletIcon } from "./icons";
import { outletLabel } from "./labels";

// ============================================================================
// Routines (the planner, 2026-11-07): the routines that open slots in the
// week, each editable in place (name, outlet, days, time) or archived, and
// the slots they open this week. Adjusting one suggested step (when, where,
// importance, the idea) is the step's own sheet, opened from a chip.
// ============================================================================

const DAYS = [
  { id: "sun", label: "Sun" },
  { id: "mon", label: "Mon" },
  { id: "tue", label: "Tue" },
  { id: "wed", label: "Wed" },
  { id: "thu", label: "Thu" },
  { id: "fri", label: "Fri" },
  { id: "sat", label: "Sat" },
] as const;
const OUTLETS: Outlet[] = ["instagram", "facebook", "site", "writing", "video", "newsletter", "live"];

export function Routines() {
  const { model, href } = useChannel();
  const [editing, setEditing] = React.useState<string | null>(null);
  const [adding, setAdding] = React.useState(model.routines.length === 0);
  const slots = model.week.days.flatMap((d) => d.items.filter((i) => i.type === "slot").map((i) => ({ day: d.label, item: i })));

  return (
    <div className="chn-page">
      <header className="chn-head">
        <div>
          <h1>Routines</h1>
          <p>Each routine opens slots in the week; suggestions for your pieces fill them. Change one here, or a single step when it comes up.</p>
        </div>
        <div className="chn-actions">
          <Link className="chn-btn" href={href(`${CHANNEL_BASE}/queue`)}>
            Open the queue
          </Link>
          {!adding && (
            <button type="button" className="chn-btn is-primary" onClick={() => setAdding(true)}>
              <Plus size={15} aria-hidden /> Add a routine
            </button>
          )}
        </div>
      </header>

      {!model.ready && <p className="chn-empty-line">Routines can be saved once migration 252 is applied.</p>}

      {adding && model.ready && <RoutineEditor onDone={() => setAdding(false)} />}

      {model.routines.length === 0 ? (
        !adding && <p className="chn-empty-line">No routines yet.</p>
      ) : (
        <ul className="chn-rt-list">
          {model.routines.map((r) => (
            <li key={r.id} className="chn-rt">
              <div className="chn-rt-head">
                <OutletIcon outlet={r.outlet} size={18} />
                <div>
                  <strong>{r.name}</strong>
                  <small>
                    {outletLabel(r.outlet)} · {r.cadence}
                    {r.rule.time ? ` · ${r.rule.time}` : ""}
                    {r.source === "sophia" ? " · from Sophia" : ""}
                  </small>
                  <span data-tone={r.tone}>{r.status}</span>
                </div>
                <div className="chn-actions">
                  <button type="button" className="chn-linkbtn" onClick={() => setEditing(editing === r.id ? null : r.id)} aria-expanded={editing === r.id}>
                    {editing === r.id ? "Close" : "Change"}
                  </button>
                  <ArchiveButton routine={r} />
                </div>
              </div>
              {editing === r.id && <RoutineEditor routine={r} onDone={() => setEditing(null)} />}
            </li>
          ))}
        </ul>
      )}

      <section className="chn-rt-week" aria-labelledby="chn-rt-week-h">
        <h2 id="chn-rt-week-h" className="chn-kicker">
          Slots this week · {model.week.label}
        </h2>
        {slots.length === 0 ? (
          <p className="chn-empty-line">No open slots this week.</p>
        ) : (
          <ul className="chn-plain">
            {slots.map(({ day, item }) =>
              item.type === "slot" ? (
                <li key={item.id} className="chn-rt-slot">
                  <Repeat size={13} aria-hidden /> {day} · {fmtTime(item.at, model.timeZone)} · {item.routineName}
                  <small>{item.suggestion ? ` · ${item.suggestion.text}` : " · open"}</small>
                </li>
              ) : null
            )}
          </ul>
        )}
      </section>
    </div>
  );
}

function ArchiveButton({ routine }: { routine: RoutineView }) {
  const { scopeOrg } = useChannel();
  const router = useRouter();
  const [confirm, setConfirm] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  if (!confirm)
    return (
      <button type="button" className="chn-linkbtn" onClick={() => setConfirm(true)}>
        Stop
      </button>
    );
  return (
    <span className="chn-actions">
      <button
        type="button"
        className="chn-btn is-small"
        onClick={async () => {
          const r = await archiveRoutineAction(routine.id, scopeOrg);
          if (r.ok === false) return setError(r.error);
          router.refresh();
        }}
      >
        Stop “{routine.name}”
      </button>
      <button type="button" className="chn-linkbtn" onClick={() => setConfirm(false)}>
        Keep it
      </button>
      {error && <small className="is-alert">{error}</small>}
    </span>
  );
}

function RoutineEditor({ routine, onDone }: { routine?: RoutineView; onDone: () => void }) {
  const { scopeOrg } = useChannel();
  const router = useRouter();
  const rule = routine?.rule ?? {};
  const [name, setName] = React.useState(routine?.name ?? "");
  const [outlet, setOutlet] = React.useState<Outlet>(routine?.outlet ?? "instagram");
  const [mode, setMode] = React.useState<"weekdays" | "monthDay">(rule.monthDay ? "monthDay" : "weekdays");
  const [days, setDays] = React.useState<string[]>(rule.weekdays ?? ["tue", "fri"]);
  const [monthDay, setMonthDay] = React.useState(rule.monthDay ?? 1);
  const [time, setTime] = React.useState(rule.time ?? "10:00");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const id = React.useId();

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const cadence = mode === "weekdays" ? { weekdays: days as never, time } : { monthDay, time };
    const r = routine
      ? await updateRoutineAction({ id: routine.id, scopeOrg, name: name || outletLabel(outlet), outlet, cadence })
      : await addRoutineAction({ name: name || outletLabel(outlet), outlet, cadence, scopeOrg });
    setBusy(false);
    if (r.ok === false) return setError(r.error);
    onDone();
    router.refresh();
  }

  return (
    <form className="chn-routine-form" onSubmit={save}>
      <h3 className="chn-kicker">{routine ? `Change “${routine.name}”` : "Add a routine"}</h3>
      <label>
        Name
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={outletLabel(outlet)} maxLength={80} />
      </label>
      <label>
        Outlet
        <select value={outlet} onChange={(e) => setOutlet(e.target.value as Outlet)}>
          {OUTLETS.map((o) => (
            <option key={o} value={o}>
              {outletLabel(o)}
            </option>
          ))}
        </select>
      </label>
      <fieldset>
        <legend>Repeats</legend>
        <label className="chn-check">
          <input type="radio" name={`${id}-mode`} checked={mode === "weekdays"} onChange={() => setMode("weekdays")} /> On weekdays
        </label>
        {mode === "weekdays" && (
          <span className="chn-daypick">
            {DAYS.map((d) => (
              <label key={d.id} className="chn-check">
                <input type="checkbox" checked={days.includes(d.id)} onChange={(e) => setDays((v) => (e.target.checked ? [...v, d.id] : v.filter((x) => x !== d.id)))} /> {d.label}
              </label>
            ))}
          </span>
        )}
        <label className="chn-check">
          <input type="radio" name={`${id}-mode`} checked={mode === "monthDay"} onChange={() => setMode("monthDay")} /> Once a month, on day
          <input type="number" min={1} max={28} value={monthDay} onChange={(e) => setMonthDay(Number(e.target.value))} disabled={mode !== "monthDay"} />
        </label>
      </fieldset>
      <label>
        At
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
      </label>
      <div className="chn-actions">
        <button type="submit" className="chn-btn is-primary" disabled={busy}>
          {routine ? "Save" : "Add routine"}
        </button>
        <button type="button" className="chn-linkbtn" onClick={onDone}>
          Cancel
        </button>
        {error && <small className="is-alert">{error}</small>}
      </div>
    </form>
  );
}
