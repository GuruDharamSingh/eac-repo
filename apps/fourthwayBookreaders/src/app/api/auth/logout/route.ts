import type { NextRequest } from "next/server";
import { handleLogout } from "@elkdonis/auth-server";

export async function POST(request: NextRequest) {
  return handleLogout(request);
}
