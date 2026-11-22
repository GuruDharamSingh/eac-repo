/**
 * The pure half of the site tools (lane MACHINES, 2026-11-20): shaping a stored page for an assistant.
 * No database, no host: `site-tools.ts` loads, this fences, outlines and names fields.
 *
 * Page text is member-written. Every string leaves here stripped of HTML and capped (`plain`), and the
 * tools list the whole document under `untrusted`.
 */
import { plain } from './sanitize';
import type { ManifestBlock } from '../manifest';

/** A string longer than this is cut. */
export const MAX_STRING = 1000;
/** More items than this in one list are dropped (a runaway paste). */
const MAX_ITEMS = 400;
/** Nesting deeper than this is dropped (a block in a slot in a block is two levels: props, then the list). */
const MAX_DEPTH = 40;
/** Characters of text in one document before the rest is dropped. */
const MAX_TOTAL = 200_000;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const SAFE_NAME = /^[A-Za-z0-9_:./-]{1,100}$/;
/** A property name we pass on: a plain identifier of sane length. Anything else is dropped (and the page reported as cut). */
const SAFE_KEY = /^[A-Za-z_$][A-Za-z0-9_$-]{0,48}$/;

/** The address of a page: one to three segments of `[a-z0-9-]`, as packages/page-builder/src/slug.ts. */
export function isPagePath(path: unknown): path is string {
  if (typeof path !== 'string') return false;
  const segs = path.split('/');
  return segs.length >= 1 && segs.length <= 3 && segs.every((s) => /^[a-z0-9][a-z0-9-]{0,48}$/.test(s));
}

/**
 * A page document with every string made safe to hand to an assistant. Keys, numbers and booleans pass;
 * `id` and `type` strings pass when they are plain names. `truncated` says something was dropped.
 */
export function fenceDocument(doc: unknown): { doc: unknown; truncated: boolean } {
  let total = 0;
  let truncated = false;
  const walk = (v: unknown, key: string, depth: number): unknown => {
    if (typeof v === 'string') {
      if ((key === 'id' || key === 'type') && SAFE_NAME.test(v)) return v;
      total += Math.min(v.length, MAX_STRING);
      if (total > MAX_TOTAL) {
        truncated = true;
        return '';
      }
      if (v.length > MAX_STRING) truncated = true;
      return plain(v, MAX_STRING) ?? '';
    }
    if (typeof v === 'number' || typeof v === 'boolean' || v === null) return v;
    if (depth >= MAX_DEPTH) {
      truncated = true;
      return null;
    }
    if (Array.isArray(v)) {
      if (v.length > MAX_ITEMS) truncated = true;
      return v.slice(0, MAX_ITEMS).map((x) => walk(x, key, depth + 1));
    }
    if (isObject(v)) {
      const out: Record<string, unknown> = {};
      for (const [k, x] of Object.entries(v).slice(0, 200)) {
        if (!SAFE_KEY.test(k)) {
          truncated = true;
          continue;
        }
        out[k] = walk(x, k, depth + 1);
      }
      return out;
    }
    return null;
  };
  return { doc: walk(doc, '', 0), truncated };
}

export interface Visited {
  node: Record<string, unknown>;
  props: Record<string, unknown>;
  path: string;
}

/**
 * Every block of a document, in page order, nested ones included: a block is any object with a string
 * `type` and an object `props`, and a slot is any array of such objects in a block's props. This is as
 * loose as validatePage's walk on purpose: a block type this build does not know is still found.
 */
export function walkBlocks(doc: unknown, visit: (v: Visited) => void | false): void {
  if (!isObject(doc)) return;
  const walk = (list: unknown, path: string, depth: number) => {
    if (!Array.isArray(list) || depth > MAX_DEPTH) return;
    list.slice(0, MAX_ITEMS).forEach((node, i) => {
      if (!isObject(node) || typeof node.type !== 'string' || !isObject(node.props)) return;
      const here = `${path}[${i}]`;
      // A visitor answers false to say "do not look inside this block" (a block an assistant may not read).
      if (visit({ node, props: node.props, path: here }) === false) return;
      for (const [k, v] of Object.entries(node.props)) {
        // Only keys that are plain names enter a path: a slot named like a sentence is not repeated.
        if (Array.isArray(v) && v.some((x) => isObject(x) && typeof x.type === 'string')) walk(v, `${here}.${SAFE_KEY.test(k) ? k : '_'}`, depth + 1);
      }
    });
  };
  walk(doc.content, 'content', 0);
  // Legacy zones (Puck's old format): a map of lists. Paths use the zone's position, never its key (a key is member-written).
  if (isObject(doc.zones)) Object.values(doc.zones).slice(0, 100).forEach((list, i) => walk(list, `zones.z${i}`, 0));
}

