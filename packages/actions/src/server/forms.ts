/**
 * Declared forms, server side (2026-11-27, rails desk round 2, lane E).
 *
 *   loadDockForm(entry, ctx)     the declaration plus the person's (and org's) loaded values and lists
 *   performDeclaredForm(...)     submit: only declared fields reach `performAction`, whose zod schema validates
 *   actionFormJsonSchema(entry)  the MCP tool's input, from the same declaration, overlaid by the runner's schema
 *   checkFormAgainstRunner(id)   disagreements between the declaration and the runner (for check scripts)
 *
 * Readers: `FORM_READERS` maps a reader id (named by `ActionForm.load` / `pick.reader` / a `pick` field's `reader` /
 * an `image` field's `library`) to a function giving `{ values?, items? }` for one person. Add a reader with one line.
 * Reads only: nothing here writes.
 */
import { db } from '@elkdonis/db';
import type { ActionLinks, ActionResult, ActionStatus } from '../types';
import type { ActionForm, FieldSpec, LoadedForm, PickItem } from '../fields';
import { actionForm } from '../forms';
import { actionStatus } from './status';
import { performAction, actionInputSchema, type ActorContext } from './run';
import { actionJsonSchema } from './schema';
import { READERS_WAVE1 } from './readers-wave1';

export interface FormReaderCtx {
  userId: string;
  orgId: string | null;
  links: ActionLinks;
  params?: Record<string, unknown> | null;
  /** A picked item's id, once the person has chosen (a thread's id for a `thread` entry). */
  subjectId?: string | null;
}

export interface FormReaderResult {
  values?: Record<string, string>;
  items?: PickItem[];
}

export type FormReader = (ctx: FormReaderCtx) => Promise<FormReaderResult>;

/** The person's own pictures (media rows they uploaded), newest first. The item id is the picture's address. */
const myImages: FormReader = async ({ userId }) => {
  try {
    const rows = await db<Array<{ id: string; url: string | null; filename: string | null }>>`
      SELECT id, url, filename FROM media
      WHERE uploaded_by = ${userId} AND type = 'image' AND url IS NOT NULL
      ORDER BY created_at DESC LIMIT 40
    `;
    return { items: rows.map((r) => ({ id: r.url as string, label: r.filename || 'Picture' })) };
  } catch (err) {
    console.error('[actions] form reader my-images:', err);
    return { items: [] };
  }
};

export const FORM_READERS: Record<string, FormReader> = {
  'my-images': myImages,
  // Lane F's readers (./readers-wave1.ts). Add a lane's readers as one more spread.
  ...READERS_WAVE1,
};

async function read(id: string, ctx: FormReaderCtx): Promise<FormReaderResult> {
  const r = FORM_READERS[id];
  if (!r) return {};
  try {
    return await r(ctx);
  } catch (err) {
    console.error('[actions] form reader', id, err);
    return {};
  }
}

const readerIdsOf = (form: ActionForm): string[] => {
  const ids = new Set<string>();
  for (const f of form.fields) {
    if (f.kind === 'pick') ids.add(f.reader);
    if (f.kind === 'image') ids.add(f.library ?? 'my-images');
  }
  return [...ids];
};

/**
 * The declaration and what the dock needs to draw it for this person. `status` may be passed when the caller
 * has just read it (the dock does), so the default pre-fill costs no second check. Null when the entry has no
 * declared form.
 */
export async function loadDockForm(entry: string, ctx: FormReaderCtx, opts: { status?: ActionStatus } = {}): Promise<LoadedForm | null> {
  const form = actionForm(entry);
  if (!form) return null;
  let values: Record<string, string> = {};
  if (form.load) {
    values = (await read(form.load, ctx)).values ?? {};
  } else {
    const status = opts.status ?? (await actionStatus(entry, { userId: ctx.userId, orgId: ctx.orgId, links: ctx.links, params: ctx.params ?? null, subjectId: ctx.subjectId ?? null }).catch(() => null));
    values = status?.values ?? {};
  }
  const pick = form.pick ? (await read(form.pick.reader, ctx)).items ?? [] : null;
  const lists: Record<string, PickItem[]> = {};
  for (const id of readerIdsOf(form)) lists[id] = (await read(id, ctx)).items ?? [];
  return { form, values, pick, lists };
}

/**
 * Submit a declared form: only the declared fields are sent on (nothing else the client adds), through
 * `performAction`, which validates with the runner's zod schema and runs the entry's own checks. The host's
 * door must already have asked the person (the confirm card) and resolved the actor and org.
 */
