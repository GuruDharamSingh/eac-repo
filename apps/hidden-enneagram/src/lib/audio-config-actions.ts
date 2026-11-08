"use server";

import { revalidatePath } from "next/cache";
import { getApiEditor } from "@/lib/auth";
import { saveAudioConfig } from "./audio-config";
import type { AudioConfig } from "./audio-config-schema";

/** Save Ario's music and figure-sound settings. The role check is here: a client component is not an authorisation boundary. */
export async function saveAudioConfigAction(config: unknown): Promise<{ ok: boolean; error?: string; config?: AudioConfig }> {
  const editor = await getApiEditor();
  if (!editor) return { ok: false, error: "Only owners and editors can change the site's music." };
  const res = await saveAudioConfig(config);
  if (res.ok) revalidatePath("/", "layout");
  return res;
}
