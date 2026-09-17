import type { NextRequest } from "next/server";
import { handleGetSession } from "@elkdonis/auth-server";

export async function GET(request: NextRequest) {
  return handleGetSession(request);
}
