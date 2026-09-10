"use client";

import * as React from "react";

// ============================================================================
// Field controls for the manifest-driven wizard and the content composer.
//
// The wizard's *steps* are derived from a template manifest
// (`@elkdonis/cms-bindings` `buildWorkshopWizardSteps`); this file renders the
// *fields* of a step as plain controls. It stays free of any component library
// and of `@elkdonis/cms-bindings` itself — the consuming app maps the manifest
// field shape onto `WizardFieldSpec` below (a near-identity map) so this package
// keeps zero heavy dependencies, the same posture as the rest of cms-ui.
//
// Styling is plain CSS (fields.css) driven by custom properties, NOT Tailwind
// utilities — it was, and that is why the compose surface rendered unstyled
// in ifac and artdirect. Anything richer than these primitives — a Nextcloud
// image picker, a session list, a rich-text body — is a `custom` field the app
// supplies.
//
// Beyond the native inputs, four controls earn their place here because every
// form that has a date has needed them:
//   duration   a slider over sensible lengths, with the exact minutes beside it
//   datetime   a date and a time, and the sentence they make
//   timezone   the zone the wall-clock is read in
//   toggle     a switch, for the yes/no that opens something up
// ============================================================================

export type WizardFieldInput =
  | "text"
  | "textarea"
  | "richtext"
  | "url"
  | "number"
  | "date"
  | "time"
  | "datetime"
  | "duration"
  | "timezone"
  | "select"
  | "radio"
  | "multichoice"
  | "boolean"
  | "toggle"
  | "color"
  | "focal"
  | "sessions"
  | "custom";

export interface WizardFieldOption {
  value: string;
  label: string;
}

/** Show this field only when another answer says so. */
export interface WizardFieldDependency {
  field: string;
  /** Show when the other answer is truthy (default when nothing else is set). */
  truthy?: boolean;
  /** Show when the other answer equals this. */
  equals?: unknown;
  /** Show when the other answer is NOT this (and not empty). */
  not?: unknown;
}

export interface WizardFieldSpec {
  /** Key in the wizard's answer object. Usually the registry trait. */
  name: string;
  label: string;
  input: WizardFieldInput;
  hint?: string;
  placeholder?: string;
  required?: boolean;
  options?: WizardFieldOption[];
  min?: number;
  max?: number;
  /** Render on the same line as the neighbouring `inline` fields. */
  inline?: boolean;
  dependsOn?: WizardFieldDependency;
  /**
   * A widget the host supplies through the composer's slots rather than a
   * per-field `render`: "media" is the org's image picker. The answer is
   * the URL the picker returns.
   */
  slot?: "media";
  /** For `input: "focal"` — the answer key holding the image being positioned. */
  previewField?: string;
  /**
   * For `input: "custom"` — a render function the app supplies (image picker,
   * session editor, …). Receives the current value and a setter.
   */
  render?: (props: {
    value: unknown;
    onChange: (value: unknown) => void;
    id: string;
    field: WizardFieldSpec;
  }) => React.ReactNode;
}

export function fieldDependencySatisfied(
  dep: WizardFieldDependency | undefined,
  answers: Record<string, unknown>
): boolean {
  if (!dep) return true;
  const v = answers[dep.field];
  if (dep.equals !== undefined) return v === dep.equals;
  if (dep.not !== undefined) return v !== dep.not && v !== "" && v !== null && v !== undefined;
  return Boolean(v);
}

function toInputValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

/** One labelled control. */
export function WizardFieldControl({
  field,
  value,
  onChange,
  errors,
  answers,
}: {
  field: WizardFieldSpec;
  value: unknown;
  onChange: (value: unknown) => void;
  errors?: string[];
  /** The whole draft, for controls that preview against another field. */
  answers?: Record<string, unknown>;
}) {
  const id = `wf-${field.name}`;
  const describedBy = field.hint ? `${id}-hint` : undefined;
  // A toggle carries its own text; a label above it would say the same thing twice.
  const selfLabelled = field.input === "toggle" || field.input === "boolean";

  return (
    <div className="eac-field" data-field={field.name}>
      {!selfLabelled && (
        <label htmlFor={id} className="eac-field-label">
          {field.label}
          {field.required && (
            <span aria-hidden className="eac-field-req">
              *
            </span>
          )}
        </label>
      )}

      <Control field={field} value={value} onChange={onChange} id={id} describedBy={describedBy} answers={answers} />

      {field.hint && (
        <p id={describedBy} className="eac-field-hint">
          {field.hint}
        </p>
      )}
      {errors && errors.length > 0 && <p className="eac-field-error">{errors.join(". ")}</p>}
    </div>
  );
}

