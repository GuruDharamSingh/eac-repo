// Throwaway test of the Lam Rim routes: mints a device token for Justin, calls the routes, deletes the token.
import postgres from 'postgres';
import { randomBytes, createHash } from 'node:crypto';
const sql = postgres(process.env.DATABASE_URL, { max: 1 });
const [u] = await sql`SELECT id FROM users WHERE email = 'justin.gillisb@gmail.com'`;
const token = 'eacd_' + randomBytes(24).toString('hex');
const [row] = await sql`INSERT INTO device_tokens (user_id, app, label, token_hash) VALUES (${u.id}, 'jerusalem', 'lamrim-route-test', ${createHash('sha256').update(token).digest('hex')}) RETURNING id`;
const base = 'http://elastrocal:3016/astro/api/mobile/v1/lamrim';
const H = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
const get = async (p) => { const t0 = Date.now(); const r = await fetch(base + p, { headers: H }); const j = await r.json(); return [r.status, Date.now() - t0, j]; };
try {
  let [s, ms, j] = await get('/outline');
  console.log('outline', s, ms + 'ms', j.nodes?.length, JSON.stringify(j.nodes?.[120]));
  [s, ms, j] = await get('/node?id=LR.4.2.1.2');
  console.log('node', s, ms + 'ms', j.node?.title, 'passages', j.passages?.length, 'units', j.units?.length, 'items', j.items?.length, 'kinds', [...new Set(j.items?.map((i) => i.kind))].join(','), 'prev', j.prev?.title, 'next', j.next?.title);
  [s, ms, j] = await get('/deck?kind=argument');
  console.log('deck', s, ms + 'ms', j.item?.kind, j.item?.payload?.claim, 'done/total', j.done, j.total, 'unit', !!j.unit, 'passage', !!j.passage);
  const itemId = j.item?.id;
  let r = await fetch(base + '/review', { method: 'POST', headers: H, body: JSON.stringify({ targetKind: 'item', targetId: itemId, verdict: 'accurate', conviction: 4, note: 'route test' }) });
  const rv = await r.json();
  console.log('review', r.status, rv.review?.nodeId);
  [s, ms, j] = await get('/export');
  console.log('export', s, j.reviews?.length, j.reviews?.[0]?.snapshot?.kind);
  r = await fetch(base + '/review?id=' + rv.review.id, { method: 'DELETE', headers: H });
  console.log('delete review', r.status);
} finally {
  await sql`DELETE FROM device_tokens WHERE id = ${row.id}`;
  console.log('token deleted');
  await sql.end();
}
