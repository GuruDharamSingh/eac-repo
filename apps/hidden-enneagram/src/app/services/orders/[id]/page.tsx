import { notFound } from "next/navigation";
import { getOrderById } from "@elkdonis/commerce/queries";
import { PaymentInstructionsCard } from "@elkdonis/checkout/components";
import type { PaymentDisplay } from "@elkdonis/payments";
import { siteConfig } from "@/config/site";

export const metadata = { title: "Your booking" };

export default async function ServiceOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await getOrderById(id);
  if (!order || order.metadata.orgId !== siteConfig.orgId) notFound();

  return (
    <div>
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
        Order {order.number}
      </p>
      <h1 className="mt-2 font-serif text-3xl font-medium">
        {order.status === "paid" ? "You're booked" : "Complete your booking"}
      </h1>

      {order.status === "paid" ? (
        <p className="mt-4 text-muted-foreground">
          Payment received — {siteConfig.orgName} will be in touch to confirm details.
        </p>
      ) : (
        <div className="mt-8">
          <PaymentInstructionsCard
            itemNoun="booking"
            display={
              {
                kind: "etransfer_instructions",
                payoutEmail: siteConfig.payoutEmail,
                reference: order.paymentReference ?? order.number,
                bodyText: order.paymentInstructions ?? "",
                dueAt: order.paymentDueAt ?? new Date().toISOString(),
              } satisfies PaymentDisplay
            }
          />
        </div>
      )}
    </div>
  );
}
