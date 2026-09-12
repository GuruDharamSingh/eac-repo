"use client";

import * as React from "react";
import { WizardFieldControl, fieldDependencySatisfied, type WizardFieldSpec } from "../wizard/fields";
import { SessionsEditor } from "./SessionsEditor";
import {
  buildContentFields,
  emptyContentAnswers,
  groupHasValues,
  type ContentFieldContext,
  type ContentFieldGroup,
  type ContentKind,
  type ContentTier,
} from "./content-fields";

// ============================================================================
// One content form, for every kind and every hub.
//
// The field list comes from `content-fields.ts`, so this component does not
// know what a meeting is — it renders whatever groups that returns. Adding a
// kind is a filter there, not a form here.
//
// What it does know is how to DISCLOSE: open groups render as sections,
// optional groups as collapsed <details> that open themselves when they hold a
// value, `dependsOn` fields appear when their switch is on, and consecutive
// `inline` fields share a row. That is the whole difference between a form
// people finish and a form people abandon, and it is decided by data.
//
// The three widgets that cannot live in this package are slots:
//
//   body     every app has its own rich-text editor
//   media    the picker needs Nextcloud and each app wires uploads differently
//   extra    per-kind bespoke UI — the workshop session list, say
// ============================================================================

export interface ContentComposerSlots {
  /**
   * Rich-text body editor. Receives the current HTML and a setter, plus the
   * tier being rendered so the host can size the editor to its surface — a
   * "quick" popup wants a short toolbar, the full writing room wants all of
   * it. Hosts that don't care can ignore `tier`.
   */
  body?: (props: {
    value: string;
    onChange: (html: string) => void;
    tier?: ContentTier;
  }) => React.ReactNode;
  /**
   * Media pane — picker plus what is already attached. `label` and `hint`
   * name the slot being filled (cover, banner, hero, a session's image), so
   * a host's picker can say which image it is asking for.
   */
  media?: (props: {
    value: unknown;
    onChange: (value: unknown) => void;
    label?: string;
    hint?: string;
    /**
     * What kinds of file the slot is asking for, as an `<input accept>`
     * string. Unset means images — the common case. A session's handout
     * asks for documents; a host's picker should pass it through.
     */
    accept?: string;
  }) => React.ReactNode;
  /** Anything else this kind needs, rendered after the declared groups. */
  extra?: (props: {
    answers: Record<string, unknown>;
    patch: (fields: Record<string, unknown>) => void;
  }) => React.ReactNode;
}

export interface ContentComposerProps {
  kind: ContentKind;
  context?: ContentFieldContext;
  answers: Record<string, unknown>;
  onChange: (answers: Record<string, unknown>) => void;
  slots?: ContentComposerSlots;
  /** Field name → message, from a failed server-side parse. */
  fieldErrors?: Record<string, string[] | undefined>;
  /** "quick" renders only the fields marked quick in content-fields. Default full. */
  tier?: ContentTier;
  /** Render only these group ids — the writing room shows "media" and "placement" as settings. */
  groups?: string[];
  /** Skip these fields — the writing room draws title, lede and body itself. */
  omit?: string[];
  className?: string;
}

