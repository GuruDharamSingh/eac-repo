// ============================================================================
// The dock's confirm card, resolved (2026-11-16, DOCK_LOOP_SLICE1 §2.5).
// Client-safe and pure. Only `approved` / `changed` wording may show on a live dock
// (wording waves, D-16). Until Justin approves a row, a live visitor gets the generic
// card: chrome with no claim about what changes. Dev previews and global admins see
// the draft, tagged. The server resolves this and sends only the resolved card, so a
// client never holds draft text it should not show.
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
}

export function isMoneyMeta(meta: Pick<ActionMeta, 'risk'>): boolean {
  return Boolean(meta.risk?.includes('money'));
}

export function confirmView(meta: Pick<ActionMeta, 'label' | 'confirm' | 'risk'>, mode: ConfirmMode): ConfirmCard {
  const risk = [...(meta.risk ?? [])];
  const money = risk.includes('money');
  const c = meta.confirm;
  if (c && c.text.trim() && (c.status === 'approved' || c.status === 'changed')) return { kind: 'text', text: c.text, ...(c.title ? { title: c.title } : {}), risk, money };
  if (c && c.text.trim() && mode === 'draft-visible') return { kind: 'draft', text: c.text, ...(c.title ? { title: c.title } : {}), risk, money };
  return { kind: 'generic', text: `${meta.label}. This runs now, on your account.`, risk, money };
}
