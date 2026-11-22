/**
 * The two draft tools (lane ASSIST, 2026-11-20): an assistant proposes a change, a person publishes it.
 *
 *   propose_page_patch  steps (the house editor's one door) run on the stored page, or on the assistant's own
 *                       waiting draft; the result is kept as a draft with author.kind "assistant". Never the live page.
 *   set_field           one C4 field id (`block:<page>:<block id>:<setting>`) and a value: one `set_prop` step, the same way.
 *                       A `record:` id is refused: records have no draft state yet.
 *
 * Every rule of packages/mcp/README.md binds them: the grant's scope `mcp:draft` (a read-only key is told so), the org
 * from the grant (`settleOrg`), the actor is the grant (never input), one audit row per call (`draftTool` does it), a
 * stricter rate window than the reads, refusals returned as results. Member-written text never leaves here: results
 * carry the door's own words about the assistant's own steps, nothing from the page.
 *
 * The step door and the draft store are the HOST's (packages/mcp links neither the house editor nor the page builder):
 * `host.drafts` (`McpDrafts`). The tool decides WHAT may be asked (the caps, the two ops an assistant has, the blocks the
 * manifest shows assistants); the door decides whether each step is sound and says so in its own words.
 *
 * What an assistant may do in this wave: `set_prop` and `set_look`, on blocks it may read (`agent.read`), outside any block
 * it may not read. Not yet: colour/size tokens (the manifest carries no token types, so a value cannot be checked),
 * and structure steps (add, move, copy, remove: they need the page builder's block list, which the host does not hand over).
 */
import type { McpServer } from '@modelcontextprotocol/server';
import { manifest, type ManifestBlock } from '../manifest';
import { readOnlyReason } from '../manifest/deny';
import { draftTool, refuseWith, type Json, type ToolContext, type ToolOut } from './tools';
import { settleOrg } from './org';
import { plain } from './sanitize';
import { isPagePath, visibleBlock } from './site-read';
import type { DraftContract, McpDraftStepResult } from './types';

export const MAX_STEPS = 50;
export const MAX_STEPS_BYTES = 32 * 1024;
export const MAX_NOTE = 500;
export const MAX_VALUE_BYTES = 8 * 1024;
/** What a draft keeps in all (page-builder drafts.ts holds 200). */
const MAX_KEPT_STEPS = 200;

const orgProp = { org: { type: 'string', maxLength: 100, description: 'An organisation id or slug (list_my_orgs). Omit for a key limited to one org.' } };
const slugProp = { slug: { type: 'string', maxLength: 150, description: 'The page address without the leading slash, e.g. "home" or "about/press" (list_pages).' } };

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const BLOCK_ID = /^[A-Za-z0-9_-]{1,100}$/;
const NAME = /^[A-Za-z0-9_$.-]{1,100}$/;
const SETTING = /^[A-Za-z][A-Za-z0-9]{0,63}$/;

/** The two steps an assistant has, and the keys each may carry. Anything else is refused whole, so nothing unexpected is kept. */
const ALLOWED: Readonly<Record<string, readonly string[]>> = {
  set_prop: ['op', 'block', 'prop', 'value'],
  set_look: ['op', 'block', 'part', 'look', 'state', 'at'],
};
/** Steps the door knows that an assistant does not have yet. */
const NOT_YET: Readonly<Record<string, string>> = {
  set_token: 'Changing a block’s colours and sizes is not available to assistants yet. A person can do it in the editor.',
  insert: 'Adding a block is not available to assistants yet. A person can add it in the editor.',
  move: 'Moving a block is not available to assistants yet. A person can move it in the editor.',
  duplicate: 'Copying a block is not available to assistants yet. A person can copy it in the editor.',
  remove: 'Removing a block is not available to assistants yet. A person can remove it in the editor.',
};

const NOT_ALLOWED_BLOCK = 'That block is not one assistants may change. Ask a person to change it in the editor.';

/** The contracts the door gets: the blocks an assistant may see, and only those. Built from the manifest, cached. */
let contractCache: Record<string, DraftContract> | null = null;
export function draftContracts(): Record<string, DraftContract> {
  if (contractCache) return contractCache;
  const out: Record<string, DraftContract> = {};
  for (const b of manifest().visible) out[b.id] = contractOf(b);
  return (contractCache = out);
}

