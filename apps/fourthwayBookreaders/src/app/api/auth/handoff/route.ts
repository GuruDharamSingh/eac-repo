import type { NextRequest } from "next/server";
import { handleHandoffStart } from "@elkdonis/auth-server";

/** Leave this site carrying the sign-in — see handleHandoffStart. */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handleHandoffStart(request);
}
