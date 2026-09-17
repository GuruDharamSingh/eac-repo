import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/require-admin-api";
import { listOrders } from "@elkdonis/commerce/queries";
import { confirmEtransferReceived } from "@elkdonis/commerce/server";
import type { OrderStatus } from "@elkdonis/commerce/types";

const VALID_STATUSES: OrderStatus[] = [
  "draft",
  "pending_payment",
  "awaiting_etransfer",
  "payment_received",
  "paid",
  "fulfilled",
  "completed",
  "cancelled",
  "refunded",
];

export async function GET(req: NextRequest) {
  const gate = await requireAdminApi();
  if (gate.deny) return gate.deny;

  const statusParam = req.nextUrl.searchParams.get("status");
  const status =
    statusParam && statusParam !== "all" && VALID_STATUSES.includes(statusParam as OrderStatus)
      ? [statusParam as OrderStatus]
      : undefined;

  const orders = await listOrders({ limit: 200, status });
  return NextResponse.json({ orders });
}

export async function POST(req: NextRequest) {
  const gate = await requireAdminApi();
  if (gate.deny) return gate.deny;

  const body = (await req.json()) as {
    orderId?: string;
    paymentReference?: string;
    notes?: string;
  };
  if (!body.orderId) {
    return NextResponse.json({ error: "orderId is required" }, { status: 400 });
  }

  try {
    const order = await confirmEtransferReceived({
      orderId: body.orderId,
      confirmedByUserId: gate.userId,
      paymentReference: body.paymentReference,
      notes: body.notes,
    });
    return NextResponse.json({ order });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not confirm payment" },
      { status: 400 }
    );
  }
}