function Control({
  field,
  value,
  onChange,
  id,
  describedBy,
  answers,
}: {
  field: WizardFieldSpec;
  value: unknown;
  onChange: (value: unknown) => void;
  id: string;
  describedBy?: string;
  answers?: Record<string, unknown>;
}) {
  switch (field.input) {
    case "focal":
      return (
        <FocalControl
          id={id}
          value={value}
          onChange={onChange}
          describedBy={describedBy}
          imageUrl={field.previewField ? String(answers?.[field.previewField] ?? "") : ""}
        />
      );
    case "custom":
      return (
        <>
          {field.render?.({ value, onChange, id, field }) ?? (
            <p className="eac-field-missing">This field needs a picker this app has not supplied.</p>
          )}
        </>
      );

    case "boolean":
      return (
        <label className="eac-check">
          <input
            id={id}
            type="checkbox"
            checked={Boolean(value)}
            aria-describedby={describedBy}
            onChange={(e) => onChange(e.target.checked)}
          />
          <b style={{ fontWeight: 500 }}>{field.label}</b>
          {field.placeholder && <span>— {field.placeholder}</span>}
        </label>
      );

    case "toggle":
      return (
        <button
          id={id}
          type="button"
          role="switch"
          aria-checked={Boolean(value)}
          aria-describedby={describedBy}
          className="eac-toggle"
          onClick={() => onChange(!value)}
        >
          <span className="eac-toggle-track" aria-hidden />
          <span>
            <b style={{ fontWeight: 500 }}>{field.label}</b>
            {field.placeholder && <span className="eac-toggle-text"> — {field.placeholder}</span>}
          </span>
        </button>
      );

    case "select":
      return (
        <select
          id={id}
          className="eac-input"
          value={toInputValue(value)}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value || null)}
        >
          <option value="">{field.placeholder ?? "Select…"}</option>
          {(field.options ?? []).map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      );

    // Single choice shown as radios rather than a dropdown. This is what a
    // poll question is: one `radio` field whose options are the ballot.
    case "radio":
      return (
        <div role="radiogroup" aria-describedby={describedBy} className="eac-choice-list">
          {(field.options ?? []).map((opt) => (
            <label key={opt.value} className="eac-check">
              <input
                type="radio"
                name={id}
                value={opt.value}
                checked={toInputValue(value) === opt.value}
                onChange={() => onChange(opt.value)}
              />
              <b style={{ fontWeight: 400 }}>{opt.label}</b>
            </label>
          ))}
        </div>
      );

    // Multi-select. The answer is always an array, including when empty, so
    // consumers never have to distinguish "unanswered" from "none selected".
    case "multichoice": {
      const selected = Array.isArray(value) ? (value as unknown[]).map(String) : [];
      return (
        <div role="group" aria-describedby={describedBy} className="eac-choice-list">
          {(field.options ?? []).map((opt) => (
            <label key={opt.value} className="eac-check">
              <input
                type="checkbox"
                value={opt.value}
                checked={selected.includes(opt.value)}
                onChange={(e) =>
                  onChange(
                    e.target.checked
                      ? [...selected, opt.value]
                      : selected.filter((v) => v !== opt.value)
                  )
                }
              />
              <b style={{ fontWeight: 400 }}>{opt.label}</b>
            </label>
          ))}
        </div>
      );
    }

    case "textarea":
    case "richtext":
      return (
        <textarea
          id={id}
          rows={field.input === "richtext" ? 8 : 3}
          className="eac-input eac-input--textarea"
          value={toInputValue(value)}
          placeholder={field.placeholder}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "color":
      return (
        <div className="eac-color">
          <input
            id={id}
            type="color"
            value={toInputValue(value) || "#000000"}
            aria-describedby={describedBy}
            onChange={(e) => onChange(e.target.value)}
          />
          <input
            type="text"
            className="eac-input"
            value={toInputValue(value)}
            placeholder="#000000"
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      );

    case "number":
      return (
        <input
          id={id}
          type="number"
          className="eac-input"
          value={toInputValue(value)}
          placeholder={field.placeholder}
          min={field.min}
          max={field.max}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        />
      );

    case "duration":
      return <DurationControl id={id} value={value} onChange={onChange} describedBy={describedBy} />;

    case "datetime":
      return (
        <WhenControl id={id} value={value} onChange={onChange} describedBy={describedBy} placeholder={field.placeholder} />
      );

    case "timezone":
      return <TimeZoneControl id={id} value={value} onChange={onChange} describedBy={describedBy} />;

    case "date":
    case "time":
      return (
        <input
          id={id}
          type={field.input}
          className="eac-input"
          value={toInputValue(value)}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value || null)}
        />
      );

    case "url":
      return (
        <input
          id={id}
          type="url"
          inputMode="url"
          className="eac-input"
          value={toInputValue(value)}
          placeholder={field.placeholder ?? "https://"}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "text":
    default:
      return (
        <input
          id={id}
          type="text"
          className="eac-input"
          value={toInputValue(value)}
          placeholder={field.placeholder}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}

// ── duration ────────────────────────────────────────────────────────────────

/** The lengths a gathering usually is. The slider snaps to these; the number box takes anything. */
const DURATION_STEPS = [15, 30, 45, 60, 75, 90, 120, 150, 180, 240, 300, 360, 480];

export function formatMinutes(minutes: number | null | undefined): string {
  if (!minutes || minutes <= 0) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return h === 1 ? "1 hour" : `${h} hours`;
  return `${h}h ${m}m`;
}

function nearestStepIndex(minutes: number): number {
  let best = 0;
  for (let i = 0; i < DURATION_STEPS.length; i++) {
    if (Math.abs(DURATION_STEPS[i] - minutes) < Math.abs(DURATION_STEPS[best] - minutes)) best = i;
  }
  return best;
}

function DurationControl({
  id,
  value,
  onChange,
  describedBy,
}: {
  id: string;
  value: unknown;
  onChange: (value: unknown) => void;
  describedBy?: string;
}) {
  const minutes = typeof value === "number" ? value : value ? Number(value) : 0;
  const index = minutes ? nearestStepIndex(minutes) : 3;
  const end = (() => {
    if (!minutes) return null;
    return null;
  })();
  void end;

  return (
    <div className="eac-duration">
      <div className="eac-duration-readout">
        <b>{formatMinutes(minutes)}</b>
        <span>{minutes ? `${minutes} minutes` : "how long it runs"}</span>
      </div>
      <input
        id={id}
        type="range"
        min={0}
        max={DURATION_STEPS.length - 1}
        step={1}
        value={index}
        aria-valuetext={formatMinutes(minutes)}
        aria-describedby={describedBy}
        onChange={(e) => onChange(DURATION_STEPS[Number(e.target.value)])}
      />
      <label className="eac-duration-num">
        <input
          type="number"
          className="eac-input"
          min={5}
          max={24 * 60}
          step={5}
          value={minutes || ""}
          aria-label="Exact minutes"
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        />
        min
      </label>
      <div className="eac-duration-ticks" aria-hidden>
        <span>15m</span>
        <span>1h</span>
        <span>2h</span>
        <span>4h</span>
        <span>8h</span>
      </div>
    </div>
  );
}

// ── when ────────────────────────────────────────────────────────────────────

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** The sentence a `YYYY-MM-DDTHH:mm` wall-clock value makes, zone-free. */
export function describeWallClock(value: string): { date: string; time: string } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(value);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(d.getTime())) return null;
  const date = `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  if (!m[4]) return { date, time: "" };
  const h = Number(m[4]);
  const mm = m[5];
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return { date, time: `${h12}:${mm} ${h < 12 ? "AM" : "PM"}` };
}

function WhenControl({
  id,
  value,
  onChange,
  describedBy,
  placeholder,
}: {
  id: string;
  value: unknown;
  onChange: (value: unknown) => void;
  describedBy?: string;
  placeholder?: string;
}) {
  const raw = toInputValue(value);
  const [datePart, timePart] = raw.includes("T") ? raw.split("T") : [raw, ""];
  const described = raw ? describeWallClock(raw) : null;

  function set(date: string, time: string) {
    if (!date) return onChange(null);
    onChange(time ? `${date}T${time.slice(0, 5)}` : `${date}T00:00`);
  }

  return (
    <div className="eac-when">
      <div className="eac-when-inputs">
        <input
          id={id}
          type="date"
          className="eac-input"
          value={datePart}
          aria-describedby={describedBy}
          onChange={(e) => set(e.target.value, timePart || "10:00")}
        />
        <input
          type="time"
          className="eac-input"
          value={timePart.slice(0, 5)}
          aria-label="Time"
          step={300}
          onChange={(e) => set(datePart, e.target.value)}
        />
      </div>
      <p className="eac-when-readout" aria-live="polite">
        {described ? (
          <>
            <b>{described.date}</b>
            {described.time && <> at <b>{described.time}</b></>}
          </>
        ) : (
          placeholder ?? "Pick a day and a time"
        )}
      </p>
    </div>
  );
}

// ── time zone ───────────────────────────────────────────────────────────────

/** The zones an arts network on this continent actually schedules in, then the rest of the world by region. */
const ZONES: Array<{ group: string; zones: string[] }> = [
  { group: "Canada & US", zones: ["America/Toronto", "America/Vancouver", "America/Edmonton", "America/Winnipeg", "America/Halifax", "America/St_Johns", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "America/Anchorage", "Pacific/Honolulu"] },
  { group: "Europe", zones: ["Europe/London", "Europe/Dublin", "Europe/Lisbon", "Europe/Paris", "Europe/Berlin", "Europe/Madrid", "Europe/Rome", "Europe/Amsterdam", "Europe/Stockholm", "Europe/Athens", "Europe/Istanbul", "Europe/Moscow"] },
  { group: "Asia & Pacific", zones: ["Asia/Kolkata", "Asia/Dubai", "Asia/Karachi", "Asia/Bangkok", "Asia/Singapore", "Asia/Hong_Kong", "Asia/Shanghai", "Asia/Tokyo", "Asia/Seoul", "Australia/Perth", "Australia/Sydney", "Pacific/Auckland"] },
  { group: "Americas (south)", zones: ["America/Mexico_City", "America/Bogota", "America/Lima", "America/Sao_Paulo", "America/Buenos_Aires", "America/Santiago"] },
  { group: "Africa", zones: ["Africa/Cairo", "Africa/Lagos", "Africa/Nairobi", "Africa/Johannesburg"] },
];

function zoneLabel(zone: string): string {
  const city = zone.split("/").pop()!.replace(/_/g, " ");
  try {
    const short = new Intl.DateTimeFormat("en", { timeZone: zone, timeZoneName: "short" })
      .formatToParts(new Date())
      .find((p) => p.type === "timeZoneName")?.value;
    return short ? `${city} (${short})` : city;
  } catch {
    return city;
  }
}

function TimeZoneControl({
  id,
  value,
  onChange,
  describedBy,
}: {
  id: string;
  value: unknown;
  onChange: (value: unknown) => void;
  describedBy?: string;
}) {
  const browserZone = React.useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return "";
    }
  }, []);
  const current = toInputValue(value);
  const known = ZONES.some((g) => g.zones.includes(current));

  return (
    <select
      id={id}
      className="eac-input"
      value={current}
      aria-describedby={describedBy}
      onChange={(e) => onChange(e.target.value || null)}
    >
      <option value="">{browserZone ? `Your zone — ${zoneLabel(browserZone)}` : "Select a zone…"}</option>
      {current && !known && <option value={current}>{zoneLabel(current)}</option>}
      {ZONES.map((g) => (
        <optgroup key={g.group} label={g.group}>
          {g.zones.map((z) => (
            <option key={z} value={z}>
              {zoneLabel(z)}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

// ── focal point ─────────────────────────────────────────────────────────────

/**
 * Where a banner is allowed to crop. The image is shown at the banner's own
 * proportion with a line at the chosen height; the value is a percentage
 * from the top, which the page hands to `object-position`. Cropping is a
 * property of the SLOT (a banner is cropped, a hero is shown whole), so this
 * control only appears on fields that are cropped.
 */
function FocalControl({
  id,
  value,
  onChange,
  describedBy,
  imageUrl,
}: {
  id: string;
  value: unknown;
  onChange: (value: unknown) => void;
  describedBy?: string;
  imageUrl: string;
}) {
  const pct = typeof value === "number" ? value : value ? Number(value) : 50;
  return (
    <div className="eac-focal">
      <div
        className="eac-focal-preview"
        onClick={(e) => {
          if (!imageUrl) return;
          const rect = e.currentTarget.getBoundingClientRect();
          onChange(Math.round(((e.clientY - rect.top) / rect.height) * 100));
        }}
        role={imageUrl ? "button" : undefined}
        aria-label={imageUrl ? "Click to set the focal point" : undefined}
        style={{ cursor: imageUrl ? "crosshair" : "default" }}
      >
        {imageUrl ? (
          <>
            <img src={imageUrl} alt="" style={{ objectPosition: `center ${pct}%` }} />
            <span className="eac-focal-line" style={{ top: `${pct}%` }} />
          </>
        ) : (
          <span className="eac-focal-empty">Choose the banner image first</span>
        )}
      </div>
      <div className="eac-focal-row">
        <input
          id={id}
          type="range"
          min={0}
          max={100}
          value={pct}
          aria-describedby={describedBy}
          aria-valuetext={`${pct}% from the top`}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <span>{pct === 50 ? "centred" : pct < 50 ? `${pct}% · keeps the top` : `${pct}% · keeps the bottom`}</span>
      </div>
    </div>
  );
}
