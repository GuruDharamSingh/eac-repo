import { NextRequest } from "next/server";
import { handleLogout } from "@elkdonis/auth-server";

export async function POST(req: NextRequest) {
  return handleLogout(req);
}
