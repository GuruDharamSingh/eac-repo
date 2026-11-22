import { buyerBookingIcs, getBookingByAnyToken } from "@/lib/booking-lookup";

export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }): Promise<Response> {
  const { token } = await ctx.params;
  const b = await getBookingByAnyToken(token);
  if (!b || b.status !== "confirmed") return new Response("Not found", { status: 404 });
  return new Response(buyerBookingIcs(b), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${b.tourSlug}.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
