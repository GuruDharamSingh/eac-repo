import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@elkdonis/auth-server";
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

async function requireUser() {
  try {
    const session = await getServerSession();
    return session?.user?.id ? session.user : null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const statusParam = req.nextUrl.searchParams.get("status");
  const status =
    statusParam && statusParam !== "all" && VALID_STATUSES.includes(statusParam as OrderStatus)
      ? [statusParam as OrderStatus]
      : undefined;

  const orders = await listOrders({ limit: 200, status });
  return NextResponse.json({ orders });
}

export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
      confirmedByUserId: user.id,
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
