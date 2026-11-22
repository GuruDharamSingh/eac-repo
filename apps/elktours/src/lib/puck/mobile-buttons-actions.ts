"use server";

import { getApiEditor } from "@/lib/auth";
import { shownButtons } from "./mobile-buttons";
import type { ShownButton } from "@/blocks/mobile/page-buttons-logic";

/**
 * The editor's copy of the m-page-buttons resolver (2026-11-21). An owner or guide gets every button, each with a note
 * of who it is for; anyone else who calls this gets what their own session would see on the page, so the action cannot
 * be used to read a button the caller may not see. The gate is here because a client component is not a boundary.
 */
export async function mobileButtonsAction(rows: unknown, accountLabel: unknown): Promise<ShownButton[]> {
  const editor = await getApiEditor();
  return shownButtons(rows, accountLabel, undefined, Boolean(editor));
}
