"use client";

import * as React from "react";
import type { StoredQuestionnaireField } from "../wizard/questionnaire";

// ============================================================================
// Authoring the questions themselves.
//
// `questionnaires.fields` is JSONB — an authored list of question descriptors —
// and until now nothing wrote it. Both live questionnaires have an empty field
// array, which is why the hub card said "Soon": the storage and the service
// layer were finished and there was no way to put a question in.
//
// A poll is the same editor with `single` set: one question, and the options
// are the ballot. Keeping them one component rather than two is the point —
// they differ by a boolean, not by a data model.
//
// Styling is `hsl(var(--token))` utilities only, like the rest of cms-ui, so
// each site's palette drives it and this package stays free of any component
// library.
// ============================================================================

const FIELD =
  "w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] " +
  "px-3 py-2 text-sm text-[hsl(var(--foreground))] shadow-sm " +
  "placeholder:text-[hsl(var(--muted-foreground))] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]";

const BTN =
  "inline-flex items-center justify-center rounded-md px-2.5 py-1.5 text-xs font-medium " +
  "transition-colors disabled:pointer-events-none disabled:opacity-50";
const GHOST = `${BTN} border border-[hsl(var(--border))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]`;

const TYPE_LABEL: Array<{ value: StoredQuestionnaireField["type"]; label: string }> = [
  { value: "text", label: "Short text" },
  { value: "longtext", label: "Long text" },
  { value: "choice", label: "Choose one" },
  { value: "multichoice", label: "Choose several" },
  { value: "number", label: "Number" },
  { value: "boolean", label: "Yes / no" },
  { value: "image", label: "Image URL" },
];

const NEEDS_OPTIONS = new Set(["choice", "multichoice"]);

/**
 * Question keys are what the answer blob is keyed by, so they have to be
 * stable and unique but never have to be typed by a person. Derived from the
 * label, then de-duplicated — an author who writes two questions called
 * "Notes" gets `notes` and `notes-2` rather than one silently overwriting the
 * other in the JSONB.
 */
