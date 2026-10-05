import { bookingIcs, getSellerBooking } from "@elkdonis/commerce/server";
import { getCurrentUser } from "@/lib/session";

/** The seller's calendar file for one confirmed booking (their own only). */
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return new Response("Sign in first", { status: 401 });
  const booking = await getSellerBooking(user.id, id);
  const ics = booking?.status === "confirmed" ? bookingIcs(booking) : null;
  if (!ics) return new Response("Not found", { status: 404 });
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="booking-${id.slice(0, 8)}.ics"`,
      "Cache-Control": "private, no-store",
    },
  });
}
