// Next.js inlines process.env.NEXT_PUBLIC_* at build time; the design tool loads this bundle
// in a plain browser page, where process does not exist. Packages read it at module scope
// (@elkdonis/utils constants, auth-client, cms-ui/auth), so define an empty env first.
const g = globalThis as any;
g.process ??= { env: {} };
g.process.env ??= {};
export {};
