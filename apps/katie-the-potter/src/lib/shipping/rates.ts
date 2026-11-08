import type { EsRate } from "./easyship";

// ============================================================================
// Easyship rates -> what the buyer sees. Pure.
//
// Rates are requested WITH insurance (insured for the pieces' price), so each
// rate's total_charge includes its insurance_fee; the uninsured price is the
// total minus that fee. At most three options are featured: the cheapest,
// the fastest and Easyship's best value (value_for_money_rank 1), distinct;
// the rest sit behind "Show all carriers".
// ============================================================================

export type OptionTag = "cheapest" | "fastest" | "best value";

export interface ShippingOption {
  courierServiceId: string;
  courier: string;
  service: string;
  minDays: number | null;
  maxDays: number | null;
  /** Insured total, minor units. */
  insuredMinor: number;
  /** Without insurance, minor units. */
  uninsuredMinor: number;
  insuranceMinor: number;
  currency: string;
  dutyMinor: number;
  taxMinor: number;
  dropoff: boolean;
  pickup: boolean;
  tags: OptionTag[];
}

const minor = (x: number | null | undefined) => Math.round((Number(x) || 0) * 100);

export function toOption(r: EsRate): ShippingOption {
  const total = minor(r.total_charge);
  const ins = Math.max(0, minor(r.insurance_fee));
  const handover = r.available_handover_options ?? [];
  return {
    courierServiceId: r.courier_service.id,
    courier: r.courier_service.umbrella_name || r.courier_service.name.split(" - ")[0] || r.courier_service.name,
    service: r.courier_service.name,
    minDays: r.min_delivery_time ?? null,
    maxDays: r.max_delivery_time ?? null,
    insuredMinor: total,
    uninsuredMinor: Math.max(0, total - ins),
    insuranceMinor: ins,
    currency: (r.currency || "CAD").toUpperCase(),
    dutyMinor: minor(r.estimated_import_duty),
    taxMinor: minor(r.estimated_import_tax),
    dropoff: handover.includes("dropoff"),
    pickup: handover.includes("free_pickup") || handover.includes("paid_pickup"),
    tags: [],
  };
}

/** Featured (≤3, tagged) and the rest, from Easyship's rates. */
export function chooseOptions(rates: EsRate[]): { featured: ShippingOption[]; rest: ShippingOption[] } {
  const all = rates.filter((r) => r?.courier_service?.id && Number(r.total_charge) > 0).map((r) => ({ r, o: toOption(r) }));
  if (all.length === 0) return { featured: [], rest: [] };
  const rank = (v: number | null | undefined, fallback: number) => (typeof v === "number" && v > 0 ? v : fallback);
  const by = (f: (x: (typeof all)[number]) => number) => [...all].sort((a, b) => f(a) - f(b) || a.o.uninsuredMinor - b.o.uninsuredMinor)[0]!;
  const cheapest = by((x) => rank(x.r.cost_rank, 1000) * 1e7 + x.o.uninsuredMinor);
  const fastest = by((x) => rank(x.r.delivery_time_rank, 1000) * 1e3 + (x.o.maxDays ?? 99));
  const best = all.find((x) => x.r.value_for_money_rank === 1) ?? null;
  const featured: ShippingOption[] = [];
  const add = (x: (typeof all)[number] | null, tag: OptionTag) => {
    if (!x) return;
    const have = featured.find((f) => f.courierServiceId === x.o.courierServiceId);
    if (have) have.tags.push(tag);
    else featured.push({ ...x.o, tags: [tag] });
  };
  add(best, "best value");
  add(cheapest, "cheapest");
  add(fastest, "fastest");
  featured.sort((a, b) => a.uninsuredMinor - b.uninsuredMinor);
  const ids = new Set(featured.map((f) => f.courierServiceId));
  const rest = all
    .filter((x) => !ids.has(x.o.courierServiceId))
    .map((x) => x.o)
    .sort((a, b) => a.uninsuredMinor - b.uninsuredMinor);
  return { featured, rest };
}

export function daysLabel(o: Pick<ShippingOption, "minDays" | "maxDays">): string {
  const a = o.minDays;
  const b = o.maxDays;
  if (a == null && b == null) return "delivery time not given";
  if (a != null && b != null && a !== b) return `${a} to ${b} business days`;
  const n = (b ?? a)!;
  return `${n} business ${n === 1 ? "day" : "days"}`;
}

export function priceFor(o: ShippingOption, insured: boolean): number {
  return insured ? o.insuredMinor : o.uninsuredMinor;
}
