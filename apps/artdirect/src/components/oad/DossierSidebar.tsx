"use client";

import { useCallback, useEffect, useState } from "react";
import "./dossier-sidebar.css";
import {
  dossierFieldGroups,
  type DossierFieldGroup,
  type DossierFieldMeta,
} from "@elkdonis/cms-bindings/dossier";
import { PROFILE_LAYOUTS } from "@elkdonis/cms-ui/profile";
import {
  saveDossierFieldAction,
  setProfileSectionAction,
  setProfileLayoutAction,
  type DossierFieldValue,
} from "@/lib/dossier-editor-actions";

// ============================================================================
// Your file — the owner's panel on their own profile.
//
// ── Why a sidebar and not a settings page ──────────────────────────────────
//
// Every field in here changes something visible three inches to the left. A
// separate /settings route would make the person type into a form, save,
// navigate, look, and go back — and the dossier is a design where the effect
// of filling in "Occupation" is not obvious until you see the line fill. So
// the panel sits ON the page it edits.
//
// ── Why it is generated ────────────────────────────────────────────────────
//
// The groups, their order, their fields and their controls all come from
// `dossierFieldGroups`, which is the same declaration the template's manifest
// is validated against. Nothing about the dossier is described twice. Adding a
// field to the registry adds its control here; adding a section to the
// template adds its switch. The alternative — a hand-written form — is how the
// old field registry ended up naming columns of a table that no longer held a
// profile, with nobody noticing, because nothing read it.
//
// Sections whose content is authored elsewhere (their writing, their events,
// their listings) get an explanation and a way out rather than a control. A
// thread belongs to the org it was filed on, and a panel that offered to edit
// it here would be offering to write to the wrong place.
// ============================================================================

type Values = Record<string, DossierFieldValue>;
type Row = Record<string, unknown>;

export interface DossierSidebarProps {
  profileUserId: string;
  slug: string;
  /** Current values, by trait. */
  values: Values;
  /** `users.profile_sections` as the page rendered it. */
  sections: Record<string, boolean>;
  /** Section ids currently rendering on the page. */
  visibleSections: string[];
  /** `users.profile_layout`. */
  layout: string;
  /** Whether they have an active marketplace store behind the store section. */
  hasStore: boolean;
  marketplaceUrl: string;
  networkUrl: string;
}

export function DossierSidebar(props: DossierSidebarProps) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Values>(props.values);
  const [sections, setSections] = useState(props.sections);
  const [layout, setLayout] = useState(props.layout);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const visible = new Set(props.visibleSections);

  /**
   * Tell the page the panel is open, so it can move over rather than be
   * covered by it. On <body> rather than on a wrapper because the page's own
   * markup comes from the template as an HTML string — there is no React
   * element around it to give a class to.
   */
  useEffect(() => {
    const body = document.body;
    if (open) body.dataset.dosSide = "open";
    else delete body.dataset.dosSide;
    return () => {
      delete body.dataset.dosSide;
    };
  }, [open]);

  const flash = useCallback((trait: string) => {
    setSaved(trait);
    window.setTimeout(() => setSaved((s) => (s === trait ? null : s)), 1600);
  }, []);

  /**
   * Fields save on blur, not on every keystroke.
   *
   * The page behind the panel is server-rendered, so making a change visible
   * means reloading it — which cannot happen per keystroke. Blur is the moment
   * the person has finished with a field and is the last point at which a
   * reload is not an interruption.
   */
  async function saveField(trait: string, value: DossierFieldValue) {
    setBusy(trait);
    setError(null);
    const res = await saveDossierFieldAction(props.profileUserId, trait, value);
    setBusy(null);
    if (!res.ok) {
      setError(res.error ?? "Could not save that.");
      return;
    }
    flash(trait);
  }

  async function toggleSection(key: string, on: boolean) {
    setSections((s) => ({ ...s, [key]: on }));
    setBusy(key);
    setError(null);
    const res = await setProfileSectionAction(props.profileUserId, key, on);
    setBusy(null);
    if (!res.ok) {
      // Put the switch back: a toggle left flipped after a failed save says a
      // section is on when it is not.
      setSections((s) => ({ ...s, [key]: !on }));
      setError(res.error ?? "Could not save that.");
      return;
    }
    window.location.reload();
  }

  async function chooseLayout(next: string) {
    const previous = layout;
    setLayout(next);
    setBusy("layout");
    setError(null);
    const res = await setProfileLayoutAction(props.profileUserId, next);
    setBusy(null);
    if (!res.ok) {
      setLayout(previous);
      setError(res.error ?? "Could not save that.");
      return;
    }
    window.location.reload();
  }

  return (
    <>
      <button
        type="button"
        className="eac-dos-side-tab"
        data-open={open ? "true" : "false"}
        aria-expanded={open}
        aria-controls="dos-sidebar"
        onClick={() => setOpen((o) => !o)}
      >
        {open ? "Close" : "Your file"}
      </button>

      <aside
        id="dos-sidebar"
        className="eac-dos-side"
        data-open={open ? "true" : "false"}
        aria-hidden={!open}
      >
        <header className="eac-dos-side-head">
          <h2>Your file</h2>
          <p>
            Everything here changes the page behind this panel. Only you can see
            these controls.
          </p>
        </header>

        {error && <p className="eac-dos-side-error" role="alert">{error}</p>}

        <LayoutPicker current={layout} busy={busy === "layout"} onChoose={chooseLayout} />

        {/* A person on the plain page can still set every field — the same
            facts feed both layouts — but the section switches and the field
            groups are named after the dossier's own sections, so say which
            page they are looking at rather than pretending it does not matter. */}
        {layout !== "dossier" && (
          <p className="eac-dos-side-note">
            You are on the plain page. These fields still save, and the ones it
            shows — your name, note, portrait, work and links — take effect
            straight away.
          </p>
        )}

        {dossierFieldGroups.map((group) => (
          <Group
            key={group.sectionId}
            group={group}
            values={values}
            setValues={setValues}
            sectionOn={group.sectionKey ? Boolean(sections[group.sectionKey]) : true}
            showing={visible.has(group.sectionId)}
            busy={busy}
            saved={saved}
            hasStore={props.hasStore}
            marketplaceUrl={props.marketplaceUrl}
            networkUrl={props.networkUrl}
            slug={props.slug}
            onSave={saveField}
            onToggle={toggleSection}
          />
        ))}
      </aside>
    </>
  );
}

