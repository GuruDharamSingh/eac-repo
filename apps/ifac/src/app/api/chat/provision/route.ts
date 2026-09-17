import { NextResponse } from "next/server";
import { ensureOrgChatRoom } from "@elkdonis/services";
import { orgId, withEditor } from "@/lib/chat-api";

/**
 * Creates IFAC's General Chat room on first use — the button the hub shows an
 * owner or guide when the org has no room yet. Idempotent: an org that already
 * has one keeps it, name and history intact, and only has its public flag
 * enforced (a private room silently rejects every member who has no Nextcloud
 * account of their own, which today is all of them).
 */
export async function POST() {
  return withEditor(async () => NextResponse.json(await ensureOrgChatRoom(orgId)));
}
