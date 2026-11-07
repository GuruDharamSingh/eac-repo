import Link from "next/link";
import { Plus } from "lucide-react";
import { Button, Badge } from "@elkdonis/primitives";
import { formatDeparture, formatPrice, listTours, nextDepartures } from "@/lib/tours";
import { TourRowActions } from "@/components/manage/tour-row-actions";
import { requireOrgEditor } from "@/lib/auth";

// Getting paid moved off Manage on 2026-11-06 (onboarding is done); it stays in /hub, where Stripe now returns.
export default async function ManageToursPage() {
  // Gate in the page as well as the layout: Next renders the two in parallel, and
  // the layout's redirect did not stop this page's data from streaming to a
  // signed-out visitor (verified on the live sites, 2026-11-06).
  await requireOrgEditor();
  const tours = await listTours({ includeDrafts: true });
  const next = await nextDepartures(tours.map((t) => t.id));

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-serif text-2xl">Tours</h2>
        <span className="flex items-center gap-4">
        <Link href="/studio/tour-detail" className="text-sm underline underline-offset-4">Page layout</Link>
        <Button asChild size="sm">
          <Link href="/manage/tours/new">
            <Plus className="size-4" aria-hidden />
            New tour
          </Link>
        </Button>
        </span>
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