export async function performDeclaredForm(entry: string, actor: ActorContext, submitted: { values?: unknown; subjectId?: string | null }): Promise<ActionResult> {
  const form = actionForm(entry);
  if (!form) return { ok: false, error: 'That form is not known here.', code: 'unknown' };
  const raw = submitted.values && typeof submitted.values === 'object' ? (submitted.values as Record<string, unknown>) : {};
  const input: Record<string, unknown> = {};
  for (const f of form.fields) {
    const v = raw[f.name];
    if (v === undefined) continue;
    input[f.name] = f.kind === 'toggle' ? v === true || v === 'true' : typeof v === 'string' ? v : String(v);
  }
  if (form.pick?.into && submitted.subjectId) input[form.pick.into] = submitted.subjectId;
  return performAction(entry, { ...actor, subjectId: submitted.subjectId ?? actor.subjectId ?? null }, input);
}

// ---- JSON Schema ---------------------------------------------------------

function fieldSchema(f: FieldSpec): Record<string, unknown> {
  const base: Record<string, unknown> = { title: f.label, ...(f.help ? { description: f.help } : {}) };
  switch (f.kind) {
    case 'toggle':
      return { ...base, type: 'boolean' };
    case 'select':
    case 'choice':
      return { ...base, type: 'string', enum: f.options.map((o) => o.value) };
    case 'date':
      return { ...base, type: 'string', format: 'date' };
    case 'time':
      return { ...base, type: 'string', pattern: '^([01]\\d|2[0-3]):[0-5]\\d$' };
    case 'image':
      return { ...base, type: 'string', ...(f.help ? {} : { description: 'The address of one of the person’s pictures.' }) };
    case 'pick':
      return { ...base, type: 'string', ...(f.help ? {} : { description: 'The id of one of the person’s own items.' }) };
    case 'textarea':
      return { ...base, type: 'string', ...(f.maxLength ? { maxLength: f.maxLength } : {}) };
    default:
      return {
        ...base,
        type: f.inputType === 'number' ? 'number' : 'string',
        ...(f.inputType === 'email' ? { format: 'email' } : {}),
        ...(f.maxLength ? { maxLength: f.maxLength } : {}),
        ...(f.minLength ? { minLength: f.minLength } : {}),
      };
  }
}

const cache = new Map<string, Record<string, unknown> | null>();

/**
 * The entry's input as JSON Schema, from its form declaration (titles, help, enums, lengths), with the runner's
 * own zod-derived property wherever it has one (its rules win), so the MCP tool input and the dock form agree.
 * Null when the entry has no declared form.
 */
export function actionFormJsonSchema(entry: string): Record<string, unknown> | null {
  if (cache.has(entry)) return cache.get(entry)!;
  const form = actionForm(entry);
  let out: Record<string, unknown> | null = null;
  if (form) {
    const zod = actionJsonSchema(entry);
    const zprops = (zod?.properties ?? {}) as Record<string, Record<string, unknown>>;
    const properties: Record<string, unknown> = {};
    const required: string[] = [];
    for (const f of form.fields) {
      properties[f.name] = { ...fieldSchema(f), ...(zprops[f.name] ?? {}), title: f.label };
      if (f.required) required.push(f.name);
    }
    out = { type: 'object', additionalProperties: false, properties, ...(required.length ? { required } : {}) };
  }
  cache.set(entry, out);
  return out;
}

/** Declared names the runner does not take, and required runner properties the form does not draw (should be empty). */
export function checkFormAgainstRunner(entry: string): string[] {
  const form = actionForm(entry);
  if (!form) return [];
  if (!actionInputSchema(entry)) return [`${entry}: a form is declared but the entry has no runner input.`];
  const problems: string[] = [];
  const zod = actionJsonSchema(entry);
  const zprops = Object.keys((zod?.properties ?? {}) as object);
  const names = form.fields.map((f) => f.name);
  if (form.pick?.into) names.push(form.pick.into);
  for (const n of names) if (zprops.length && !zprops.includes(n)) problems.push(`${entry}: field "${n}" is not in the runner's input.`);
  // A runner input the form does not draw is a problem only when the runner requires it (an optional one may be left to the page).
  for (const r of (zod?.required ?? []) as string[]) if (!names.includes(r)) problems.push(`${entry}: the runner requires "${r}" and the form has no field for it.`);
  return problems;
}
