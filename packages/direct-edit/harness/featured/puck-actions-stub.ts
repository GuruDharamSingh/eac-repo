// Stand-in for apps/elktours/src/lib/puck/actions.ts in the Studio harness: Publish records what would be saved.
const g = globalThis as any;
g.__published = null;
export async function savePageAction(slug: string, data: unknown) { g.__published = { slug, data: JSON.parse(JSON.stringify(data)) }; return { ok: true }; }
export async function checkNewPageAction(slug: string) { return { ok: true as const, slug }; }
export async function saveLandingAction() { return { ok: true }; }
export async function restoreLandingAction() { return { ok: true }; }
export async function slugProblem() { return null; }