function LayoutPicker({
  current,
  busy,
  onChoose,
}: {
  current: string;
  busy: boolean;
  onChoose: (id: string) => void;
}) {
  return (
    <section className="eac-dos-side-group">
      <h3>How your page looks</h3>
      <p className="eac-dos-side-blurb">
        Two ways of showing the same facts. Switching does not lose anything.
      </p>
      <div className="eac-dos-side-layouts">
        {PROFILE_LAYOUTS.map((option) => (
          <label
            key={option.id}
            className="eac-dos-side-layout"
            data-checked={current === option.id ? "true" : "false"}
          >
            <input
              type="radio"
              name="dos-layout"
              value={option.id}
              checked={current === option.id}
              disabled={busy}
              onChange={() => onChoose(option.id)}
            />
            <span>
              <b>{option.label}</b>
              <span>{option.description}</span>
            </span>
          </label>
        ))}
      </div>
    </section>
  );
}

function Group(props: {
  group: DossierFieldGroup;
  values: Values;
  setValues: React.Dispatch<React.SetStateAction<Values>>;
  sectionOn: boolean;
  showing: boolean;
  busy: string | null;
  saved: string | null;
  hasStore: boolean;
  marketplaceUrl: string;
  networkUrl: string;
  slug: string;
  onSave: (trait: string, value: DossierFieldValue) => void;
  onToggle: (key: string, on: boolean) => void;
}) {
  const { group, sectionOn, showing } = props;

  // The store switch is meaningless without a store behind it, and a switch
  // that does nothing is worse than an absent one.
  if (group.sectionKey === "store" && !props.hasStore) {
    return (
      <section className="eac-dos-side-group">
        <h3>{group.title}</h3>
        <p className="eac-dos-side-blurb">{group.blurb}</p>
        <a className="eac-dos-side-out" href={`${props.marketplaceUrl}/studio/apply`}>
          Open a store in the marketplace →
        </a>
      </section>
    );
  }

  const status = showing
    ? "Showing"
    : group.sectionKey && !sectionOn
      ? "Switched off"
      : "Nothing in it yet";

  return (
    <section className="eac-dos-side-group" data-showing={showing ? "true" : "false"}>
      <h3>
        {group.title}
        <span className="eac-dos-side-status">{status}</span>
      </h3>
      <p className="eac-dos-side-blurb">{group.blurb}</p>

      {group.sectionKey && (
        <label className="eac-dos-side-switch">
          <input
            type="checkbox"
            checked={sectionOn}
            disabled={props.busy === group.sectionKey}
            onChange={(e) => props.onToggle(group.sectionKey!, e.currentTarget.checked)}
          />
          <span>Show this section on my page</span>
        </label>
      )}

      {group.managedElsewhere && (
        <p className="eac-dos-side-managed">
          {group.managedElsewhere.what} — {group.managedElsewhere.where}.
          {group.managedElsewhere.hrefKey === "marketplace" && (
            <>
              {" "}
              <a href={`${props.marketplaceUrl}/studio`}>Open the studio →</a>
            </>
          )}
          {group.managedElsewhere.hrefKey === "network" && (
            <>
              {" "}
              <a href={`${props.networkUrl}/center`}>Go to your centre →</a>
            </>
          )}
        </p>
      )}

      {group.fields.map((field) => (
        <Field
          key={field.trait}
          field={field}
          value={props.values[field.trait]}
          busy={props.busy === field.trait}
          saved={props.saved === field.trait}
          slug={props.slug}
          onChange={(v) => props.setValues((s) => ({ ...s, [field.trait]: v }))}
          onSave={(v) => props.onSave(field.trait, v)}
        />
      ))}
    </section>
  );
}

