// ============================================================================
// What may name a person's page within one org — migration 157's `key`.
//
// Its own module for the same reason slug.ts is: user-store.ts imports
// @elkdonis/db, which must never be reachable from the client entry point,
// and a malformed key is a 404 a route can decide before it ever asks the
// database anything.
// ============================================================================

/** Matches user_pages' own CHECK constraint exactly — one rule, two places it is enforced. */
const KEY_SHAPE = /^[a-z][a-z0-9]*(:[0-9]{1,3})?$/;

export function isValidUserPageKey(key: string): boolean {
  return KEY_SHAPE.test(key) && key.length <= 50;
}
