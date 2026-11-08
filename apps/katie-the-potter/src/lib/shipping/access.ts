import type { Order } from "@elkdonis/commerce/types";
import { getViewer } from "@/lib/auth";
import type { EasyshipMode } from "./easyship";
import { accountOf, flowOf, getShippingMode } from "./settings";

// ============================================================================
// Who sees "Choose shipping" for an order. The order itself is reached the
// order page's way (lib/shop.ts loadOrderForViewer: the signed-in buyer, the
// store team, an admin, or a guest holding the unguessable id); this adds
// the mode (lib/shipping/settings.ts):
//
//   off                 nobody (everything as before)
//   quote / live        the buyer, once the order is PAID (and afterwards,
//                       to see tracking)
//   quote_test / test   editors of this site only, on any order with an
//                       address, paid or not (a rehearsal: sandbox, no Stripe)
//
// `mode` is the Easyship ACCOUNT (test = sandbox, live = production);
// `flow` is quote-only (Katie buys the label) or the parked label flow.
// ============================================================================

export interface ShippingAccess {
  mode: EasyshipMode;
  flow: "quote" | "label";
  isEditor: boolean;
  /** A test mode on an order that is not paid: shown as a rehearsal. */
  rehearsal: boolean;
}

const PAID = new Set(["paid", "fulfilled", "completed"]);

export async function shippingAccessFor(order: Order): Promise<ShippingAccess | null> {
  const setting = await getShippingMode();
  const flow = flowOf(setting);
  if (!flow) return null;
  const mode = accountOf(setting);
  const viewer = await getViewer().catch(() => null);
  const isEditor = Boolean(viewer?.canEdit);
  if (order.status === "cancelled" || order.status === "refunded") return null;
  if (mode === "test") {
    if (!isEditor) return null;
    return { mode: "test", flow, isEditor, rehearsal: !PAID.has(order.status) };
  }
  if (!PAID.has(order.status)) return null;
  return { mode: "live", flow, isEditor, rehearsal: false };
}