function Field({
  field,
  value,
  busy,
  saved,
  slug,
  onChange,
  onSave,
}: {
  field: DossierFieldMeta;
  value: DossierFieldValue | undefined;
  busy: boolean;
  saved: boolean;
  slug: string;
  onChange: (v: DossierFieldValue) => void;
  onSave: (v: DossierFieldValue) => void;
}) {
  const mark = busy ? "Saving…" : saved ? "Saved" : "";

  if (field.input === "compound") {
    return (
      <RowsField
        field={field}
        rows={Array.isArray(value) ? (value as Row[]) : []}
        mark={mark}
        slug={slug}
        onChange={(rows) => onChange(rows)}
        onSave={(rows) => onSave(rows)}
      />
    );
  }

  if (field.input === "image") {
    return (
      <ImageField
        field={field}
        value={typeof value === "string" ? value : ""}
        mark={mark}
        slug={slug}
        onChange={onChange}
        onSave={onSave}
      />
    );
  }

  // A list field is stored as an array and edited as one line per item. The
  // textarea holds the joined form; `coerce` on the server splits it back.
  const text = Array.isArray(value) ? (value as string[]).join("\n") : String(value ?? "");
  const Control = field.input === "textarea" ? "textarea" : "input";

  return (
    <label className="eac-dos-side-field">
      <span className="eac-dos-side-label">
        {field.label}
        {mark && <em>{mark}</em>}
      </span>
      <Control
        {...(Control === "input" ? { type: field.input === "url" ? "url" : "text" } : { rows: 4 })}
        value={text}
        placeholder={field.placeholder}
        onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
          onChange(e.currentTarget.value)
        }
        onBlur={(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) =>
          onSave(e.currentTarget.value)
        }
      />
      {field.hint && <span className="eac-dos-side-hint">{field.hint}</span>}
    </label>
  );
}

function ImageField({
  field,
  value,
  mark,
  slug,
  onChange,
  onSave,
}: {
  field: DossierFieldMeta;
  value: string;
  mark: string;
  slug: string;
  onChange: (v: string) => void;
  onSave: (v: string) => void;
}) {
  const [uploading, setUploading] = useState(false);

  async function upload(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    const body = new FormData();
    body.append("file", file);
    body.append("slug", slug);
    body.append("target", "avatar");
    const res = await fetch("/api/upload", { method: "POST", body });
    const data = (await res.json().catch(() => ({}))) as { url?: string };
    setUploading(false);
    if (res.ok && data.url) {
      onChange(data.url);
      onSave(data.url);
    }
  }

  return (
    <div className="eac-dos-side-field">
      <span className="eac-dos-side-label">
        {field.label}
        {(mark || uploading) && <em>{uploading ? "Uploading…" : mark}</em>}
      </span>
      <label className="eac-dos-side-upload">
        {value && <img src={value} alt="" />}
        <span className="eac-dos-side-btn">{value ? "Replace" : "Upload"}</span>
        <input
          type="file"
          accept="image/*"
          disabled={uploading}
          onChange={(e) => void upload(e.currentTarget.files?.[0])}
        />
      </label>
      {field.hint && <span className="eac-dos-side-hint">{field.hint}</span>}
    </div>
  );
}