function contractOf(b: ManifestBlock): DraftContract {
  const parts: DraftContract['parts'] = {};
  for (const p of b.parts) parts[p.name] = { label: p.label ?? p.name, sel: '', ...(p.setting && !p.setting.includes('.') ? { prop: p.setting } : {}) };
  return {
    label: b.label,
    props: b.settings.map((s) => ({
      name: s.name,
      kind: String(s.kind),
      label: s.label,
      ...(s.binds ? { binds: s.binds } : {}),
      ...(s.min !== undefined ? { min: s.min } : {}),
      ...(s.max !== undefined ? { max: s.max } : {}),
      ...(s.options ? { options: s.options.map((v) => ({ value: v, label: v })) } : {}),
    })),
    parts,
    // No token types in the manifest, so no value could be checked: none are offered (set_token is refused first).
    tokens: [],
  };
}

interface Scan {
  /** For each block id on the page: whether every block with that id is one the assistant may change. */
  allowed: Map<string, boolean>;
  /** Every block the assistant may not change (top-most only), exactly as stored, in page order. */
  frozen: string[];
  /** The type of the first block with each id (for the read-only settings list). */
  types: Map<string, string>;
  count: number;
}

/**
 * Which blocks an assistant may aim at. A block may be changed when its type is one the manifest shows assistants
 * and it does not sit inside a block that is not (read_page shows those as placeholders, with everything in them gone).
 */
function scan(doc: unknown, blocks: Record<string, ManifestBlock>): Scan {
  const allowed = new Map<string, boolean>();
  const frozen: string[] = [];
  const types = new Map<string, string>();
  let count = 0;
  const walk = (list: unknown, hiddenAbove: boolean, depth: number) => {
    if (!Array.isArray(list) || depth > 40) return;
    for (const node of list.slice(0, 400)) {
      if (!isObject(node) || typeof node.type !== 'string' || !isObject(node.props)) continue;
      count++;
      const ok = !hiddenAbove && visibleBlock(blocks, node.type) !== null;
      if (!ok && !hiddenAbove) frozen.push(JSON.stringify(node));
      const id = node.props.id;
      if (typeof id === 'string') {
        allowed.set(id, (allowed.get(id) ?? true) && ok);
        if (!types.has(id)) types.set(id, node.type);
      }
      for (const v of Object.values(node.props)) if (Array.isArray(v) && v.some((x) => isObject(x) && typeof x.type === 'string')) walk(v, !ok, depth + 1);
    }
  };
  walk(isObject(doc) ? doc.content : null, false, 0);
  return { allowed, frozen, types, count };
}

type Checked = { ok: true; steps: Array<Record<string, unknown>> } | { ok: false; say: string; code: string };

const bad = (code: string, say: string): Checked => ({ ok: false, code, say });

/** The shape of what an assistant sent, before any page is looked at. Plain refusals, whole list or nothing. */
export function checkSteps(raw: unknown): Checked {
  if (!Array.isArray(raw)) return bad('bad_steps', 'Steps are a list: each one an object with an "op" (set_prop or set_look).');
  if (raw.length === 0) return bad('no_steps', 'There is nothing to propose: the list of steps is empty.');
  if (raw.length > MAX_STEPS) return bad('too_many_steps', `Too many steps: ${MAX_STEPS} at most in one proposal. Nothing was saved. Send them in smaller proposals.`);
  let bytes = 0;
  try {
    bytes = JSON.stringify(raw).length;
  } catch {
    return bad('bad_steps', 'Those steps could not be read.');
  }
  if (bytes > MAX_STEPS_BYTES) return bad('steps_too_large', `The steps are too large (${MAX_STEPS_BYTES / 1024} KiB at most). Nothing was saved.`);
  const steps: Array<Record<string, unknown>> = [];
  for (let i = 0; i < raw.length; i++) {
    const s = raw[i];
    const at = `Step ${i + 1}`;
    if (!isObject(s)) return bad('not_a_step', `${at} is not a step. A step is an object with an "op".`);
    const op = typeof s.op === 'string' ? s.op : '';
    if (Object.hasOwn(NOT_YET, op)) return bad('not_yet', `${at}: ${NOT_YET[op]}`);
    if (!Object.hasOwn(ALLOWED, op)) return bad('unknown_op', `${at}: "${plain(op, 40) ?? ''}" is not a step an assistant has. It has set_prop and set_look.`);
    const extra = Object.keys(s).filter((k) => !ALLOWED[op]!.includes(k));
    if (extra.length) return bad('unexpected_key', `${at}: ${op} takes ${ALLOWED[op]!.slice(1).join(', ')} only. Nothing else is accepted.`);
    if (typeof s.block !== 'string' || !BLOCK_ID.test(s.block)) return bad('bad_block', `${at}: "block" is a block id from read_page: letters, digits, "-" and "_".`);
    const named = op === 'set_prop' ? 'prop' : 'part';
    if (typeof s[named] !== 'string' || !NAME.test(s[named] as string)) return bad('bad_name', `${at}: "${named}" is a plain name from describe_block.`);
    steps.push({ ...s });
  }
  return { ok: true, steps };
}