/** A block the manifest knows and lets assistants see. Own keys only: a type named "constructor" is not a block. */
export function visibleBlock(blocks: Record<string, ManifestBlock>, type: unknown): ManifestBlock | null {
  if (typeof type !== 'string' || !Object.prototype.hasOwnProperty.call(blocks, type)) return null;
  const b = blocks[type]!;
  return b.agent.read ? b : null;
}

const HIDDEN_LABEL = 'a block this assistant cannot read';

/**
 * A copy of the document in which every block an assistant may not see (and everything inside it) is a
 * placeholder: its position and id, a neutral label, nothing of its settings. The type name is kept only for
 * a shared block the manifest knows (its name is ours); an app-local or unknown type is not named.
 */
export function redactHidden(doc: unknown, blocks: Record<string, ManifestBlock>): unknown {
  if (!isObject(doc)) return doc;
  const fix = (list: unknown): unknown =>
    Array.isArray(list)
      ? list.map((n) => {
          if (!isObject(n) || typeof n.type !== 'string' || !isObject(n.props)) return n;
          if (!visibleBlock(blocks, n.type)) {
            const known = Object.prototype.hasOwnProperty.call(blocks, n.type) && blocks[n.type]!.owner === 'package:blocks';
            const id = typeof n.props.id === 'string' && SAFE_NAME.test(n.props.id) ? n.props.id : '';
            return { type: 'hidden', props: { id, label: HIDDEN_LABEL, ...(known ? { blockType: n.type } : {}) } };
          }
          const props: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(n.props)) props[k] = Array.isArray(v) && v.some((x) => isObject(x) && typeof x.type === 'string') ? fix(v) : v;
          return { type: n.type, props };
        })
      : list;
  // A page still in Puck's legacy zones format keeps its blocks in `zones`, a map of lists: redact them the same way.
  const zones = isObject(doc.zones) ? Object.fromEntries(Object.entries(doc.zones).slice(0, 100).map(([k, v]) => [k, fix(v)])) : undefined;
  return { ...doc, content: fix(doc.content), ...(zones ? { zones } : {}) };
}

export interface Outlined {
  id: string;
  /** The block's type, or "hidden" for a block an assistant may not read. */
  type: string;
  path: string;
  /** False for a block that is hidden from assistants or that the manifest does not know. */
  known: boolean;
  hidden?: true;
}

/** Position, id and type of each block an assistant may read; a hidden block is listed as such and not looked inside. */
export function outlineOf(doc: unknown, blocks: Record<string, ManifestBlock>): Outlined[] {
  const out: Outlined[] = [];
  walkBlocks(doc, ({ node, props, path }) => {
    const id = typeof props.id === 'string' && SAFE_NAME.test(props.id) ? props.id : path;
    if (!visibleBlock(blocks, node.type)) {
      out.push({ id, type: 'hidden', path, known: false, hidden: true });
      return false;
    }
    out.push({ id, type: String(node.type), path, known: true });
  });
  return out;
}

const BLOCK_ID = /^[A-Za-z0-9_-]{1,100}$/;
const THREAD_REF = /^thread:([A-Za-z0-9_-]{1,64})$/;
const empty = (v: unknown): boolean => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');

/** The thread ids a page's record settings name (each `thread:<id>`), for a lookup of which belong to the org. */
export function referencedThreads(doc: unknown, blocks: Record<string, ManifestBlock>, max = 60): string[] {
  const ids = new Set<string>();
  walkBlocks(doc, ({ node, props }) => {
    const b = visibleBlock(blocks, node.type);
    if (!b) return false;
    for (const s of b.settings) {
      if (s.binds !== 'record') continue;
      const m = typeof props[s.name] === 'string' ? THREAD_REF.exec(props[s.name] as string) : null;
      if (m && ids.size < max) ids.add(m[1]!);
    }
  });
  return [...ids];
}

