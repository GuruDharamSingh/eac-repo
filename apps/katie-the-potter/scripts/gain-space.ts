// One-off: give the site owner the collective (`oad`) membership a store needs.
//   docker compose run --rm --no-deps -T -e SENDGRID_API_KEY= -w /app/apps/katie-the-potter art-auction \
//     node /app/node_modules/.pnpm/tsx@4.20.6/node_modules/tsx/dist/cli.mjs scripts/gain-space.ts
import { db } from "@elkdonis/db";
import { gainSpace } from "@elkdonis/services";

async function main() {
  const email = process.env.SEED_EMAIL ?? "katie@katiethepotter.example";
  const [u] = await db<Array<{ id: string }>>`SELECT id FROM users WHERE lower(email) = lower(${email})`;
  if (!u) throw new Error(`no user for ${email}`);
  console.log("gainSpace:", JSON.stringify(await gainSpace(u.id)));
  console.log("memberships:", JSON.stringify(await db`SELECT org_id, role FROM user_organizations WHERE user_id = ${u.id}`));
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
