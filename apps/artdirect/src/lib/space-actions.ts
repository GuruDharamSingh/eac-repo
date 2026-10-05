"use server";

import { revalidatePath } from "next/cache";
import { db } from "@elkdonis/db";
import { setPersonSectionOrder } from "@elkdonis/services";
import { getCurrentUser } from "@/lib/session";

// ============================================================================
// The owner's page controls in the left drawer (PersonDrawer): section order
// and page background. Both act on the signed-in person only; nothing here
// takes a user id from the request.
// ============================================================================

async function revalidateOwnPage(userId: string) {
  const [row] = await db<{ slug: string | null }[]>`SELECT slug FROM users WHERE id = ${userId}`;
  if (row?.slug) revalidatePath(`/${row.slug}`);
}

/** Reorder the sections of the signed-in person's own ArtDirect page. */
export async function setSectionOrderAction(order: string[]): Promise<{ ok: boolean; order?: string[]; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in first." };
  const saved = await setPersonSectionOrder(user.id, order.slice(0, 20).map(String));
  await revalidateOwnPage(user.id);
  return { ok: true, order: saved };
}

const HEX = /^#[0-9a-f]{6}$/i;

/** WCAG relative luminance of a #rrggbb colour. */
function luminance(hex: string): number {
  const ch = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = ch.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

/**
 * Upper bound for the page ground. The frame look's text colours are fixed
 * light values (person-page.css `.eac-person-page--frame`): the muted ink
 * #bca7cf has luminance 0.428, so 4.5:1 needs a ground of luminance
 * <= (0.428 + 0.05) / 4.5 - 0.05 = 0.056. At that bound the body ink #e8e3e4
 * is 7.7:1 and the orange headings #ff8c00 4.2:1 (large text, 3:1 needed).
 * Measured 2026-09-27. Light grounds need a dark ink set, which the frame
 * look does not have yet.
 */
const MAX_GROUND_LUMINANCE = 0.056;

/**
 * Set (or clear with null) the page background of the signed-in person's own
 * ArtDirect page. Stored as `--oad-page-bg` in users.theme, merged so other
 * theme keys survive; ThemeStyle emits it and globals.css reads it.
 */
export async function setPageBackgroundAction(color: string | null): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in first." };
  if (color === null) {
    await db`UPDATE users SET theme = COALESCE(theme, '{}'::jsonb) - '--oad-page-bg' WHERE id = ${user.id}`;
  } else {
    if (!HEX.test(color)) return { ok: false, error: "Choose a colour." };
    if (luminance(color) > MAX_GROUND_LUMINANCE) {
      return { ok: false, error: "That colour is too light for the page's text. Choose a darker one." };
    }
    await db`
      UPDATE users
      SET theme = COALESCE(theme, '{}'::jsonb) || ${db.json({ "--oad-page-bg": color.toLowerCase() } as never)}
      WHERE id = ${user.id}
    `;
  }
  await revalidateOwnPage(user.id);
  return { ok: true };
}
