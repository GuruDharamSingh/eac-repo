// ============================================================================
// The network's own words — now a VIEW over copy-slots.ts.
//
// This file used to BE the registry: a dozen exported constants that the
// templates imported directly. That is why an organisation could not change
// any of them — a constant compiled into a component has no override point.
//
// The words moved to `copy-slots.ts`, where each block carries an id, a label
// and the tokens it may use, so the editor can list them and an org can
// rewrite any one of them. What survives here is the old surface, derived from
// the new one, because `@elkdonis/email` exports this module as `copy` and
// removing the names outright would break that export for no gain.
//
// New code should read the slots. These are for the callers that already had
// a constant in hand, and for the templates' own defaults.
// ============================================================================

import { COPY_SLOTS, type Paragraphs } from './copy-slots';

export type { Paragraphs } from './copy-slots';
export { fill, paragraphsOf } from './copy-slots';

/** A slot's default words, or an empty list if it has been retired. */
const words = (id: string): Paragraphs => COPY_SLOTS[id]?.value ?? [];

export const NETWORK_MANIFESTO: Paragraphs = words('network.about');
export const NETWORK_RESOURCES: Paragraphs = words('network.resources');
export const SIGNUP_CONFIRM: Paragraphs = words('signup.confirm');
export const SIGNUP_NETWORK_NOTE: Paragraphs = words('signup.membership');
export const SIGNUP_BY_PURCHASE: Paragraphs = words('signup.by_purchase');
export const PROVISIONING: Paragraphs = words('provisioning.intro');
export const REMINDER_INTRO: Paragraphs = words('reminder.intro');
export const REMINDER_ORG_NOTE: Paragraphs = words('reminder.org_note');

/** A single line rather than paragraphs, as it always was. */
export const REMINDER_OPTIONS_NOTE: string = words('reminder.options')[0] ?? '';
