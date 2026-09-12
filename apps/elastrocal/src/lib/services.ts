/** Display helpers for service offerings, shared by the public and hub pages. */

export const BOOKING_LABEL: Record<string, string> = {
  one_on_one: "One-on-one",
  group: "Group",
  async: "Self-paced",
};

export const FORMAT_LABEL: Record<string, string> = {
  in_person: "In person",
  online: "Online",
  hybrid: "Hybrid",
};

export const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  waitlist: "Waitlist",
  full: "Sold out",
  closed: "Closed",
};

export function priceLabel(price: number | null, currency: string, slidingMin: number | null): string | null {
  if (price == null) return null;
  const fmt = (n: number) => new Intl.NumberFormat("en-CA", { style: "currency", currency }).format(n);
  if (slidingMin != null) return `${fmt(slidingMin)}–${fmt(price)}, sliding scale`;
  return fmt(price);
}
