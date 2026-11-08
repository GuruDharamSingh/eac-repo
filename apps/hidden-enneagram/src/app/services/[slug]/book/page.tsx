import { permanentRedirect } from "next/navigation";

/**
 * The old booking form (2026-09-27 to round 3). Booking is now "Book and pay"
 * on the service page itself (straight to Stripe; times after payment), so
 * this address forwards there (308). `?payment=cancelled` is kept: a Stripe
 * session started before the switch still returns here when cancelled.
 */
export default async function BookServicePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ payment?: string }>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const to = `/services/${encodeURIComponent(slug)}`;
  permanentRedirect(query.payment === "cancelled" ? `${to}?payment=cancelled` : to);
}
