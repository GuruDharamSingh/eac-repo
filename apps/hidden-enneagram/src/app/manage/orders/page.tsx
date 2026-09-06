import { listOrdersForOrg, getOrderLines } from "@elkdonis/commerce/queries";
import { formatMoney } from "@elkdonis/commerce/money";
import { Badge } from "@/components/ui/badge";
import { siteConfig } from "@/config/site";
import { ConfirmOrderButton } from "./confirm-order-button";

export const metadata = { title: "Orders" };

export default async function ManageOrdersPage() {
  const orders = await listOrdersForOrg(siteConfig.orgId, { limit: 100 });
  const lineDescriptions = await Promise.all(
    orders.map(async (o) => {
      const lines = await getOrderLines(o.id);
      return lines.map((l) => l.description).join(", ");
    })
  );

  return (
    <div>
      <h2 className="font-serif text-xl">Orders</h2>

      {orders.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">No bookings yet.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Service</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {orders.map((o, i) => (
                <tr key={o.id} className="border-b border-border last:border-0 align-top">
                  <td className="px-4 py-3 font-mono text-xs">{o.number}</td>
                  <td className="px-4 py-3">{lineDescriptions[i] || "—"}</td>
                  <td className="px-4 py-3">
                    <div>{o.customerName || o.customerEmail}</div>
                    <div className="text-xs text-muted-foreground">{o.customerEmail}</div>
                  </td>
                  <td className="px-4 py-3">{formatMoney(o.totalMinor, o.currency)}</td>
                  <td className="px-4 py-3 font-mono text-xs">{o.paymentReference ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Badge variant={o.status === "paid" ? "default" : "secondary"}>
                      {o.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {o.status === "awaiting_etransfer" && <ConfirmOrderButton orderId={o.id} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