/**
 * A repeatable field — the pieces on the wall, the lines of a record, the links.
 *
 * Saved as a whole array on every change rather than per row: the value is one
 * JSONB document, so there is no such thing as saving one row of it, and
 * pretending otherwise would mean a delete that raced an edit could resurrect
 * the deleted row.
 */
function RowsField({
  field,
  rows,
  mark,
  slug,
  onChange,
  onSave,
}: {
  field: DossierFieldMeta;
  rows: Row[];
  mark: string;
  slug: string;
  onChange: (rows: Row[]) => void;
  onSave: (rows: Row[]) => void;
}) {
  const shape = field.itemFields ?? [];

  function edit(index: number, name: string, v: string) {
    onChange(rows.map((row, i) => (i === index ? { ...row, [name]: v } : row)));
  }
  function commit(next: Row[]) {
    onChange(next);
    onSave(next);
  }

  return (
    <div className="eac-dos-side-field">
      <span className="eac-dos-side-label">
        {field.label}
        {mark && <em>{mark}</em>}
      </span>

      <ol className="eac-dos-side-rows">
        {rows.map((row, i) => (
          <li key={i} className="eac-dos-side-row">
            <div className="eac-dos-side-rowhead">
              <span>{i + 1}</span>
              <div>
                <button
                  type="button"
                  disabled={i === 0}
                  aria-label="Move up"
                  onClick={() => {
                    const next = [...rows];
                    [next[i - 1], next[i]] = [next[i], next[i - 1]];
                    commit(next);
                  }}
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={i === rows.length - 1}
                  aria-label="Move down"
                  onClick={() => {
                    const next = [...rows];
                    [next[i + 1], next[i]] = [next[i], next[i + 1]];
                    commit(next);
                  }}
                >
                  ↓
                </button>
                <button
                  type="button"
                  aria-label="Remove"
                  onClick={() => commit(rows.filter((_, j) => j !== i))}
                >
                  ✕
                </button>
              </div>
            </div>

            {shape.map((sub) =>
              sub.input === "image" ? (
                <RowImage
                  key={sub.name}
                  label={sub.label}
                  value={String(row[sub.name] ?? "")}
                  slug={slug}
                  onPicked={(url) => {
                    const next = rows.map((r, j) => (j === i ? { ...r, [sub.name]: url } : r));
                    commit(next);
                  }}
                />
              ) : sub.input === "textarea" ? (
                <label key={sub.name} className="eac-dos-side-sub">
                  <span>{sub.label}</span>
                  <textarea
                    rows={2}
                    value={String(row[sub.name] ?? "")}
                    placeholder={sub.placeholder}
                    onChange={(e) => edit(i, sub.name, e.currentTarget.value)}
                    onBlur={() => onSave(rows)}
                  />
                </label>
              ) : (
                <label key={sub.name} className="eac-dos-side-sub">
                  <span>{sub.label}</span>
                  <input
                    type={sub.input === "url" ? "url" : "text"}
                    value={String(row[sub.name] ?? "")}
                    placeholder={sub.placeholder}
                    onChange={(e) => edit(i, sub.name, e.currentTarget.value)}
                    onBlur={() => onSave(rows)}
                  />
                </label>
              )
            )}
          </li>
        ))}
      </ol>

      <button
        type="button"
        className="eac-dos-side-btn"
        onClick={() => onChange([...rows, {}])}
      >
        Add {rows.length === 0 ? "the first" : "another"}
      </button>
      {field.hint && <span className="eac-dos-side-hint">{field.hint}</span>}
    </div>
  );
}

function RowImage({
  label,
  value,
  slug,
  onPicked,
}: {
  label: string;
  value: string;
  slug: string;
  onPicked: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);

  async function upload(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    const body = new FormData();
    body.append("file", file);
    body.append("slug", slug);
    const res = await fetch("/api/upload", { method: "POST", body });
    const data = (await res.json().catch(() => ({}))) as { url?: string };
    setUploading(false);
    if (res.ok && data.url) onPicked(data.url);
  }

  return (
    <label className="eac-dos-side-sub eac-dos-side-subimage">
      <span>{label}</span>
      <span className="eac-dos-side-upload">
        {value && <img src={value} alt="" />}
        <span className="eac-dos-side-btn">
          {uploading ? "Uploading…" : value ? "Replace" : "Upload"}
        </span>
        <input
          type="file"
          accept="image/*"
          disabled={uploading}
          onChange={(e) => void upload(e.currentTarget.files?.[0])}
        />
      </span>
    </label>
  );
}
