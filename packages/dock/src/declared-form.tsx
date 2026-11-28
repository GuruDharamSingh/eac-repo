"use client";

/**
 * The generic form (2026-11-27, rails desk round 2, lane E): draws an `ActionForm` declaration
 * (packages/actions/src/fields.ts) in the dock's own markup and classes. One declaration, one renderer, two
 * placements:
 *
 *   in the dock      `<DeclaredForm>` inside the step card; the dock asks (confirm card) and runs.
 *   on a host page   `<DeclaredFormStep>` (Sophia's lesson step): the same form plus its own confirm card and run,
 *                    inside `.eac-dock--inline`, so the markup, the pre-fill and the confirm path are the dock's.
 *
 * Values are strings, a toggle is a boolean. Required fields are checked here before the confirm card; the
 * runner's zod schema is still the authority on the server.
 */
import * as React from "react";
import type { ActionForm, ActionResult, FieldSpec, FormValues, LoadedForm, PickItem } from "@elkdonis/actions";
import { fillPlaceholders } from "@elkdonis/actions/confirm";

/** A host's picture upload: gives back the picture's address. Optional; without it the person chooses from their own pictures. */
export type DockUpload = (file: File) => Promise<{ url: string } | { error: string }>;

export interface DeclaredFormProps {
  form: ActionForm;
  /** The person's loaded values (status values or the form's reader). */
  values: Record<string, string>;
  /** The "which one?" list (`form.pick`). */
  pick?: PickItem[] | null;
  /** Lists for `pick` and `image` fields, by reader id. */
  lists?: Record<string, PickItem[]>;
  label?: string;
  busy: boolean;
  upload?: DockUpload;
  /** Called with the typed values and the picked item's id (the run's subject), after the required fields check out. */
  onSubmit: (values: FormValues, ctx: { subject: string | null }) => void;
}

const asText = (v: string | boolean | undefined): string => (typeof v === "boolean" ? String(v) : v ?? "");

function initial(form: ActionForm, values: Record<string, string>): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (const f of form.fields) out[f.name] = f.kind === "toggle" ? values[f.name] === "true" : values[f.name] ?? "";
  return out;
}

