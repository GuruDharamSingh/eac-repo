import type { NextRequest } from "next/server";
import { handleHandoffAccept } from "@elkdonis/auth-server";

/**
 * Arrive on this site carrying the sign-in — see handleHandoffAccept.
 *
 * Under a basePath this answers at /books/api/auth/handoff/accept, which is
 * why the login page hands `ssoCheckUrl` an origin WITH the base: the network
 * host builds this URL from what it is given.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handleHandoffAccept(request);
}
