import { NextRequest } from "next/server";
import { handleLogin } from "@elkdonis/auth-server";

export async function POST(req: NextRequest) {
  return handleLogin(req);
}
