import type { Address } from "@elkdonis/commerce/types";
import type { EsAddress, EsParcel } from "./easyship";
import type { Packing, ShipFrom } from "./settings";

// ============================================================================
// From a piece to a parcel, and from our addresses to Easyship's. Pure.
//
// Packed-box rule (ceramics, padded all round): box = the piece + 2 × padding
// on each dimension, rounded up to the next whole cm; weight = piece + box kg
// + extra % of the piece, rounded up to 10 g. One parcel per piece (safest
// for ceramics). A box over 30 kg or 150 cm on its longest side is "quote by
// hand".
//
// Customs (every rate request carries items; the US needs them): HS 691200
// (ceramic tableware, kitchenware: bowls, cups, plates, jugs) or 691390
// (ornamental ceramic articles: vases, sculpture), declared value = the
// piece's price, origin CA. Verified 2026-11-07: a production quote CA->US
// with 691200 returns DHL and FedEx services with duty estimates.
// ============================================================================

export interface PieceForParcel {
  artworkId: string;
  title: string;
  medium: string | null;
  heightCm: number | null;
  widthCm: number | null;
  depthCm: number | null;
  weightKg: number | null;
  /** Price in major units (the declared value). */
  price: number;
  currency: string;
}

export interface PackedParcel {
  artworkId: string;
  title: string;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  weightKg: number;
  hsCode: string;
  declared: number;
  currency: string;
  rule: string;
}

export const MAX_KG = 30;
export const MAX_SIDE_CM = 150;

const ORNAMENTAL = /\b(vase|vases|sculpt|ornament|figure|figurine|tile|wall|bud)\b/i;

export function hsCodeFor(p: Pick<PieceForParcel, "title" | "medium">): string {
  return ORNAMENTAL.test(`${p.title} ${p.medium ?? ""}`) ? "691390" : "691200";
}

/** The packed parcel for one piece, or why there is none. */
export function packPiece(p: PieceForParcel, packing: Packing): PackedParcel | { problem: string } {
  const h = p.heightCm && p.heightCm > 0 ? p.heightCm : null;
  const w = p.widthCm && p.widthCm > 0 ? p.widthCm : null;
  // A round pot is as deep as it is wide; only height and width are needed.
  const d = p.depthCm && p.depthCm > 0 ? p.depthCm : w;
  if (!h || !w || !d) return { problem: `“${p.title}” has no size yet.` };
  if (!p.weightKg || p.weightKg <= 0) return { problem: `“${p.title}” has no weight yet.` };
  const pad = 2 * packing.paddingCm;
  const dims = [w + pad, d + pad, h + pad].map((x) => Math.ceil(x));
  const weight = Math.ceil((p.weightKg + packing.boxKg + (p.weightKg * packing.extraPct) / 100) * 100) / 100;
  if (Math.max(...dims) > MAX_SIDE_CM || weight > MAX_KG) {
    return { problem: `“${p.title}” packs too big for a quote (${dims.join(" × ")} cm, ${weight} kg). Katie will arrange it.` };
  }
  return {
    artworkId: p.artworkId,
    title: p.title,
    lengthCm: dims[0]!,
    widthCm: dims[1]!,
    heightCm: dims[2]!,
    weightKg: weight,
    hsCode: hsCodeFor(p),
    declared: Math.max(1, p.price),
    currency: p.currency,
    rule: `piece + ${packing.paddingCm} cm a side; + ${packing.boxKg} kg + ${packing.extraPct}%`,
  };
}

export function toEsParcel(pp: PackedParcel): EsParcel {
  return {
    box: { length: pp.lengthCm, width: pp.widthCm, height: pp.heightCm },
    total_actual_weight: pp.weightKg,
    items: [
      {
        quantity: 1,
        description: `Handmade ceramic: ${pp.title}`.slice(0, 200),
        hs_code: pp.hsCode,
        origin_country_alpha2: "CA",
        declared_currency: pp.currency,
        declared_customs_value: pp.declared,
        actual_weight: pp.weightKg,
        sku: pp.artworkId.slice(0, 8),
      },
    ],
  };
}

export function originToEs(o: ShipFrom): EsAddress {
  return {
    contact_name: o.name.slice(0, 22),
    company_name: o.company || o.name,
    contact_phone: o.phone,
    contact_email: o.email,
    line_1: o.line1,
    line_2: o.line2,
    city: o.city,
    state: o.region,
    postal_code: o.postalCode,
    country_alpha2: o.country,
  };
}

/**
 * The buyer's address for Easyship. Carriers want a phone and an email for
 * the receiver; when the buyer gave none, the studio's are used (the carrier
 * then calls Katie, who has the buyer's email).
 */
export function destinationToEs(a: Address, fallback: { name: string | null; email: string | null; phone: string; studioEmail: string }): EsAddress {
  return {
    // Couriers take at most 22 characters here (Easyship 422, verified 2026-11-07).
    contact_name: (a.recipientName || fallback.name || "Buyer").trim().slice(0, 22),
    contact_phone: a.phone?.trim() || fallback.phone,
    contact_email: fallback.email?.trim() || fallback.studioEmail,
    line_1: a.line1,
    line_2: a.line2 ?? null,
    city: a.city,
    state: a.region ?? null,
    postal_code: a.postalCode,
    country_alpha2: (a.country || "CA").toUpperCase(),
  };
}
