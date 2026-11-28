// ============================================================================
// The action form declaration (2026-11-27, rails desk round 2, lane E).
//
// ONE declaration per in-dock action, as data. It renders the dock form
// (packages/dock `DeclaredForm`), gives the MCP tool its input schema
// (`actionFormJsonSchema`, server/forms.ts) and later feeds the house editor
// sidebar (docs/open/SITE_FORM_2026-11-16/SYNTHESIS.md, "the join").
//
// Client-safe: no dependencies, no React, no database. Why our own small
// vocabulary and not cms-ui's `WizardFieldSpec`: that type lives in a package that
// pulls React, Tiptap-era slots and the compose bundle into whatever imports it, and
// the dock is mounted on every site. The names here (name, label, required, options,
// maxLength, placeholder, help) match it on purpose, so `toWizardFieldSpec`-style
// adapters stay a few lines. This is a subset, not a fifth way of describing a form.
//
// Values are strings, except a `toggle`, which is a boolean. The runner's zod
// schema (server/run.ts) is the authority on what is accepted; the declaration only
// draws the form and names the fields.
// ============================================================================

export interface FieldOption {
  value: string;
  label: string;
  /** One quiet line under the option (a `choice`). */
  hint?: string;
}

/** Shown only while another field has this value (a toggle: 'true' / 'false'). */
export interface FieldShowIf {
  field: string;
  equals: string;
}

interface FieldBase {
  /** The key in the submitted values, and in the runner's input. */
  name: string;
  /** Plain words, on screen. */
  label: string;
  /** One quiet line under the field. */
  help?: string;
  /** Blank is refused before the confirm card (the runner's schema still decides). */
  required?: boolean;
  showIf?: FieldShowIf;
  /**
   * A small helper button for an empty field: copy `values[from]` (a loaded value that is not
   * itself a field of the form, e.g. the directory bio) into it. Text and textarea only.
   */
  fillFrom?: { from: string; label: string };
}

export interface TextField extends FieldBase {
  kind: 'text';
  inputType?: 'text' | 'email' | 'url' | 'tel' | 'number';
  maxLength?: number;
  minLength?: number;
  placeholder?: string;
}
export interface TextareaField extends FieldBase {
  kind: 'textarea';
  rows?: number;
  maxLength?: number;
  placeholder?: string;
}
/** A yes/no switch. Submits a real boolean. */
export interface ToggleField extends FieldBase {
  kind: 'toggle';
}
/** One of a short list, in a drop-down. */
export interface SelectField extends FieldBase {
  kind: 'select';
  options: FieldOption[];
}
/** One of two to four, drawn as buttons with their words visible (radio group). */
export interface ChoiceField extends FieldBase {
  kind: 'choice';
  options: FieldOption[];
}
/**
 * A picture. The value is the image's address (a string). The dock uploads through the host's
 * `upload` prop when it has one, else the person chooses from `library`, a reader id (server/forms.ts
 * `FORM_READERS`; default 'my-images'). `optional` pictures can be left empty.
 */
export interface ImageField extends FieldBase {
  kind: 'image';
  library?: string;
}
/** YYYY-MM-DD. */
export interface DateField extends FieldBase {
  kind: 'date';
}
/** HH:MM (24 hour). */
export interface TimeField extends FieldBase {
  kind: 'time';
}
/**
 * One of the person's own things, listed by a server reader (their stores, drafts, workshops...). Like
 * `select`, but the options are loaded for the person; the value is the item's id.
 */
export interface PickField extends FieldBase {
  kind: 'pick';
  reader: string;
}

export type FieldSpec = TextField | TextareaField | ToggleField | SelectField | ChoiceField | ImageField | DateField | TimeField | PickField;
export type FieldKind = FieldSpec['kind'];

export interface ActionForm {
  /** The catalogue id this form performs. */
  entry: string;
  fields: FieldSpec[];
  /**
   * Reader id that pre-fills the values for the person (and org). Absent = the entry's status check
   * (`ActionStatus.values`), which every existing form uses. Readers: server/forms.ts `FORM_READERS`.
   */
  load?: string;
  /**
   * A "which one?" list first, for an entry that acts on one of the person's things. The picked item's
   * id is sent as the run's `subject` (a `thread` entry's post) and, unless `into` names a field, nothing
   * else. Each item may carry `values` that pre-fill the form once it is picked.
   */
  pick?: { reader: string; label: string; into?: string; emptyLabel?: string };
  /** A plain verb: "Save", "Publish", "Add". */
  submitLabel: string;
  /**
   * Which confirm-card placeholder (`{name}`, `{title}`, `{email}`, `{state}`, `{org}`) takes its word from which
   * field of what the person typed. Anything not named falls back to the loaded values, then to a neutral word.
   */
  confirmVars?: Record<string, string>;
  /** Submit stays off until a field differs from what was loaded (a switch the person has not touched). Default false. */
  needsChange?: boolean;
}

/** A loaded "which one?" item. */
export interface PickItem {
  id: string;
  label: string;
  hint?: string;
  /** Pre-fills the form when this item is picked. */
  values?: Record<string, string>;
}

/** What the dock gets with a task that has a declared form (server/forms.ts `loadDockForm`). */
export interface LoadedForm {
  form: ActionForm;
  values: Record<string, string>;
  /** The "which one?" list (`form.pick`), and lists for `pick` / `image` fields, keyed by reader id. */
  pick: PickItem[] | null;
  lists: Record<string, PickItem[]>;
}

/** The values the dock submits. */
export type FormValues = Record<string, string | boolean>;

// ---- The registry --------------------------------------------------------
// `declareForms` is how a lane adds forms: export an array from its own forms-*.ts file and add one
// import and one spread to ACTION_FORM_LIST in ./forms-registry.ts.

/** Draws the form declarations into the map the dock and the MCP read. Throws on a duplicate entry id. */
export function declareForms(...lists: ReadonlyArray<readonly ActionForm[]>): Readonly<Record<string, ActionForm>> {
  const out: Record<string, ActionForm> = {};
  for (const list of lists) for (const f of list) {
    if (out[f.entry]) throw new Error(`Two form declarations for "${f.entry}".`);
    out[f.entry] = f;
  }
  return out;
}

/** Every key a declared form submits, in order. */
export function formFieldNames(form: ActionForm): string[] {
  return form.fields.map((f) => f.name);
}