export function DeclaredForm({ form, values, pick, lists = {}, label, busy, upload, onSubmit }: DeclaredFormProps) {
  const start = React.useMemo(() => initial(form, values), [form, values]);
  const [vals, setVals] = React.useState<Record<string, string | boolean>>(start);
  const [picked, setPicked] = React.useState<string>("");
  const [error, setError] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState<string | null>(null);
  const uid = React.useId();

  const set = (name: string, v: string | boolean) => {
    setError(null);
    setVals((o) => ({ ...o, [name]: v }));
  };
  const visible = (f: FieldSpec) => !f.showIf || asText(vals[f.showIf.field]) === f.showIf.equals;
  const changed = form.fields.some((f) => asText(vals[f.name]) !== asText(start[f.name]));

  const choose = (id: string) => {
    setPicked(id);
    const item = pick?.find((p) => p.id === id);
    if (item?.values) setVals((o) => ({ ...o, ...initial(form, { ...values, ...item.values }) }));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (form.pick && !picked) return setError(`${form.pick.label}: choose one.`);
    const out: FormValues = {};
    for (const f of form.fields) {
      if (!visible(f)) continue;
      const v = vals[f.name];
      if (f.kind === "toggle") {
        out[f.name] = v === true;
        continue;
      }
      const t = asText(v).trim();
      if (f.required && !t) return setError(`${f.label} is needed.`);
      if (t && "minLength" in f && f.minLength && t.length < f.minLength) return setError(`${f.label}: at least ${f.minLength} characters.`);
      out[f.name] = t;
    }
    onSubmit(out, { subject: form.pick ? picked : null });
  };

  const doUpload = async (name: string, file: File | undefined) => {
    if (!file || !upload) return;
    setUploading(name);
    setError(null);
    const r = await upload(file).catch((): { error: string } => ({ error: "Could not upload that picture." }));
    setUploading(null);
    if ("error" in r) setError(r.error);
    else set(name, r.url);
  };

  const block = form.needsChange && !changed;

  return (
    <form className="eac-dock__form" onSubmit={submit} noValidate>
      {form.pick && (
        <label className="eac-dock__field">
          <span>{form.pick.label}</span>
          <select value={picked} onChange={(e) => choose(e.target.value)}>
            <option value="">{pick && pick.length ? "Choose…" : form.pick.emptyLabel ?? "Nothing to choose yet"}</option>
            {(pick ?? []).map((p) => (
              <option key={p.id} value={p.id}>{p.label}{p.hint ? ` (${p.hint})` : ""}</option>
            ))}
          </select>
        </label>
      )}
      {form.fields.filter(visible).map((f) => {
        const id = `${uid}-${f.name}`;
        const v = vals[f.name];
        const help = f.help ? <span className="eac-dock__hint">{f.help}</span> : null;
        switch (f.kind) {
          case "toggle":
            return (
              <div key={f.name}>
                <label className="eac-dock__field eac-dock__field--check">
                  <input type="checkbox" checked={v === true} onChange={(e) => set(f.name, e.target.checked)} />
                  <span>{f.label}</span>
                </label>
                {help}
              </div>
            );
          case "textarea":
            return (
              <label key={f.name} className="eac-dock__field">
                <span>{f.label}</span>
                <textarea rows={f.rows ?? 4} maxLength={f.maxLength} value={asText(v)} placeholder={f.placeholder} onChange={(e) => set(f.name, e.target.value)} />
                <Fill f={f} values={values} current={asText(v)} onFill={(t) => set(f.name, f.maxLength ? t.slice(0, f.maxLength) : t)} busy={busy} />
                {help}
              </label>
            );
          case "select":
            return (
              <label key={f.name} className="eac-dock__field">
                <span>{f.label}</span>
                <select value={asText(v)} onChange={(e) => set(f.name, e.target.value)}>
                  {!f.required && <option value="">None</option>}
                  {f.required && !asText(v) && <option value="">Choose…</option>}
                  {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                {help}
              </label>
            );
          case "choice":
            return (
              <fieldset key={f.name} className="eac-dock__field eac-dock__choice">
                <legend>{f.label}</legend>
                {f.options.map((o) => (
                  <label key={o.value} className="eac-dock__field--check eac-dock__field">
                    <input type="radio" name={id} value={o.value} checked={asText(v) === o.value} onChange={() => set(f.name, o.value)} />
                    <span>{o.label}{o.hint ? <span className="eac-dock__hint"> {o.hint}</span> : null}</span>
                  </label>
                ))}
                {help}
              </fieldset>
            );
          case "pick": {
            const items = lists[f.reader] ?? [];
            return (
              <label key={f.name} className="eac-dock__field">
                <span>{f.label}</span>
                <select value={asText(v)} onChange={(e) => set(f.name, e.target.value)}>
                  <option value="">{items.length ? "Choose…" : "Nothing to choose yet"}</option>
                  {items.map((p) => <option key={p.id} value={p.id}>{p.label}{p.hint ? ` (${p.hint})` : ""}</option>)}
                </select>
                {help}
              </label>
            );
          }
          case "image": {
            const items = lists[f.library ?? "my-images"] ?? [];
            const url = asText(v);
            return (
              <div key={f.name} className="eac-dock__field">
                <span>{f.label}</span>
                {url && <img className="eac-dock__thumb eac-dock__thumb--big" src={url} alt="" />}
                {upload && (
                  <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={busy || uploading !== null} onChange={(e) => void doUpload(f.name, e.target.files?.[0])} aria-label={`${f.label}: upload a picture`} />
                )}
                {uploading === f.name && <span className="eac-dock__hint">Uploading…</span>}
                {items.length > 0 ? (
                  <>
                    <span className="eac-dock__hint">{upload ? "Or choose one you have already added." : "Choose one of your pictures."}</span>
                    <span className="eac-dock__thumbs">
                      {items.map((p) => (
                        <button key={p.id} type="button" className="eac-dock__thumbbtn" aria-pressed={url === p.id} title={p.label} onClick={() => set(f.name, p.id)}>
                          <img className="eac-dock__thumb" src={p.id} alt={p.label} loading="lazy" />
                        </button>
                      ))}
                    </span>
                  </>
                ) : !upload ? (
                  <span className="eac-dock__hint">You have no pictures added yet. Add one from your page, then come back.</span>
                ) : null}
                {url && !f.required && <button type="button" className="eac-dock__link" onClick={() => set(f.name, "")}>Remove the picture</button>}
                {help}
              </div>
            );
          }
          case "date":
          case "time":
            return (
              <label key={f.name} className="eac-dock__field">
                <span>{f.label}</span>
                <input type={f.kind} value={asText(v)} onChange={(e) => set(f.name, e.target.value)} />
                {help}
              </label>
            );
          default:
            return (
              <label key={f.name} className="eac-dock__field">
                <span>{f.label}</span>
                <input type={f.inputType ?? "text"} value={asText(v)} maxLength={f.maxLength} placeholder={f.placeholder} onChange={(e) => set(f.name, e.target.value)} />
                <Fill f={f} values={values} current={asText(v)} onFill={(t) => set(f.name, f.maxLength ? t.slice(0, f.maxLength) : t)} busy={busy} />
                {help}
              </label>
            );
        }
      })}
      {error && <p className="eac-dock__msg eac-dock__msg--error" role="alert">{error}</p>}
      <div className="eac-dock__act">
        <button type="submit" className="eac-dock__btn" disabled={busy || block || uploading !== null}>{label ?? form.submitLabel}</button>
      </div>
    </form>
  );
}

/** The `fillFrom` helper: a quiet button for an empty field. */
function Fill({ f, values, current, onFill, busy }: { f: FieldSpec; values: Record<string, string>; current: string; onFill: (t: string) => void; busy: boolean }) {
  const src = f.fillFrom ? (values[f.fillFrom.from] ?? "").trim() : "";
  if (!f.fillFrom || !src || current.trim()) return null;
  return (
    <span className="eac-dock__act">
      <button type="button" className="eac-dock__btn eac-dock__btn--quiet" disabled={busy} onClick={() => onFill(src)}>{f.fillFrom.label}</button>
    </span>
  );
}

/** The words a confirm card's placeholders take from what was typed (`ActionForm.confirmVars`: placeholder to field). */
export function confirmWords(form: ActionForm, typed: FormValues): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [ph, field] of Object.entries(form.confirmVars ?? {})) {
    const v = typed[field];
    if (typeof v === "boolean") out[ph] = v ? "on" : "off";
    else if (typeof v === "string" && v.trim()) out[ph] = v.trim();
  }
  return out;
}

