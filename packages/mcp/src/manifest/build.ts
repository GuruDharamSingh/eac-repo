/**
 * Builds the block manifest (pure; see ./types.ts). Run by `scripts/build-manifest.mts`, which feeds it
 * the real catalogue; `scripts/check-manifest.mts` fails when the checked-in file no longer matches.
 */
import type { BlockRead, CatalogueRecord, ContractLike, DefLike, ManifestBlock, ManifestFile, ManifestPart, ManifestSetting } from './types';
import { denyReason } from './deny';

export const FIELD_PATTERN = 'block:<page>:<block id>:<setting>';
export const RECORD_PATTERN = 'record:<kind>:<id>:<field>';

/**
 * Blocks that show a record's value where their own typed setting was left empty ("typed first; the record
 * fills only what was left blank", feature-card.tsx:130-135). `editable`: the record has a field of that
 * name an editor may change through the record's own action (C4 `record:thread:<id>:title`); the others are
 * shown in the answer so an assistant knows where the words come from, but are not offered for editing.
 */
const RECORD_FILLS: Record<string, { via: string; fills: Record<string, { field: string; editable: boolean }> }> = {
  'feature-card': {
    via: 'record',
    fills: {
      title: { field: 'title', editable: true },
      body: { field: 'excerpt', editable: false },
      image: { field: 'image', editable: false },
      kicker: { field: 'kicker', editable: false },
      meta: { field: 'meta', editable: false },
    },
  },
};

const OPENS_GRAMMAR = 'page:<path> | popup:thread:<id> | popup:person:<id>';

/** No dashes between clauses in anything an assistant repeats to a person. */
const plainWords = (s: string): string => s.replace(/\s*[—–]\s*/g, ', ').replace(/\s+/g, ' ').trim();

/** Platform words to words a site owner uses. */
const KIND_WORDS: Record<string, string> = { thread: 'post or gathering', service: 'service', person: 'person', artwork: 'artwork' };
const kindWord = (k: string): string => KIND_WORDS[k] ?? k;
const FLOW_WORDS: Record<string, string> = { rsvp: 'RSVP', checkout: 'checkout', booking: 'booking' };

const list = (xs: readonly string[]): string => (xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} or ${xs[xs.length - 1]}`);

/** One sentence for what a block reads from where it sits (contract C5). */
export function readPlain(r: BlockRead, labelOf: (setting: string) => string): string {
  switch (r.from) {
    case 'route':
      return r.kinds?.length
        ? `The ${list(r.kinds.map(kindWord))} in the page's address, when no record is named in a setting.`
        : "The record in the page's address, when no record is named in a setting.";
    case 'site':
      return r.what === 'org' ? 'The organisation whose site it is drawn on.' : r.what === 'theme' ? "The site's theme, for colours and fonts." : "The site's menu.";
    case 'viewer':
      return r.what === 'signed-in' ? 'Whether the visitor is signed in.' : r.what === 'role' ? "The visitor's role on this site." : "The visitor's membership of this site.";
    case 'record':
      return `A ${list(r.kinds.map(kindWord))} chosen in the "${labelOf(r.via)}" setting; it fills any field you leave empty.`;
    case 'place':
      return 'Where it sits on the page.';
    case 'flow':
      return `The ${FLOW_WORDS[r.what] ?? r.what} steps: it knows them, so it needs no settings for them.`;
  }
}

function settingOf(p: ContractLike['props'][number]): ManifestSetting {
  const s: ManifestSetting = {
    name: p.name,
    kind: p.kind,
    label: p.label,
    fieldable: (p.kind === 'string' || p.kind === 'text') && !p.binds && p.format !== 'color',
  };
  if (p.description) s.description = plainWords(p.description);
  if (p.options?.length) s.options = p.options.map((o) => o.value);
  if (p.default !== undefined) s.default = p.default;
  if (p.required) s.required = true;
  for (const k of ['min', 'max', 'step', 'unit'] as const) if (p[k] !== undefined) (s as unknown as Record<string, unknown>)[k] = p[k];
  if (p.fields?.length) s.columns = p.fields.map((f) => f.name);
  if (p.binds) s.binds = p.binds;
  return s;
}

/** A static scan sees `options` as a list of values, a list holding unresolved parts, or an expression: keep only plain values. */
function cleanOptions(o: unknown): string[] | undefined {
  if (!Array.isArray(o)) return undefined;
  const out: string[] = [];
  for (const x of o) {
    if (typeof x === 'string') out.push(x);
    else if (typeof x === 'number' || typeof x === 'boolean') out.push(String(x));
    else if (x && typeof x === 'object' && typeof (x as { value?: unknown }).value === 'string') out.push((x as { value: string }).value);
  }
  return out.length ? out : undefined;
}

