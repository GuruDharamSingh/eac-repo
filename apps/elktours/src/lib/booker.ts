// Pay (design 05): prefill the booker's name and email for a signed-in guest.
// Plain server read; returns nulls when signed out. Never used to authorise anything.

import { db } from "@elkdonis/db";
import { getViewer } from "@/lib/auth";

export interface BookerDefaults { name: string | null; email: string | null }

export async function getBookerDefaults(): Promise<BookerDefaults> {
  const v = await getViewer().catch(() => null);
  if (!v) return { name: null, email: null };
  try {
    const [r] = (await db`SELECT display_name FROM users WHERE id = ${v.userId} LIMIT 1`) as unknown as Array<{ display_name: string | null }>;
    return { name: r?.display_name ?? null, email: v.email ?? null };
  } catch {
    return { name: null, email: v.email ?? null };
  }
}
