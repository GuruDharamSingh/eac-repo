import Link from "next/link";
import { Plus } from "lucide-react";
import { Button, Badge } from "@elkdonis/primitives";
import { formatDeparture, formatPrice, listTours, nextDepartures } from "@/lib/tours";
import { TourRowActions } from "@/components/manage/tour-row-actions";
import { PayoutsCard } from "@/components/manage/payouts-card";
import { getPayoutIdentity } from "@elkdonis/commerce/server";
import { isCardPaymentAvailable } from "@elkdonis/checkout/stripe";
import { getViewer } from "@/lib/auth";

export default async function ManageToursPage({ searchParams }: { searchParams: Promise<{ payouts?: string }> }) {
  const [{ payouts: returned = null }, viewer] = await Promise.all([searchParams, getViewer()]);
  const [tours, identity] = await Promise.all([
    listTours({ includeDrafts: true }),
    viewer ? getPayoutIdentity(viewer.userId).catch(() => null) : null,
  ]);
  const next = await nextDepartures(tours.map((t) => t.id));

  return (
    <>
      {viewer && (
        <div className="mb-10">
          {/* The guide is the payee of every tour they author (commerce.md): this is their own Stripe account, not the site's. */}
          <PayoutsCard
            identity={{
              country: identity?.country ?? null,
              payoutMethod: identity?.payoutMethod ?? null,
              payoutEmail: identity?.payoutEmail ?? null,
              hasAccount: Boolean(identity?.stripeAccountId),
              onboarded: Boolean(identity?.canReceiveDestinationCharge),
            }}
            cardAvailable={isCardPaymentAvailable()}
            returned={returned}
          />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-serif text-2xl">Tours</h2>
        <Button asChild size="sm">
          <Link href="/manage/tours/new">
            <Plus className="size-4" aria-hidden />
            New tour
          </Link>
        </Button>
      </div>

      {tours.length === 0 ? (
        <p className="mt-8 border border-dashed border-border p-10 text-center text-muted-foreground">
          No tours yet.{" "}
          <Link href="/manage/tours/new" className="underline underline-offset-4">Write the first one</Link>.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[44rem] text-sm">
            <thead className="border-b border-border text-left text-muted-foreground">
              <tr>
                <th className="pb-2 font-medium">Tour</th>
                <th className="pb-2 font-medium">Price</th>
                <th className="pb-2 font-medium">Next departure</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tours.map((t) => {
                const n = next.get(t.id);
                return (
                  <tr key={t.id} className="align-top">
                    <td className="py-3 pr-4">
                      <Link href={`/manage/tours/${t.id}`} className="font-medium underline-offset-4 hover:underline">{t.title}</Link>
                      {t.pinned && <Badge variant="secondary" className="ml-2">Featured</Badge>}
                    </td>
                    <td className="py-3 pr-4">{formatPrice(t.price, t.currency)}</td>
                    <td className="py-3 pr-4 text-muted-foreground">
                      {n ? `${formatDeparture(n.startsAt)} · ${n.seatsLeft}/${n.capacity} left` : "—"}
                    </td>
                    <td className="py-3 pr-4">
                      <Badge variant={t.status === "published" ? "default" : "outline"}>{t.status}</Badge>
                    </td>
                    <td className="py-3 text-right">
                      <TourRowActions id={t.id} slug={t.slug} status={t.status} pinned={t.pinned} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
