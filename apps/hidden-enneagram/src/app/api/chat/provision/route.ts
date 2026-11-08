import { NextResponse } from "next/server";
import { ensureOrgChatRoom } from "@elkdonis/services";
import { orgId, withEditor } from "@/lib/chat-api";

/** Creates the org's Talk room on first use. Idempotent. */
export async function POST() {
  return withEditor(async () => NextResponse.json(await ensureOrgChatRoom(orgId)));
}
