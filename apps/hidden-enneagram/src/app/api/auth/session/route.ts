import { NextRequest } from "next/server";
import { handleGetSession } from "@elkdonis/auth-server";

export async function GET(req: NextRequest) {
  return handleGetSession(req);
}
