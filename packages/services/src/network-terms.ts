import { db } from '@elkdonis/db';
import { acceptAgreement } from './agreements';

/**
 * The network's Terms and Acceptable Use (migration 223): the active
 * `network-terms` agreement under the collective's org. Accepted at signup
 * and, for accounts from before it existed, from the hub.
 */
export const NETWORK_TERMS_ORG = 'elkdonis';
export const NETWORK_TERMS_KEY = 'network-terms';

export interface NetworkTerms {
  id: string;
  version: number;
  title: string;
  summary: string | null;
  bodyHtml: string | null;
  publishedAt: string | null;
}

export async function getNetworkTerms(): Promise<NetworkTerms | null> {
  const rows = await db<Array<{ id: string; version: number; title: string; summary: string | null; body_html: string | null; published_at: Date | null }>>`
    SELECT id, version, title, summary, body_html, published_at FROM org_agreements
    WHERE org_id = ${NETWORK_TERMS_ORG} AND key = ${NETWORK_TERMS_KEY} AND status = 'active' LIMIT 1
  `.catch(() => []);
  const r = rows[0];
  return r ? { id: r.id, version: r.version, title: r.title, summary: r.summary, bodyHtml: r.body_html, publishedAt: r.published_at?.toISOString() ?? null } : null;
}

/** Has this person accepted the current version? Null terms = nothing to accept. */
export async function hasAcceptedNetworkTerms(userId: string): Promise<boolean> {
  const terms = await getNetworkTerms();
  if (!terms) return true;
  const rows = await db`
    SELECT 1 FROM org_agreement_acceptances WHERE agreement_id = ${terms.id} AND user_id = ${userId} AND revoked_at IS NULL
  `.catch(() => []);
  return rows.length > 0;
}

export async function acceptNetworkTerms(userId: string): Promise<{ ok: boolean; error?: string }> {
  const terms = await getNetworkTerms();
  if (!terms) return { ok: false, error: 'There are no terms to accept yet.' };
  return acceptAgreement(terms.id, userId);
}
