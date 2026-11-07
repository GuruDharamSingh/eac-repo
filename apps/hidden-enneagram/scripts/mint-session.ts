// Mint a session cookie for TESTING, the procedure in docs/reference/testing.md
// ("Minting a session cookie"): GoTrue admin magic link -> verify -> session,
// cookie `sb-eac-auth=base64-<base64(JSON(session))>`. Writes the cookie VALUE
// (not printed) to OUT, mode 0600. Run from a one-off container that has
// SUPABASE_SERVICE_KEY and reaches supabase-auth:
//   docker compose run --rm --no-deps -T -e EMAIL=<email> -e OUT=/app/apps/hidden-enneagram/.session-x \
//     -w /app/apps/hidden-enneagram admin node /app/node_modules/.pnpm/tsx@4.20.6/node_modules/tsx/dist/cli.mjs scripts/mint-session.ts
// Delete the file after use. Never commit it (.gitignore: .session-*).
import { writeFileSync } from "node:fs";

async function main() {
  const email = process.env.EMAIL;
  const out = process.env.OUT;
  const key = process.env.SUPABASE_SERVICE_KEY;
  const base = process.env.SUPABASE_URL ?? "http://supabase-auth:9999";
  if (!email || !out || !key) throw new Error("EMAIL, OUT and SUPABASE_SERVICE_KEY are required");
  const h = { Authorization: `Bearer ${key}`, apikey: key, "content-type": "application/json" };
  const link = await fetch(`${base}/admin/generate_link`, { method: "POST", headers: h, body: JSON.stringify({ type: "magiclink", email }) });
  const lj = (await link.json()) as { hashed_token?: string; properties?: { hashed_token?: string } };
  const tokenHash = lj.hashed_token ?? lj.properties?.hashed_token;
  if (!link.ok || !tokenHash) throw new Error(`generate_link failed: ${link.status}`);
  const ver = await fetch(`${base}/verify`, { method: "POST", headers: h, body: JSON.stringify({ type: "magiclink", token_hash: tokenHash }) });
  const session = (await ver.json()) as { access_token?: string };
  if (!ver.ok || !session.access_token) throw new Error(`verify failed: ${ver.status}`);
  const value = `base64-${Buffer.from(JSON.stringify(session)).toString("base64")}`;
  writeFileSync(out, value, { mode: 0o600 });
  console.log(`session written for ${email} (${value.length} chars)`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(String(e)); process.exit(1); });
