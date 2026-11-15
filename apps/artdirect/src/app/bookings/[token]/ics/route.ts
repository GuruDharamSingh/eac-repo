import { bookingIcs, getBookingByToken } from "@elkdonis/booking";

// A confirmed booking as a calendar file, by its private token.
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const b = await getBookingByToken(token);
  const ics = b && b.status === "confirmed"
    ? bookingIcs({ id: b.id, title: b.threadTitle, scheduledAt: b.scheduledAt, durationMinutes: b.durationMinutes, hostName: b.hostName, bookerName: b.bookerName })
    : null;
  if (!ics) return new Response("Not found", { status: 404 });
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="booking-${b!.id.slice(0, 8)}.ics"`,
      "Cache-Control": "private, no-store",
    },
  });
}