const safeId = (v: unknown): v is string => typeof v === 'string' && BLOCK_ID.test(v);

const resultsOf = (results: McpDraftStepResult[]): Json[] =>
  results.map((r, i) => ({
    step: i + 1,
    ok: r.ok === true,
    code: typeof r.code === 'string' ? r.code.slice(0, 40) : 'unknown',
    say: plain(r.say, 300) ?? '',
    ...(Array.isArray(r.touched) ? { touched: r.touched.filter(safeId).slice(0, 20) } : {}),
  }));

const NEXT_WORDS =
  'Saved as a draft for a person to review. Nothing is live: a person publishes it, or throws it away, from the Sites tab of the development app.';

interface Proposal {
  orgId: string;
  slug: string;
  steps: Array<Record<string, unknown>>;
  note: string | null;
}

async function propose(ctx: ToolContext, p: Proposal): Promise<ToolOut> {
  const { host, grant } = ctx;
  const { orgId, slug } = p;
  const drafts = host.drafts;
  const fail = (message: string, data: Json = {}): ToolOut => refuseWith(message, 'input', { ok: false, published: false, ...data }, orgId);
  if (!drafts || !host.pages) return refuseWith('The draft writer is not connected on this host.', 'unknown', undefined, orgId);

  const m = manifest();
  const [live, waiting] = await Promise.all([host.pages.loadPageWithVersion(orgId, slug), drafts.loadDraft(orgId, slug)]);
  if (!live) return refuseWith('No such page in this organisation. Assistants do not create pages yet.', 'unknown', undefined, orgId);

  if (waiting) {
    if (waiting.author.kind !== 'assistant') {
      return fail('A person has a draft waiting for this page. Ask them to publish it or throw it away first: an assistant does not replace a person’s work.', { waitingFrom: 'a person' });
    }
    if (waiting.base !== live.updatedAt) {
      return fail('The published page changed after the waiting draft began, so the draft is out of date. A person should look at it and publish or throw it away; nothing was saved.', { stale: true });
    }
  }
  const start = waiting ? waiting.data : live.data;

  // Aim: only at blocks an assistant may change. The refusal says that, and nothing of the block.
  const seen = scan(start, m.byId);
  for (let i = 0; i < p.steps.length; i++) {
    const id = p.steps[i]!.block as string;
    if (seen.allowed.get(id) === false) {
      return fail(`Step ${i + 1}: ${NOT_ALLOWED_BLOCK}`, { results: [{ step: i + 1, ok: false, code: 'block_not_allowed', say: NOT_ALLOWED_BLOCK }] });
    }
  }

  // A switch that decides who may see or join something can be read but not set by an assistant (manifest/deny.ts).
  for (let i = 0; i < p.steps.length; i++) {
    const step = p.steps[i]!;
    if (step.op !== 'set_prop') continue;
    const type = seen.types.get(step.block as string);
    const block = type !== undefined && Object.hasOwn(m.byId, type) ? m.byId[type] : undefined;
    const setting = block?.settings.find((s) => s.name === step.prop);
    const why = block && setting ? readOnlyReason(block.id, setting) : null;
    if (why) return fail(`Step ${i + 1}: ${why}`, { results: [{ step: i + 1, ok: false, code: 'setting_not_allowed', say: why }] });
  }

  const out = drafts.applySteps(orgId, start, p.steps, draftContracts());
  const results = resultsOf(out.results ?? []);
  if (!out.ok) {
    const last = results[results.length - 1];
    return fail(`Step ${last?.step ?? 1} was refused, so nothing was saved: ${last?.say ?? 'it could not be applied.'}`, { results });
  }
  // The door touches only the block a step aims at. Verify it: the blocks an assistant may not change are exactly as stored,
  // and no block was added or dropped.
  const after = scan(out.doc, m.byId);
  if (after.count !== seen.count || after.frozen.length !== seen.frozen.length || after.frozen.some((f, i) => f !== seen.frozen[i])) {
    console.error('[mcp] propose_page_patch: a step changed more than it was aimed at; nothing saved');
    return fail('Those steps would have changed more than they name, so nothing was saved.', { results });
  }

  const kept = [...(waiting?.steps ?? []), ...p.steps];
  if (kept.length > MAX_KEPT_STEPS) return fail(`This draft already holds ${waiting?.steps?.length ?? 0} changes. A person should publish or throw it away before more are proposed.`);
  const label = plain(grant.label, 120) ?? 'Assistant';
  const note = p.note ?? waiting?.note;
  const saved = await drafts.saveDraft(orgId, slug, {
    data: out.doc,
    base: live.updatedAt,
    author: { id: grant.id, kind: 'assistant', label },
    ...(note ? { note } : {}),
    steps: kept,
    // Compare-and-set: what was read above. A person saving in the meantime is not overwritten.
    expected: waiting?.savedAt ?? null,
  });
  if (saved.code === 'draft_changed') return fail('Someone saved a draft of this page while this was being prepared, so nothing was saved. Read the page again and propose again.', { stale: true });
  if (!saved.ok) return fail(`The draft could not be kept: ${plain(saved.error, 200) ?? 'it was refused.'}`, { results });
  const now = await drafts.loadDraft(orgId, slug);
  if (!now) return fail('The draft could not be kept.', { results });
  return {
    data: {
      ok: true,
      published: false,
      org: orgId,
      slug,
      base: now.base,
      savedAt: now.savedAt,
      stepCount: kept.length,
      results,
      next: NEXT_WORDS,
    },
    orgId,
  };
}

