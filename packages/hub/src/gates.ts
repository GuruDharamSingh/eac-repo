// Gate evaluation for cards and sections. Pure; used by server loaders to build
// `can` and by hosts to decide whether a card is drawn at all.

import type { HubCardDef, HubGate, HubRole, HubSectionGate, HubViewer } from './contract';

const RANK: Record<HubRole, number> = { viewer: 1, member: 2, guide: 3, owner: 4 };

export function passesGate(gate: HubGate, viewer: HubViewer | null): boolean {
  if (gate === 'public') return true;
  if (!viewer) return false;
  if (gate === 'signed-in') return true;
  if (viewer.isNetworkAdmin) return true;
  if (!viewer.role) return false;
  const need: HubRole = gate;
  return RANK[viewer.role] >= RANK[need];
}

/** capabilities: the org's switched-on keys (site.features ∪ org_grants today; org_capabilities later). */
export function sectionOn(
  section: HubSectionGate | undefined,
  viewer: HubViewer | null,
  capabilities: ReadonlySet<string>,
): boolean {
  if (!section) return true;
  if (section.gate && !passesGate(section.gate, viewer)) return false;
  if (section.capability && !capabilities.has(section.capability)) return false;
  return true;
}

export function cardOn(
  card: Pick<HubCardDef, 'gate' | 'capability'>,
  viewer: HubViewer | null,
  capabilities: ReadonlySet<string>,
): boolean {
  if (!passesGate(card.gate, viewer)) return false;
  if (card.capability && !capabilities.has(card.capability)) return false;
  return true;
}