export interface FoundField {
  /** Contract C4: `block:<page>:<block id>:<setting>` or `record:<kind>:<id>:<field>`. */
  id: string;
  owner: 'block' | 'record';
  block?: { id: string; type: string; path: string };
  setting?: string;
  field?: string;
  label: string;
  kind: string;
  /** Fenced (`plain`, capped); an empty setting is ''. */
  value: string;
  /** Whether an assistant may propose a change to it: only fields of blocks the manifest lets assistants see; never a record's own field yet. */
  assistantMayEdit: boolean;
  /** A record's field: what saving it changes. */
  notice?: string;
}

const RECORD_NOTICE = 'This changes the post or gathering itself, everywhere it appears.';

/**
 * The text a page lets someone change, named in the C4 grammar. Plain `string` and `text` settings only (this
 * wave). Where a block shows a record's value because its typed setting is empty, the field is the record's
 * (`record:thread:<id>:title`), once per record, and only when `threads` says the record belongs to the org.
 */
export function findFields(a: {
  slug: string;
  doc: unknown;
  blocks: Record<string, ManifestBlock>;
  /** The org's threads this page names: ids, or id to title. Anything not listed is not offered as a record field. */
  threads: ReadonlySet<string> | ReadonlyMap<string, { title: string | null }>;
}): FoundField[] {
  const out: FoundField[] = [];
  const recordSeen = new Set<string>();
  const hasThread = (id: string) => (a.threads instanceof Map ? a.threads.has(id) : (a.threads as ReadonlySet<string>).has(id));
  const titleOf = (id: string): string => (a.threads instanceof Map ? (a.threads.get(id)?.title ?? '') : '');
  walkBlocks(a.doc, ({ node, props, path }) => {
    const b = visibleBlock(a.blocks, node.type);
    const id = props.id;
    if (!b) return false;
    if (typeof id !== 'string' || !BLOCK_ID.test(id)) return;
    for (const s of b.settings) {
      if (!s.fieldable) continue;
      const v = props[s.name];
      if (empty(v) && s.boundFrom?.editable) {
        const ref = typeof props[s.boundFrom.via] === 'string' ? THREAD_REF.exec(props[s.boundFrom.via] as string) : null;
        if (ref && hasThread(ref[1]!)) {
          const rid = `record:thread:${ref[1]}:${s.boundFrom.field}`;
          if (!recordSeen.has(rid)) {
            recordSeen.add(rid);
            out.push({ id: rid, owner: 'record', field: s.boundFrom.field, label: s.label, kind: s.kind as string, value: plain(titleOf(ref[1]!), MAX_STRING) ?? '', assistantMayEdit: false, notice: RECORD_NOTICE });
          }
          continue;
        }
      }
      out.push({
        id: `block:${a.slug}:${id}:${s.name}`,
        owner: 'block',
        block: { id, type: String(node.type), path },
        setting: s.name,
        label: s.label,
        kind: s.kind as string,
        value: typeof v === 'string' ? (plain(v, MAX_STRING) ?? '') : '',
        assistantMayEdit: b.agent.read,
      });
    }
  });
  return out;
}

const PAGE_REF = /^page:([a-z0-9][a-z0-9-]{0,48}(?:\/[a-z0-9][a-z0-9-]{0,48}){0,2})$/;
const THREAD_POPUP = /^popup:thread:([A-Za-z0-9_-]{1,64})$/;

/** What a page's `opens` settings point at: pages, and popups of threads (the caller checks those are the org's). */
export function opensOf(doc: unknown, blocks: Record<string, ManifestBlock>): { pages: string[]; threads: string[] } {
  const pages = new Set<string>();
  const threads = new Set<string>();
  walkBlocks(doc, ({ node, props }) => {
    const b = visibleBlock(blocks, node.type);
    if (!b) return false;
    const setting = b.opens?.setting;
    const v = setting ? props[setting] : undefined;
    if (typeof v !== 'string') return;
    const p = PAGE_REF.exec(v);
    const t = THREAD_POPUP.exec(v);
    if (p) pages.add(p[1]!);
    else if (t && threads.size < 60) threads.add(t[1]!);
  });
  return { pages: [...pages], threads: [...threads] };
}
