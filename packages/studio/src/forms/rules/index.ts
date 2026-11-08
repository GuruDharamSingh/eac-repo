// ============================================================================
// @elkdonis/studio/forms rules (soft tissue): FormRule[] per kind.
// Checked by rules/check.ts (node, in the admin container; see its header).
// ============================================================================

import type { FormKindId, FormRule } from '../contract';
import { GATHERING_RULES } from './gathering';
import { POST_RULES } from './post';

export { GATHERING_RULES } from './gathering';
export { POST_RULES } from './post';
export * from './answers';

/** The rules a kind runs. Artwork and service arrive in pass 2. */
export function rulesFor(kind: FormKindId): FormRule[] {
  switch (kind) {
    case 'post':
      return POST_RULES;
    case 'gathering':
      return GATHERING_RULES;
    default:
      return [];
  }
}