/** A confirm card as the dock route sends it (server/dock.ts, `ConfirmCard`). */
export interface DeclaredConfirm {
  kind: "text" | "draft" | "generic";
  text: string;
  title?: string;
  risk: string[];
  template?: string;
  vars?: Record<string, string>;
  map?: Record<string, string>;
}

/** The card's wording, filled again from what was typed; never holds a brace. */
export function resolveConfirm(card: DeclaredConfirm | null | undefined, form: ActionForm, typed: FormValues, fallbackTitle: string): { title: string; text: string; draft: boolean; risk: string[] } {
  const words = { ...(card?.vars ?? {}), ...confirmWords(form, typed) };
  const raw = card?.template ?? card?.text ?? `${fallbackTitle}. This runs now, on your account.`;
  return { title: fillPlaceholders(card?.title ?? fallbackTitle, words), text: fillPlaceholders(raw, words), draft: card?.kind === "draft", risk: card?.risk ?? [] };
}

const RISK_WORD: Record<string, string> = { public: "Public", emails: "Sends email", others: "Affects other people", irreversible: "Cannot be undone", money: "Money" };

export interface DeclaredFormStepProps {
  loaded: LoadedForm;
  /** The step's confirm card, resolved on the server for who is looking (`dockStep` task.confirm, or `confirmView`). */
  confirm?: DeclaredConfirm | null;
  title: string;
  /** The host's server action that performs the entry after the confirm (Sophia: a thin wrapper over `performDeclaredForm`). */
  run: (values: FormValues, ctx: { subject: string | null }) => Promise<ActionResult>;
  upload?: DockUpload;
  /** After a successful run (re-read the step, refresh the page). */
  onDone?: () => void;
}

/**
 * The same form on a host's own page (a lesson step): the dock's form, its confirm card, then the run. It carries
 * `.eac-dock--inline` so the dock's inks and classes apply without the floating corner box.
 */
export function DeclaredFormStep({ loaded, confirm, title, run, upload, onDone }: DeclaredFormStepProps) {
  const [pending, setPending] = React.useState<null | { values: FormValues; subject: string | null }>(null);
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<{ kind: "error" | "ok"; text: string } | null>(null);
  const card = pending ? resolveConfirm(confirm, loaded.form, pending.values, title) : null;

  const go = async () => {
    if (!pending) return;
    setBusy(true);
    setMsg(null);
    const r = await run(pending.values, { subject: pending.subject }).catch((): ActionResult => ({ ok: false, error: "Could not reach the server." }));
    setBusy(false);
    setPending(null);
    if (r.ok === false) setMsg({ kind: "error", text: r.error });
    else {
      setMsg({ kind: "ok", text: "Done." });
      onDone?.();
    }
  };

  return (
    <div className="eac-dock eac-dock--inline">
      {card && pending ? (
        <div className="eac-dock__part eac-dock__confirm" role="alertdialog" aria-label="Confirm">
          <p className="eac-dock__label">Are you sure?{card.draft && <span className="eac-dock__draft"> Draft wording, not approved yet</span>}</p>
          <p className="eac-dock__title">{card.title}</p>
          <p className="eac-dock__detail">{card.text}</p>
          {card.risk.length > 0 && <p className="eac-dock__badges">{card.risk.map((r) => <span key={r} className="eac-dock__badge">{RISK_WORD[r] ?? r}</span>)}</p>}
          <div className="eac-dock__act">
            <button type="button" className="eac-dock__btn" disabled={busy} onClick={() => void go()}>{busy ? "Saving…" : "Confirm"}</button>
            <button type="button" className="eac-dock__btn eac-dock__btn--quiet" disabled={busy} onClick={() => setPending(null)}>Cancel</button>
          </div>
        </div>
      ) : (
        <DeclaredForm
          form={loaded.form}
          values={loaded.values}
          pick={loaded.pick}
          lists={loaded.lists}
          busy={busy}
          upload={upload}
          onSubmit={(values, ctx) => {
            setMsg(null);
            setPending({ values, subject: ctx.subject });
          }}
        />
      )}
      {msg && <p className={msg.kind === "error" ? "eac-dock__msg eac-dock__msg--error" : "eac-dock__msg"} role={msg.kind === "error" ? "alert" : "status"}>{msg.text}</p>}
    </div>
  );
}
