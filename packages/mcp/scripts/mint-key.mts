// Mint a personal MCP key (operator script, slice 1; PLAN.md §2.3). Needs the
// mcp_grants migration. Prints the key once; only its hash is stored.
//
//   pnpm --filter @elkdonis/lms exec tsx ../mcp/scripts/mint-key.mts <email> <org id|slug|*> "<label>" [days]
//   pnpm --filter @elkdonis/lms exec tsx ../mcp/scripts/mint-key.mts --revoke <grant id>
import { db } from '@elkdonis/db';
import { mintGrant, revokeGrant } from '../src/server/grants';
import { orgIdOf } from '../src/server/org';

const [a, b, c, d] = process.argv.slice(2);
if (a === '--revoke') {
  console.log((await revokeGrant(String(b))) ? `revoked ${b}` : `no live grant ${b}`);
  process.exit(0);
}
if (!a || !b) {
  console.error('usage: mint-key.mts <email> <org id|slug|*> "<label>" [days] | --revoke <grant id>');
  process.exit(2);
}
const [u] = await db<Array<{ id: string }>>`SELECT id FROM users WHERE lower(email) = lower(${a}) LIMIT 1`;
if (!u) {
  console.error('no such user');
  process.exit(1);
}
const orgScope = b === '*' ? '*' : await orgIdOf(b);
if (!orgScope) {
  console.error('no such organisation');
  process.exit(1);
}
const out = await mintGrant({ userId: u.id, orgScope, label: c || 'personal key', days: d ? Number(d) : 90 });
console.log(`grant ${out.id} for ${a}, org ${orgScope}, expires ${out.expiresAt.toISOString()}`);
console.log(`key (shown once): ${out.key}`);
process.exit(0);
