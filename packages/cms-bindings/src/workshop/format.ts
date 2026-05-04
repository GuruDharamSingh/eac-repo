export function formatDate(iso: string | null, locale = "en-CA"): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatTime(iso: string | null, locale = "en-CA"): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(locale, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC",
  });
}

export function startsIn(iso: string | null): string {
  if (!iso) return "";
  const ms = new Date(iso).getTime() - Date.now();
  if (ms < 0) return "Started";
  const days = Math.ceil(ms / 86_400_000);
  if (days === 0) return "Begins today";
  if (days === 1) return "Begins tomorrow";
  return `Begins in ${days} days`;
}

export function formatPrice(
  price: string | number | null | undefined,
  currency: string | null | undefined
): string {
  if (price === null || price === undefined || price === "") return "Free";
  const num = typeof price === "string" ? Number(price) : price;
  if (!Number.isFinite(num) || num <= 0) return "Free";
  const code = (currency || "USD").toUpperCase();
  try {
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: code,
      maximumFractionDigits: num % 1 === 0 ? 0 : 2,
    }).format(num);
  } catch {
    return `${num} ${code}`;
  }
}

export function formatLevel(level: string | null): string {
  if (!level) return "";
  return (
    { all_levels: "All levels", beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced" }[level] ?? level
  );
}

export function formatFormat(fmt: string | null): string {
  if (!fmt) return "";
  return (
    { in_person: "In-person", online: "Online", hybrid: "Hybrid" }[fmt] ?? fmt
  );
}

export function registrationCta(
  status: string | null,
  price: string | number | null,
  currency: string | null
): string {
  const priceLabel = formatPrice(price, currency);
  switch (status) {
    case "full": return "Join waitlist";
    case "closed": return "Registration closed";
    default: return priceLabel === "Free" ? "Register now" : `Register — ${priceLabel}`;
  }
}
