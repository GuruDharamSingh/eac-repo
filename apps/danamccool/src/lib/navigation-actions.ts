"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { saveNav } from "./navigation-store";
import type { NavItem } from "./navigation";

/** The role check lives here, not in the editor — a client component is not
 *  an authorisation boundary. */
export async function saveNavAction(items: NavItem[]): Promise<{ ok: boolean; error?: string }> {
  const viewer = await getViewer();
  if (!viewer?.canEdit) return { ok: false, error: "Only the site owner can change the navigation." };

  const result = await saveNav(items);
  // The nav is in the root layout, so every route's render is now stale.
  if (result.ok) revalidatePath("/", "layout");
  return result;
}
