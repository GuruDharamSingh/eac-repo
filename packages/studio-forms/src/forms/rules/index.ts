// ============================================================================
// @elkdonis/studio/forms rules (soft tissue): FormRule[] per kind.
// Checked by rules/check.ts (node, in the admin container; see its header).
// ============================================================================

import type { FormKindId, FormRule } from '../contract';
import { ARTWORK_RULES } from './artwork';
import { MEETING_RULES } from './meeting';
import { POST_RULES } from './post';
import { SERVICE_RULES } from './service';
import { SERIES_KIND_RULES } from './series-kind';
import { WORKSHOP_RULES } from './workshop';

export { ARTWORK_RULES } from './artwork';
export { MEETING_RULES } from './meeting';
export { POST_RULES } from './post';
export { SERVICE_RULES } from './service';
export { SERIES_KIND_RULES } from './series-kind';
export { WORKSHOP_RULES } from './workshop';
export * from './answers';

/** The rules a kind runs. */
export function rulesFor(kind: FormKindId): FormRule[] {
  switch (kind) {
    case 'series':
      return SERIES_KIND_RULES;
    case 'workshop':
      return WORKSHOP_RULES;
    case 'post':
      return POST_RULES;
    case 'meeting':
    case 'event':
      return MEETING_RULES;
    case 'artwork':
      return ARTWORK_RULES;
    case 'service':
      return SERVICE_RULES;
    default:
      return [];
  }
}
