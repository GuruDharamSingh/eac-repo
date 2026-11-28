// ============================================================================
// The dock's confirm card, resolved (2026-11-16, DOCK_LOOP_SLICE1 §2.5).
// Client-safe and pure. Only `approved` / `changed` wording may show on a live dock
// (wording waves, D-16). Until Justin approves a row, a live visitor gets the generic
// card: chrome with no claim about what changes. Dev previews and global admins see
// the draft, tagged. The server resolves this and sends only the resolved card, so a
// client never holds draft text it should not show.
//
// Placeholders (2026-11-27): approved wording may hold `{org}`, `{name}`, `{title}`, `{email}`, `{state}`,
// `{price}`, `{where}`. They are filled from what is known (`fillPlaceholders`), and any left unknown becomes a
// neutral word, so a brace never reaches the screen. The card keeps the raw `template` and the `map` of
// placeholder to form field, so the dock can fill it again from what the person typed.
// ============================================================================
import type { ActionMeta, ActionRisk } from './types';

/** `draft-visible`: a dev preview or a global admin. `live`: everyone else. */
export type ConfirmMode = 'live' | 'draft-visible';

export interface ConfirmCard {
  kind: 'text' | 'draft' | 'generic';
  text: string;
  /** Approved card heading, when the row has one. */
  title?: string;
  risk: ActionRisk[];
  /** A money entry has no confirm card at all (route only); the dock checks this first. */
  money: boolean;
  /** The wording with its braces, present only when it had some: the dock fills it again from the typed values. */
  template?: string;
  /** Known placeholder values at the time the card was resolved. */
  vars?: Record<string, string>;
  /** Placeholder -> form field name (`ActionForm.confirmVars`). */
  map?: Record<string, string>;
}

export function isMoneyMeta(meta: Pick<ActionMeta, 'risk'>): boolean {
  return Boolean(meta.risk?.includes('money'));
}

/** What a placeholder reads as when nothing is known. */
export const NEUTRAL_WORDS: Record<string, string> = {
  org: 'your organisation',
  name: 'the name you give',
  title: 'this piece',
  email: 'that address',
  state: 'the new setting',
  price: 'the price you set',
  where: 'the places you choose',
};

/**
 * Fills `{placeholders}` from `vars` (blank values count as unknown), then neutral words, then, for a name nobody
 * knows, "it". The result never holds a brace pair.
 */
export function fillPlaceholders(text: string, vars: Record<string, string | undefined> = {}): string {
  return text.replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g, (_m, key: string) => {
    const v = vars[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
    return NEUTRAL_WORDS[key] ?? 'it';
  });
}

export function confirmView(meta: Pick<ActionMeta, 'label' | 'confirm' | 'risk'>, mode: ConfirmMode, vars?: Record<string, string | undefined>, map?: Record<string, string>): ConfirmCard {
  const risk = [...(meta.risk ?? [])];
  const money = risk.includes('money');
  const c = meta.confirm;
  const show = c && c.text.trim() && (c.status === 'approved' || c.status === 'changed' || mode === 'draft-visible');
  if (!show) return { kind: 'generic', text: `${meta.label}. This runs now, on your account.`, risk, money };
  const kind = c.status === 'approved' || c.status === 'changed' ? 'text' : 'draft';
  const hasBraces = /\{[A-Za-z][A-Za-z0-9_]*\}/.test(c.text);
  const known: Record<string, string> = {};
  for (const [k, v] of Object.entries(vars ?? {})) if (typeof v === 'string' && v.trim()) known[k] = v.trim();
  return {
    kind,
    text: fillPlaceholders(c.text, known),
    ...(c.title ? { title: fillPlaceholders(c.title, known) } : {}),
    risk,
    money,
    ...(hasBraces ? { template: c.text, vars: known, ...(map ? { map } : {}) } : {}),
  };
}