/** `block:<page>:<block id>:<setting>` → its parts, or null. `record:` ids have their own refusal. */
export function parseBlockField(field: unknown): { slug: string; block: string; setting: string } | null {
  if (typeof field !== 'string' || field.length > 300) return null;
  const parts = field.split(':');
  if (parts.length !== 4 || parts[0] !== 'block') return null;
  const [, slug, block, setting] = parts as [string, string, string, string];
  if (!isPagePath(slug) || !BLOCK_ID.test(block) || !SETTING.test(setting)) return null;
  return { slug, block, setting };
}

export function registerDraftTools(server: McpServer, ctx: ToolContext): void {
  const { grant } = ctx;

  // ---------------------------------------------------------------- propose_page_patch
  draftTool(server, ctx, 'propose_page_patch', {
    title: 'Propose a change to a page',
    description:
      'Propose changes to one page as steps, kept as a draft for a person to review and publish: the published page is never written. ' +
      'Steps: { "op": "set_prop", "block": <block id>, "prop": <setting>, "value": <new value> } to change a setting (describe_block lists them; the value is checked by the setting\'s kind and length), ' +
      'and { "op": "set_look", "block": <block id>, "part": <part or "root">, "look": { ...style } or null, "state": "hover"|"focus"|"active" (optional), "at": "sm"|"md" (optional) } to change how a part looks. ' +
      'Block ids come from read_page. Only blocks listed by list_blocks can be changed, and not the switches that decide who can see or join something (such as members only). Adding, moving, copying and removing blocks and changing colour or size tokens are not available yet. ' +
      `Limits: at most ${MAX_STEPS} steps, the step list at most ${MAX_STEPS_BYTES / 1024} KiB, the note at most ${MAX_NOTE} characters. ` +
      'The steps run in order on the page as stored (or on your own waiting draft, if the published page has not changed since it began); the first step the page refuses stops the whole list and nothing is saved. ' +
      'A person\'s waiting draft is never replaced. The answer gives each step\'s result in plain words.',
    input: {
      properties: {
        ...orgProp,
        ...slugProp,
        steps: { type: 'array', items: { type: 'object' }, description: `The steps, in order (1 to ${MAX_STEPS}).` },
        note: { type: 'string', description: `Why: one or two sentences the reviewing person will read (at most ${MAX_NOTE} characters).` },
      },
      required: ['slug', 'steps'],
    },
  }, async (args) => {
    const o = await settleOrg(grant, args.org, true);
    if (o.ok === false) return refuseWith(o.error, 'forbidden');
    const orgId = o.orgId!;
    if (!isPagePath(args.slug)) return refuseWith('Name the page by its address, like "home" or "about/press" (list_pages).', 'input', undefined, orgId);
    const note = checkNote(args.note);
    if (note === false) return refuseWith(`The note is too long or is not text (${MAX_NOTE} characters at most). Nothing was saved.`, 'input', undefined, orgId);
    const steps = checkSteps(args.steps);
    if (steps.ok === false) return refuseWith(steps.say, 'input', { ok: false, published: false, results: [{ step: 0, ok: false, code: steps.code, say: steps.say }] }, orgId);
    return propose(ctx, { orgId, slug: args.slug, steps: steps.steps, note });
  });

  // ---------------------------------------------------------------- set_field
  draftTool(server, ctx, 'set_field', {
    title: 'Propose a new value for one field',
    description:
      'Propose one new value for one field of a page, by the field id find_fields gives (`block:<page>:<block id>:<setting>`), kept as a draft for a person to review and publish: the published page is never written. ' +
      'It is one set_prop step, saved the way propose_page_patch saves it, with the same checks. ' +
      'A `record:` id (a post or gathering\'s own title) is not accepted yet: records have no draft state. ' +
      `The value is at most ${MAX_VALUE_BYTES / 1024} KiB, and a setting's own limit applies (a text setting is 400 or 4000 characters).`,
    input: {
      properties: {
        ...orgProp,
        field: { type: 'string', maxLength: 300, description: 'A field id from find_fields.' },
        value: { description: 'The new value. Plain words for a text setting.' },
      },
      required: ['field', 'value'],
    },
  }, async (args) => {
    const o = await settleOrg(grant, args.org, true);
    if (o.ok === false) return refuseWith(o.error, 'forbidden');
    const orgId = o.orgId!;
    if (typeof args.field === 'string' && args.field.startsWith('record:')) {
      return refuseWith('That field belongs to a post or gathering itself, and records have no draft state yet, so an assistant cannot propose a change to it. A person can change it in the editor.', 'forbidden', undefined, orgId);
    }
    const f = parseBlockField(args.field);
    if (!f) return refuseWith('That is not a field id. Use one from find_fields: block:<page>:<block id>:<setting>.', 'input', undefined, orgId);
    let bytes = -1;
    try {
      bytes = args.value === undefined ? -1 : JSON.stringify(args.value).length;
    } catch {
      /* not JSON */
    }
    if (bytes < 0) return refuseWith('Give the new value.', 'input', undefined, orgId);
    if (bytes > MAX_VALUE_BYTES) return refuseWith(`That value is too large (${MAX_VALUE_BYTES / 1024} KiB at most). Nothing was saved.`, 'input', undefined, orgId);
    return propose(ctx, {
      orgId,
      slug: f.slug,
      steps: [{ op: 'set_prop', block: f.block, prop: f.setting, value: args.value }],
      note: `Changed the "${f.setting}" setting of block ${f.block}.`,
    });
  });
}

/** The note: undefined/empty is none (null), text up to the cap is kept, anything else is false. */
function checkNote(v: unknown): string | null | false {
  if (v === undefined || v === null) return null;
  if (typeof v !== 'string' || v.length > MAX_NOTE) return false;
  return plain(v, MAX_NOTE);
}