function settingOfCatalogue(p: NonNullable<CatalogueRecord['props']>[number]): ManifestSetting {
  const kind = p.kind ?? 'string';
  const s: ManifestSetting = { name: p.name, kind, label: p.label ?? p.name, fieldable: (kind === 'string' || kind === 'text') && !p.binds && p.format !== 'color' };
  const opts = cleanOptions(p.options);
  if (opts) s.options = opts;
  if (p.default !== undefined) s.default = p.default;
  if (p.required) s.required = true;
  for (const k of ['min', 'max', 'step', 'unit'] as const) if (p[k] !== undefined) (s as unknown as Record<string, unknown>)[k] = p[k];
  if (p.fields?.length) s.columns = p.fields.map((f) => f.name);
  if (p.binds) s.binds = p.binds;
  return s;
}

export interface BuildInput {
  /** `contractOf(blocks)` for every block the build could load. */
  contracts: Readonly<Record<string, ContractLike>>;
  /** `block.def` for the same blocks. */
  defs: Readonly<Record<string, DefLike>>;
  /** docs/open/DEVELOPMENT_APP_2026-11-20/blocks.json. */
  catalogue: readonly CatalogueRecord[];
}

/** Readable unless the deny list names it (./deny.ts: the policy of 2026-11-20 and why). `memberSafe` no longer decides. */
function agentOf(id: string, settings: ManifestSetting[]): ManifestBlock['agent'] {
  const denied = denyReason({ id, settings });
  return denied ? { read: false, why: denied.why } : { read: true, why: 'Not on the deny list: assistants may read it and propose changes to it.' };
}

export function buildManifest(input: BuildInput): ManifestFile {
  const byCatalogue = new Map<string, CatalogueRecord>();
  for (const r of input.catalogue) byCatalogue.set(r.id, r);
  const ids = new Set<string>([...byCatalogue.keys(), ...Object.keys(input.contracts)]);
  const blocks: ManifestBlock[] = [];

  for (const id of [...ids].sort()) {
    const rec = byCatalogue.get(id);
    const contract = input.contracts[id];
    const def = input.defs[id];
    const owner = rec?.owner ?? 'package:blocks';
    const settings: ManifestSetting[] = contract ? contract.props.map(settingOf) : (rec?.props ?? []).map(settingOfCatalogue);
    const slots = contract ? contract.props.filter((p) => p.kind === 'slot').map((p) => p.name) : [...(rec?.slots ?? [])];
    const parts: ManifestPart[] = contract?.parts
      ? Object.entries(contract.parts).map(([name, p]) => ({ name, label: p.label, ...(p.prop ? { setting: p.prop } : {}), ...(p.repeat ? { repeat: true } : {}) }))
      : (rec?.parts ?? []).map((name) => ({ name }));
    const fills = RECORD_FILLS[id];
    if (fills) for (const s of settings) if (fills.fills[s.name]) s.boundFrom = { via: fills.via, ...fills.fills[s.name]! };
    const labelOf = (name: string) => settings.find((s) => s.name === name)?.label ?? name;
    const reads = [...(def?.reads ?? [])];
    const opensSetting = settings.find((s) => s.binds === 'opens');
    const memberSafe = def ? def.memberSafe : rec?.memberSafe === true;
    blocks.push({
      id,
      label: contract?.label ?? rec?.label ?? id,
      what: plainWords(contract?.description ?? rec?.description ?? ''),
      category: def?.category ?? rec?.category ?? null,
      owner,
      source: rec?.file ?? null,
      offeredBy: [...(rec?.offeredBy ?? [])].sort(),
      styling: def?.styling ?? rec?.styling ?? null,
      memberSafe,
      interactive: contract ? contract.interactive : rec?.interactive === true,
      dataDriven: contract ? contract.dataDriven : rec?.dataDriven === true,
      settings,
      slots,
      parts,
      tokens: contract ? contract.tokens.map((t) => t.name) : (rec?.tokens ?? []).map((t) => t.name),
      binds: settings.filter((s) => s.binds && s.binds !== 'opens').map((s) => ({ setting: s.name, kind: s.binds! })),
      opens: opensSetting ? { setting: opensSetting.name, grammar: OPENS_GRAMMAR } : null,
      reads,
      readsPlain: reads.map((r) => readPlain(r, labelOf)),
      agent: agentOf(id, settings),
    });
  }
  return { v: 1, fieldPattern: FIELD_PATTERN, recordPattern: RECORD_PATTERN, blocks };
}
