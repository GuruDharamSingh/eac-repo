"use client";

/**
 * Module forms the dock can draw inline (2026-11-16, lane rails). An entry names one with `ActionMeta.dockForm`; the
 * registry stays data and this file holds the components. A form gets the person's current values and a `submit`
 * that goes through the dock's confirm card and then `runAction`. Without a key here the dock falls back to the
 * entry's address (route and highlight).
 *
 * Stub registry: one example. Candidates to reuse later: artdirect's live-edit sidebar boxes, cms-ui and site-forms
 * fields (see the rails report).
 */
import * as React from "react";

export interface DockFormProps {
  values: Record<string, string>;
  label: string;
  busy: boolean;
  submit: (values: Record<string, string>) => void;
}

const FIELDS: Array<{ name: string; label: string; maxLength: number }> = [
  { name: "displayName", label: "Name", maxLength: 120 },
  { name: "headline", label: "One line about what you do", maxLength: 200 },
  { name: "bio", label: "About", maxLength: 2000 },
];

/** Example: the `profile` entry (name, headline, bio). The photo stays on the page. */
function ProfileBasicsForm({ values, label, busy, submit }: DockFormProps) {
  return (
    <form
      className="eac-dock__form"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        submit(Object.fromEntries(FIELDS.map((f) => [f.name, String(fd.get(f.name) ?? "")])));
      }}
    >
      {FIELDS.map((f) => (
        <label key={f.name} className="eac-dock__field">
          <span>{f.label}</span>
          <input name={f.name} type="text" defaultValue={values[f.name] ?? ""} maxLength={f.maxLength} />
        </label>
      ))}
      <div className="eac-dock__act">
        <button type="submit" className="eac-dock__btn" disabled={busy}>{label}</button>
      </div>
    </form>
  );
}

/**
 * The `store-front` entry (2026-11-24, the market's store course): the description of the person's own
 * store. `values.note` is the saved description, `values.bio` the directory bio as plain text; the
 * second button copies the bio in, so a new store can start from what the person already wrote.
 */
function StoreFrontForm({ values, label, busy, submit }: DockFormProps) {
  const [note, setNote] = React.useState(values.note ?? "");
  const bio = (values.bio ?? "").trim();
  return (
    <form
      className="eac-dock__form"
      onSubmit={(e) => {
        e.preventDefault();
        submit({ note });
      }}
    >
      <label className="eac-dock__field">
        <span>Store front description</span>
        <textarea
          name="note"
          rows={4}
          maxLength={1200}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Two or three lines collectors read above your work."
        />
      </label>
      <div className="eac-dock__act">
        <button type="submit" className="eac-dock__btn" disabled={busy || !note.trim()}>{label}</button>
        {bio && !note.trim() ? (
          <button type="button" className="eac-dock__btn eac-dock__btn--quiet" disabled={busy} onClick={() => setNote(bio.slice(0, 1200))}>
            Fill from my directory bio
          </button>
        ) : null}
      </div>
    </form>
  );
}

export const DOCK_FORMS: Record<string, React.ComponentType<DockFormProps>> = {
  "profile-basics": ProfileBasicsForm,
  "store-front": StoreFrontForm,
};
