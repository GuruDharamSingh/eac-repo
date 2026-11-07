import Link from "next/link";
import { listOrgDepartures, listOrgTourBookings } from "@elkdonis/commerce/server";
import { formatDeparture, formatPrice } from "@/lib/tours";
import { siteConfig } from "@/config/site";
import { requireOrgEditor } from "@/lib/auth";

export default async function ManageBookingsPage() {
  // Gate in the page as well as the layout: Next renders the two in parallel, and
  // the layout's redirect did not stop this page's data from streaming to a
  // signed-out visitor (verified on the live sites, 2026-11-06).
  await requireOrgEditor();
  const [departures, bookings] = await Promise.all([
    listOrgDepartures(siteConfig.orgId).catch(() => []),
    listOrgTourBookings(siteConfig.orgId, 100).catch(() => []),
  ]);
  const confirmed = bookings.filter((b) => b.status === "confirmed");
  const takings = confirmed.reduce((n, b) => n + b.totalMinor, 0);

  return (
    <div className="space-y-10">
      <section>
        <h2 className="font-serif text-2xl">Coming up</h2>
        {departures.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No departures scheduled.</p>
        ) : (
          <table className="mt-4 w-full text-sm">
            <thead className="border-b border-border text-left text-muted-foreground">
              <tr><th className="pb-2 font-medium">When</th><th className="pb-2 font-medium">Tour</th><th className="pb-2 font-medium">Guide</th><th className="pb-2 font-medium">Places</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {departures.map((d) => (
                <tr key={d.id}>
                  <td className="py-2 pr-4">{formatDeparture(d.startsAt, { withYear: true })}</td>
                  <td className="py-2 pr-4"><Link href={`/manage/tours/${d.threadId}?tab=departures`} className="underline-offset-4 hover:underline">{d.tourTitle}</Link></td>
                  <td className="py-2 pr-4 text-muted-foreground">{d.guideName ?? "—"}</td>
                  <td className="py-2">{d.seatsTaken}/{d.capacity}{d.confirmedBookings ? ` · ${d.confirmedBookings} booking${d.confirmedBookings === 1 ? "" : "s"}` : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-serif text-2xl">Recent bookings</h2>
          <p className="text-sm text-muted-foreground">{confirmed.length} confirmed · {formatPrice(takings / 100)} taken</p>
        </div>
        {bookings.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No bookings yet.</p>
        ) : (
          <table className="mt-4 w-full text-sm">
            <thead className="border-b border-border text-left text-muted-foreground">
              <tr><th className="pb-2 font-medium">Booked</th><th className="pb-2 font-medium">Who</th><th className="pb-2 font-medium">Tour</th><th className="pb-2 font-medium">Departure</th><th className="pb-2 font-medium">People</th><th className="pb-2 font-medium">Paid</th><th className="pb-2 font-medium">Status</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {bookings.map((b) => (
                <tr key={b.id} className={b.status === "cancelled" ? "text-muted-foreground" : ""}>
                  <td className="py-2 pr-4">{new Date(b.createdAt).toLocaleDateString("en-GB", { timeZone: siteConfig.timeZone })}</td>
                  <td className="py-2 pr-4">{b.buyerName ?? "—"} <a href={`mailto:${b.buyerEmail}`} className="text-muted-foreground underline">{b.buyerEmail}</a></td>
                  <td className="py-2 pr-4">{b.tourTitle}</td>
                  <td className="py-2 pr-4">{formatDeparture(b.startsAt, { withYear: true })}</td>
                  <td className="py-2 pr-4">{b.partySize}</td>
                  <td className="py-2 pr-4">{formatPrice(b.totalMinor / 100, b.currency)}</td>
                  <td className="py-2">{b.status}{b.orderNumber ? ` · ${b.orderNumber}` : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
