"use server";

import { redirect } from "next/navigation";
import { bookAndPay } from "@/lib/booking-actions";

/**
 * The shared `checkout` block's action on this site (blocks/record-site.tsx).
 * The reference is what the resolver drew ("service:<slug>"); bookAndPay reads
 * the service again for this site's organisation and checks price, range and
 * availability itself, so nothing the page showed is trusted.
 */
export async function payForRecord(ref: string, formData: FormData): Promise<void> {
  const m = /^service:([a-z0-9][a-z0-9-]{0,99})$/.exec(typeof ref === "string" ? ref : "");
  if (!m) redirect("/readings");
  await bookAndPay(m[1], formData);
}
