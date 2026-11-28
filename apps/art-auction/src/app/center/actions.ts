"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { listStoresForUser } from "@elkdonis/commerce/queries";
import { getCurrentUserId, STUDIO_STORE_COOKIE } from "@/lib/marketplace-auth";

/**
 * "Acting for" on /center: remember which store the person is acting for (the same cookie /studio reads), then
 * come back to /center. Only a store the person can act for is accepted; anything else is ignored.
 */
export async function chooseCenterStore(storeId: string): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login?next=/center");
  const stores = await listStoresForUser(userId);
  if (stores.some((s) => s.id === storeId)) {
    const jar = await cookies();
    jar.set(STUDIO_STORE_COOKIE, storeId, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 180 * 86400 });
  }
  redirect("/center");
}
