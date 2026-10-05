import { bookingIcs, getBookingByToken } from "@elkdonis/commerce/server";

/** The buyer's calendar file for a confirmed booking; the token is the key. */
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const booking = await getBookingByToken(token);
  const ics = booking?.status === "confirmed" ? bookingIcs(booking) : null;
  if (!ics) return new Response("Not found", { status: 404 });
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="booking.ics"',
      "Cache-Control": "private, no-store",
    },
  });
}