export function ContentComposer({
  kind,
  context,
  answers,
  onChange,
  slots,
  fieldErrors,
  tier = "full",
  groups: only,
  omit,
  className,
}: ContentComposerProps) {
  const groups = React.useMemo(() => {
    let g = buildContentFields(kind, context, { tier });
    if (only) g = g.filter((x) => only.includes(x.id));
    if (omit?.length) {
      g = g
        .map((x) => ({ ...x, fields: x.fields.filter((f) => !omit.includes(f.name)) }))
        .filter((x) => x.fields.length > 0);
    }
    return g;
  }, [kind, context, tier, only, omit]);

  const defaults = React.useMemo(() => emptyContentAnswers(kind, context), [kind, context]);

  // Which optional groups the person has opened or closed by hand. Unset
  // means "decide from the values".
  const [toggled, setToggled] = React.useState<Record<string, boolean>>({});

  function patch(fields: Record<string, unknown>) {
    onChange({ ...answers, ...fields });
  }

  return (
    <div className={`eac-compose${className ? ` ${className}` : ""}`}>
      {groups.map((group) => {
        const body = (
          <div className="eac-group-fields">
            {renderFields(group, answers, patch, slots, fieldErrors, tier)}
          </div>
        );

        if (!group.optional) {
          return (
            <section key={group.id} className="eac-group" data-group={group.id}>
              {group.label && <h3>{group.label}</h3>}
              {body}
            </section>
          );
        }

        const hasValues = groupHasValues(group, answers, defaults);
        const open = toggled[group.id] ?? hasValues;
        return (
          <details
            key={group.id}
            className={`eac-group eac-group--optional${hasValues ? " has-values" : ""}`}
            data-group={group.id}
            open={open}
            onToggle={(e) => setToggled((t) => ({ ...t, [group.id]: e.currentTarget.open }))}
          >
            <summary>
              <span className="eac-group-name">{group.label}</span>
              {group.blurb && <span className="eac-group-blurb">{group.blurb}</span>}
            </summary>
            {body}
          </details>
        );
      })}

      {slots?.extra?.({ answers, patch })}
    </div>
  );
}

/**
 * Fields of one group: dependency-filtered, and with runs of `inline` fields
 * wrapped in a row.
 */
function renderFields(
  group: ContentFieldGroup,
  answers: Record<string, unknown>,
  patch: (fields: Record<string, unknown>) => void,
  slots: ContentComposerSlots | undefined,
  fieldErrors: Record<string, string[] | undefined> | undefined,
  tier: ContentTier
): React.ReactNode[] {
  const visible = group.fields.filter((f) => fieldDependencySatisfied(f.dependsOn, answers));
  const out: React.ReactNode[] = [];
  let row: React.ReactNode[] = [];

  const flush = () => {
    if (row.length === 1) out.push(row[0]);
    else if (row.length > 1) out.push(<div key={`row-${out.length}`} className="eac-field-row">{row}</div>);
    row = [];
  };

  for (const field of visible) {
    const node = renderField(field, answers, patch, slots, fieldErrors?.[field.name], tier);
    if (node === null) continue;
    if (field.inline) row.push(node);
    else {
      flush();
      out.push(node);
    }
  }
  flush();
  return out;
}

function renderField(
  field: WizardFieldSpec,
  answers: Record<string, unknown>,
  patch: (fields: Record<string, unknown>) => void,
  slots: ContentComposerSlots | undefined,
  errors: string[] | undefined,
  tier: ContentTier
): React.ReactNode | null {
  // The slotted fields render the host's widget in place, keeping the
  // declared order rather than appending them.
  if (field.name === "body" && slots?.body) {
    return (
      <div key={field.name} className="eac-field" data-field="body">
        <span className="eac-field-label">{field.label}</span>
        {slots.body({
          value: String(answers.body ?? ""),
          onChange: (html) => patch({ body: html }),
          tier,
        })}
        {errors?.length ? <p className="eac-field-error">{errors.join(". ")}</p> : null}
      </div>
    );
  }

  // Any image field is the host's picker — never a URL box.
  if (field.name === "cover_image_url" || field.slot === "media") {
    if (!slots?.media) return null;
    return (
      <div key={field.name} className="eac-field" data-field={field.name}>
        {slots.media({
          value: answers[field.name],
          onChange: (value) => patch({ [field.name]: value }),
          label: field.label,
          hint: field.hint,
        })}
        {errors?.length ? <p className="eac-field-error">{errors.join(". ")}</p> : null}
      </div>
    );
  }

  if (field.input === "sessions") {
    return (
      <div key={field.name} className="eac-field" data-field={field.name}>
        <span className="eac-field-label">{field.label}</span>
        <SessionsEditor value={answers[field.name]} onChange={(v) => patch({ [field.name]: v })} media={slots?.media} />
        {field.hint && <p className="eac-field-hint">{field.hint}</p>}
      </div>
    );
  }

  // A `custom` field with no slot would render an empty control, so skip it.
  if (field.input === "custom" && !field.render) return null;

  return (
    <WizardFieldControl
      key={field.name}
      field={field}
      value={answers[field.name]}
      onChange={(value) => patch({ [field.name]: value })}
      errors={errors}
      answers={answers}
    />
  );
}
