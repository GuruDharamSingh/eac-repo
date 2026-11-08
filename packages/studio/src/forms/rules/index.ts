// ============================================================================
// @elkdonis/studio/forms rules (soft tissue): FormRule[] per kind.
// Checked by rules/check.ts (node, in the admin container; see its header).
// ============================================================================

import type { FormKindId, FormRule } from '../contract';
import { ARTWORK_RULES } from './artwork';
import { GATHERING_RULES } from './gathering';
import { POST_RULES } from './post';
import { SERVICE_RULES } from './service';

export { ARTWORK_RULES } from './artwork';
export { GATHERING_RULES } from './gathering';
export { POST_RULES } from './post';
export { SERVICE_RULES } from './service';
export * from './answers';

/** The rules a kind runs (a series runs the gathering's, which carry the series rules). */
export function rulesFor(kind: FormKindId): FormRule[] {
  switch (kind) {
    case 'post':
      return POST_RULES;
    case 'gathering':
      return GATHERING_RULES;
    case 'artwork':
      return ARTWORK_RULES;
    case 'service':
      return SERVICE_RULES;
    default:
      return [];
  }
}
