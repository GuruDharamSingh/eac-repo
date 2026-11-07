import type { Address } from "@elkdonis/commerce/types";

/**
 * An order's shipping address on one line, for the order page and
 * /manage/orders: "Ana Ruiz, 12 Elm St, Apt 3, Toronto ON M5V 1A1, CA".
 * Null when there is none (a Buy-now order before Stripe's page collected it).
 */
export function formatAddress(a: Address | null | undefined): string | null {
  if (!a || !a.line1) return null;
  const cityLine = [a.city, [a.region, a.postalCode].filter(Boolean).join(" ")].filter((s) => s && s.trim()).join(" ");
  const parts = [a.recipientName, a.line1, a.line2, cityLine, a.country].map((s) => (typeof s === "string" ? s.trim() : "")).filter(Boolean);
  return parts.join(", ") || null;
}
