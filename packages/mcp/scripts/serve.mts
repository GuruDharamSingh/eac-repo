// A local MCP endpoint for curl and client tests without a deploy (2026-11-08).
// Wraps the same handler the arts-collective route mounts in node:http, over the
// real database, with in-memory keys (printed once at start) and in-memory audit.
//
//   MCP_PORT=3990 pnpm --filter @elkdonis/lms exec tsx ../mcp/scripts/serve.mts
//
// Requests must carry Host: arts-collective.com (or the container name passed in
// MCP_EXTRA_HOSTS) and Authorization: Bearer <key>. Stops on SIGTERM.
import { createServer } from 'node:http';
import { harness } from './harness.mjs';

const port = Number(process.env.MCP_PORT || 3990);
const extra = (process.env.MCP_EXTRA_HOSTS || '').split(',').map((s) => s.trim()).filter(Boolean);
const { handle, keys, audit } = harness(extra);

const server = createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
  const request = new Request(`https://arts-collective.com${req.url ?? '/'}`, {
    method: req.method,
    headers,
    body: req.method === 'POST' ? Buffer.concat(chunks) : undefined,
  });
  const out = await handle(request);
  res.writeHead(out.status, Object.fromEntries(out.headers.entries()));
  res.end(Buffer.from(await out.arrayBuffer()));
  const last = audit.rows[audit.rows.length - 1];
  if (last) console.log(`[audit] ${last.tool} ok=${last.ok} code=${last.code} org=${last.orgId} ${last.ms}ms`);
});

server.listen(port, '0.0.0.0', () => {
  console.log(`mcp serve on :${port}; test keys (memory only, gone when this stops):`);
  for (const [name, key] of Object.entries(keys)) console.log(`  ${name}: ${key}`);
});
process.on('SIGTERM', () => server.close(() => process.exit(0)));
