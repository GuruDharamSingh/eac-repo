"use client";

import * as React from "react";
import { Ban, Lightbulb, SkipForward, Star } from "lucide-react";
import { SurfaceFrame, useSurface } from "@elkdonis/cms-ui/surface";
import { fmtLong, fromZonedInput, kindLabel, toZonedInput, type Outlet, type Suggestion } from "@/lib/channel/model";
import { acceptAdjustedAction, dismissSuggestionAction, neverSuggestAction } from "@/lib/channel/actions";
import { suggestionInput, useChannel } from "./context";
import { IdentityMark, OutletIcon } from "./icons";
import { Thumb } from "./bits";
import { outletLabel } from "./labels";

// ============================================================================
// Adjust a suggested step when it is presented (the planner, design D1,
// 2026-11-07): the idea it started from, when (day and time, routine slots
// marked), where (outlet and the name it goes out under), a star for
// importance (owner's choice), and skip for this piece or never suggest.
// "Place it" writes a draft delivery and a plan step; nothing is sent.
// ============================================================================

const TIMES = ["09:00", "10:00", "12:00", "16:00", "18:00"];
const PLACEABLE: Outlet[] = ["instagram", "facebook", "threads", "youtube", "site", "newsletter", "live", "video", "writing"];

export function AdjustSheet({ suggestion }: { suggestion: Suggestion }) {
  const { model, piece: find, scopeOrg, identity } = useChannel();
  const surface = useSurface();
  const piece = find(suggestion.pieceKey);
  const tz = model.timeZone;
  const start = toZonedInput(suggestion.at, tz);
  const [day, setDay] = React.useState<string | null>(start ? start.slice(0, 10) : null);
  const [time, setTime] = React.useState<string>(start ? start.slice(11, 16) : "10:00");
  const [outlet, setOutlet] = React.useState<Outlet>(suggestion.outlet);
  const [identityId, setIdentityId] = React.useState(suggestion.identityId);
  const [important, setImportant] = React.useState(false);
  const [note, setNote] = React.useState("");
  const [never, setNever] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [status, setStatus] = React.useState<{ text: string; alert: boolean } | null>(null);

  // Routine slots this week, by day, for the outlet chosen: marked on the day and time buttons.
  const slots = model.week.days.flatMap((d) => d.items.filter((i) => i.type === "slot" && i.outlet === outlet).map((i) => ({ date: d.date, time: i.type === "slot" ? toZonedInput(i.at, tz).slice(11, 16) : "" })));
  const slotDays = new Set(slots.map((s) => s.date));
  const at = day ? fromZonedInput(`${day}T${time}`, tz) : null;
  const inSlot = Boolean(day && slots.some((s) => s.date === day && s.time === time));
  const connected = (o: Outlet) => (o === "instagram" || o === "facebook" || o === "threads" || o === "youtube" ? Boolean(model.outlets.find((x) => x.id === o)?.connected) : true);
  const who = identity(identityId);
  const input = { ...suggestionInput(suggestion, scopeOrg), identityId };

  async function place(asDraftOnly: boolean) {
    setBusy(true);
    setStatus(null);
    const r = await acceptAdjustedAction(input, { at: asDraftOnly ? null : at, outlet, important, note: note || undefined });
    setBusy(false);
    if (r.ok === false) return setStatus({ text: r.error, alert: true });
    surface.connectors.onMutated?.();
    surface.pop();
  }

  async function skip() {
    setBusy(true);
    const r = await dismissSuggestionAction(input);
    setBusy(false);
    if (r.ok === false) return setStatus({ text: r.error, alert: true });
    surface.connectors.onMutated?.();
    surface.pop();
  }

  async function neverSuggest(scope: "kind" | "any") {
    setBusy(true);
    const r = await neverSuggestAction({ outlet: suggestion.outlet, pieceKind: scope === "kind" && piece ? piece.kind : null, identityId, scopeOrg });
    setBusy(false);
    if (r.ok === false) return setStatus({ text: r.error, alert: true });
    surface.connectors.onMutated?.();
    surface.pop();
  }

  return (
    <SurfaceFrame
      kind="post"
      kicker="Suggested step · opened to adjust"
      title={suggestion.text}
      status={status ? status.text : "Nothing posts until you press Post in New post or the Studio."}
      statusTone={status?.alert ? "error" : "normal"}
      actions={[
        { label: "Save as draft", onClick: () => place(true), disabled: busy || !model.ready },
        { label: at ? `Place it · ${fmtLong(at, tz)}` : "Choose a day", primary: true, onClick: () => place(false), disabled: busy || !at || !model.ready },
      ]}
    >
      <div className="chn-adj">
        {piece && (
          <div className="chn-qs-piece">
            <Thumb piece={piece} size={40} />
            <div>
              <strong>{piece.title}</strong>
              <small>
                {kindLabel(piece.kind)} · {piece.meta}
              </small>
            </div>
          </div>
        )}

        <div className="chn-field">
          <div className="chn-field-row">
            <label htmlFor="adj-idea">
              <Lightbulb size={13} aria-hidden /> The idea
            </label>
            <small>kept with the step</small>
          </div>
          <textarea id="adj-idea" rows={3} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder={suggestion.reason} />
        </div>

        <fieldset className="chn-field">
          <legend>
            When <small className="chn-adj-now">{at ? `${fmtLong(at, tz)}${inSlot ? " · in the routine slot" : ""}` : "not placed yet"}</small>
          </legend>
          <div className="chn-adj-days" role="group" aria-label="Day">
            {model.week.days.map((d) => (
              <button key={d.date} type="button" aria-pressed={day === d.date} onClick={() => setDay(d.date)} data-slot={slotDays.has(d.date) ? "1" : "0"}>
                <span>{d.label.split(" ")[0]}</span>
                <small>{Number(d.date.slice(8, 10))}</small>
              </button>
            ))}
            <button type="button" aria-pressed={day === null} onClick={() => setDay(null)}>
              <span>Later</span>
              <small>not placed</small>
            </button>
          </div>
          {day && (
            <div className="chn-adj-times" role="group" aria-label="Time">
              {[...new Set([...TIMES, ...slots.filter((s) => s.date === day).map((s) => s.time)])].sort().map((t) => (
                <button key={t} type="button" aria-pressed={time === t} onClick={() => setTime(t)}>
                  {t}
                  {slots.some((s) => s.date === day && s.time === t) && <small> slot</small>}
                </button>
              ))}
            </div>
          )}
        </fieldset>

        <fieldset className="chn-field">
          <legend>
            Where <small className="chn-adj-now">{outletLabel(outlet)}{who ? ` · as ${who.kind === "user" ? who.name : who.shortName}` : ""}</small>
          </legend>
          <div className="chn-adj-chips" role="group" aria-label="Outlet">
            {PLACEABLE.map((o) => (
              <button key={o} type="button" aria-pressed={outlet === o} disabled={!connected(o)} onClick={() => setOutlet(o)} title={connected(o) ? undefined : "Not connected"}>
                <OutletIcon outlet={o} size={13} /> {outletLabel(o)}
                {!connected(o) && <small> · not connected</small>}
              </button>
            ))}
          </div>
          {!scopeOrg && model.identities.length > 1 && (
            <div className="chn-adj-chips" role="group" aria-label="Goes out as">
              {model.identities.map((i) => (
                <button key={i.id} type="button" aria-pressed={identityId === i.id} onClick={() => setIdentityId(i.id)}>
                  <IdentityMark initials={i.initials} kind={i.kind} size={16} /> {i.kind === "user" ? i.name : i.shortName}
                </button>
              ))}
            </div>
          )}
        </fieldset>

        <label className="chn-adj-star">
          <input type="checkbox" checked={important} onChange={(e) => setImportant(e.target.checked)} />
          <Star size={16} aria-hidden fill={important ? "currentColor" : "none"} /> Important: it leads Home's row and the dock
        </label>

        <div className="chn-adj-out">
          <button type="button" className="chn-adj-skip" disabled={busy || !model.ready} onClick={skip}>
            <SkipForward size={14} aria-hidden />
            <span>
              <strong>Skip for this piece</strong>
              <small>{piece ? `${piece.title} drops this step; the others stay.` : "Drops this step."}</small>
            </span>
          </button>
          {!never ? (
            <button type="button" className="chn-adj-skip" disabled={busy || !model.ready} onClick={() => setNever(true)}>
              <Ban size={14} aria-hidden />
              <span>
                <strong>Never suggest this</strong>
                <small>Asks for which pieces.</small>
              </span>
            </button>
          ) : (
            <div className="chn-adj-never" role="group" aria-label="Never suggest this for">
              <small>Never suggest {outletLabel(suggestion.outlet)} for…</small>
              {piece && (
                <button type="button" className="chn-btn is-small" disabled={busy} onClick={() => neverSuggest("kind")}>
                  {kindLabel(piece.kind).toLowerCase()} pieces
                </button>
              )}
              <button type="button" className="chn-btn is-small" disabled={busy} onClick={() => neverSuggest("any")}>
                any piece
              </button>
              <button type="button" className="chn-linkbtn" onClick={() => setNever(false)}>
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </SurfaceFrame>
  );
}
