"use server";

import { createDeviceToken } from "@elkdonis/auth-server";
import { getViewer } from "@/lib/auth";
import { LINK_APPS, cleanLabel, cleanState } from "./apps";

/** Mint a device token for the signed-in viewer and return the app URL that carries it. */
export async function linkDevice(app: string, label: string, state: string): Promise<{ url?: string; error?: string }> {
  const viewer = await getViewer();
  if (!viewer) return { error: "Sign in first" };
  const target = LINK_APPS[app];
  if (!target) return { error: "Unknown app" };
  const token = await createDeviceToken(viewer.userId, app, cleanLabel(label) || "Device");
  const params = new URLSearchParams({ token, email: viewer.email, state: cleanState(state) });
  return { url: `${target.returnUrl}?${params.toString()}` };
}
