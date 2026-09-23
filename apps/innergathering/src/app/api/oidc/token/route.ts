import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { externalOrigin, findUser, generateIdToken, getClient, secretsMatch, validateAuthCode } from "@/lib/oidc";

export const dynamic = "force-dynamic";

/** POST /api/oidc/token — Nextcloud trades the code for an ID token. */
export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") || "";
  let body: Record<string, string>;
  try {
    body = contentType.includes("application/json")
      ? await req.json()
      : (Object.fromEntries(await req.formData()) as Record<string, string>);
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const { code, client_id, client_secret, redirect_uri, grant_type, code_verifier } = body;

  const client = getClient(client_id);
  if (!client || !secretsMatch(client_secret, client.secret)) {
    return NextResponse.json({ error: "invalid_client" }, { status: 401 });
  }
  if (grant_type !== "authorization_code") {
    return NextResponse.json({ error: "unsupported_grant_type" }, { status: 400 });
  }

  const validated = await validateAuthCode(code, client, redirect_uri);
  if (!validated) return NextResponse.json({ error: "invalid_grant" }, { status: 400 });

  if (validated.codeChallenge) {
    if (!code_verifier) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    const method = (validated.codeChallengeMethod || "plain").toLowerCase();
    const ok =
      method === "s256"
        ? createHash("sha256").update(code_verifier).digest("base64url") === validated.codeChallenge
        : code_verifier === validated.codeChallenge;
    if (!ok) return NextResponse.json({ error: "invalid_grant" }, { status: 400 });
  }

  const user = await findUser(validated.userId);
  if (!user) return NextResponse.json({ error: "user_not_found" }, { status: 400 });

  const idToken = generateIdToken(user, client.id, externalOrigin(req).replace(/\/$/, ""), validated.nonce);
  return NextResponse.json({
    access_token: idToken,
    token_type: "Bearer",
    expires_in: 3600,
    id_token: idToken,
  });
}