export function deriveFieldKey(label: string, taken: string[]): string {
  const base =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "question";
  if (!taken.includes(base)) return base;
  let n = 2;
  while (taken.includes(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

export interface QuestionBuilderProps {
  value: StoredQuestionnaireField[];
  onChange: (fields: StoredQuestionnaireField[]) => void;
  /** Poll mode: exactly one question, and it must be a choice. */
  single?: boolean;
}

export function QuestionBuilder({ value, onChange, single = false }: QuestionBuilderProps) {
  const fields = value;

  function update(index: number, patch: Partial<StoredQuestionnaireField>) {
    const next = fields.map((f, i) => (i === index ? { ...f, ...patch } : f));
    // Re-derive the key when the label changes, so the answer blob stays
    // readable. Safe because nothing has answered yet at authoring time.
    if (patch.label !== undefined) {
      const taken = next.filter((_, i) => i !== index).map((f) => f.key);
      next[index] = { ...next[index]!, key: deriveFieldKey(patch.label, taken) };
    }
    onChange(next);
  }

  function add() {
    onChange([
      ...fields,
      {
        key: deriveFieldKey("question", fields.map((f) => f.key)),
        type: single ? "choice" : "text",
        label: "",
        required: false,
        ...(single ? { options: ["", ""] } : {}),
      },
    ]);
  }

  function remove(index: number) {
    onChange(fields.filter((_, i) => i !== index));
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= fields.length) return;
    const next = [...fields];
    [next[index], next[target]] = [next[target]!, next[index]!];
    onChange(next);
  }

  return (
    <div className="space-y-3">
      {fields.map((field, i) => {
        const showOptions = NEEDS_OPTIONS.has(field.type);
        return (
          <div
            key={i}
            className="space-y-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3"
          >
            <div className="flex items-start gap-2">
              <div className="flex-1 space-y-2">
                <input
                  className={FIELD}
                  value={field.label}
                  placeholder={single ? "What are you asking?" : `Question ${i + 1}`}
                  onChange={(e) => update(i, { label: e.target.value })}
                />
                <div className="flex flex-wrap items-center gap-2">
                  {!single && (
                    <select
                      className={`${FIELD} w-auto`}
                      value={field.type}
                      onChange={(e) => {
                        const type = e.target.value as StoredQuestionnaireField["type"];
                        update(i, {
                          type,
                          // Give a fresh choice question somewhere to type.
                          options: NEEDS_OPTIONS.has(type)
                            ? (field.options?.length ? field.options : ["", ""])
                            : undefined,
                        });
                      }}
                    >
                      {TYPE_LABEL.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  )}
                  {single && (
                    <label className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
                      <input
                        type="checkbox"
                        checked={field.type === "multichoice"}
                        onChange={(e) =>
                          update(i, { type: e.target.checked ? "multichoice" : "choice" })
                        }
                        className="h-4 w-4 rounded border-[hsl(var(--border))]"
                      />
                      Allow more than one answer
                    </label>
                  )}
                  <label className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
                    <input
                      type="checkbox"
                      checked={Boolean(field.required)}
                      onChange={(e) => update(i, { required: e.target.checked })}
                      className="h-4 w-4 rounded border-[hsl(var(--border))]"
                    />
                    Required
                  </label>
                </div>
              </div>

              {!single && (
                <div className="flex shrink-0 flex-col gap-1">
                  <button
                    type="button"
                    className={GHOST}
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    aria-label={`Move question ${i + 1} up`}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className={GHOST}
                    onClick={() => move(i, 1)}
                    disabled={i === fields.length - 1}
                    aria-label={`Move question ${i + 1} down`}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className={GHOST}
                    onClick={() => remove(i)}
                    aria-label={`Remove question ${i + 1}`}
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>

            {showOptions && (
              <OptionList
                options={field.options ?? []}
                onChange={(options) => update(i, { options })}
              />
            )}
          </div>
        );
      })}

      {(!single || fields.length === 0) && (
        <button type="button" className={GHOST} onClick={add}>
          {single ? "Add the question" : "Add a question"}
        </button>
      )}
    </div>
  );
}

function OptionList({
  options,
  onChange,
}: {
  options: string[];
  onChange: (options: string[]) => void;
}) {
  return (
    <div className="space-y-1.5 pl-1">
      {options.map((opt, i) => (
        <div key={i} className="flex items-center gap-2">
          <span aria-hidden className="text-xs text-[hsl(var(--muted-foreground))]">
            ○
          </span>
          <input
            className={FIELD}
            value={opt}
            placeholder={`Option ${i + 1}`}
            onChange={(e) => onChange(options.map((o, j) => (j === i ? e.target.value : o)))}
          />
          <button
            type="button"
            className={GHOST}
            onClick={() => onChange(options.filter((_, j) => j !== i))}
            // Two is the floor for a meaningful choice.
            disabled={options.length <= 2}
            aria-label={`Remove option ${i + 1}`}
          >
            ✕
          </button>
        </div>
      ))}
      <button type="button" className={GHOST} onClick={() => onChange([...options, ""])}>
        Add an option
      </button>
    </div>
  );
}

/**
 * What `createOrgQuestionnaire` will reject, checked before submit so the
 * author sees it next to the field rather than as a toast after a round trip.
 * Mirrors the service's own rules deliberately — the service stays the
 * authority; this is only the early warning.
 */
export function validateQuestionFields(fields: StoredQuestionnaireField[]): string | null {
  if (fields.length === 0) return "Add at least one question";
  for (const f of fields) {
    if (!f.label.trim()) return "Every question needs a label";
    if (NEEDS_OPTIONS.has(f.type)) {
      const filled = (f.options ?? []).filter((o) => o.trim());
      if (filled.length < 2) return `"${f.label || "Untitled"}" needs at least two options`;
    }
  }
  return null;
}

/** Drop blank options before saving — an author leaves trailing empties. */
export function cleanQuestionFields(
  fields: StoredQuestionnaireField[]
): StoredQuestionnaireField[] {
  return fields.map((f) => ({
    ...f,
    label: f.label.trim(),
    options: f.options ? f.options.map((o) => o.trim()).filter(Boolean) : undefined,
  }));
}
