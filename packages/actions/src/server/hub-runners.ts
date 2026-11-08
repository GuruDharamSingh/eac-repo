// Runners for the hub card entries (../hub.ts). Each one is a thin call into
// @elkdonis/services, where the guard lives (one place, as the architect asked):
// owners change people; guides welcome as viewer. performAction has already
// refused a non-app door (appOnly) and an org other than the site's.
import { z } from 'zod/v4';
import type { ActionResult } from '../types';
import type { ActorContext, Runner } from './run';

const runner = <I>(r: Runner<I>): Runner<unknown> => r as Runner<unknown>;

const USER_ID = z.string().trim().uuid();
const ARRIVAL_ID = z.string().trim().uuid();
const ROLE = z.enum(['viewer', 'member', 'guide']);

const fromPeople = (r: { ok: boolean; error?: string }): ActionResult =>
  r.ok ? { ok: true } : { ok: false, error: r.error ?? 'That could not be changed.', code: 'forbidden' };

function needOrg(ctx: ActorContext): string {
  if (!ctx.orgId) throw new Error('hub runner without an org');
  return ctx.orgId;
}

export const HUB_RUNNERS: Record<string, Runner<unknown>> = {
  'org-person-role': runner({
    input: z.object({ userId: USER_ID, role: ROLE }),
    failure: 'Could not change the role. Try again.',
    async run(ctx, input) {
      const { setOrgPersonRole } = await import('@elkdonis/services');
      return fromPeople(await setOrgPersonRole(needOrg(ctx), input.userId, ctx.userId, input.role));
    },
  }),
  'org-person-listed': runner({
    input: z.object({ userId: USER_ID, listed: z.boolean() }),
    failure: 'Could not change the listing. Try again.',
    async run(ctx, input) {
      const { setOrgPersonListed } = await import('@elkdonis/services');
      return fromPeople(await setOrgPersonListed(needOrg(ctx), input.userId, ctx.userId, input.listed));
    },
  }),
  'org-person-remove': runner({
    input: z.object({ userId: USER_ID }),
    failure: 'Could not remove them. Try again.',
    async run(ctx, input) {
      const { removeOrgPerson } = await import('@elkdonis/services');
      return fromPeople(await removeOrgPerson(needOrg(ctx), input.userId, ctx.userId));
    },
  }),
  'org-arrival-welcome': runner({
    input: z.object({ arrivalId: ARRIVAL_ID, role: ROLE }),
    failure: 'Could not welcome them. Try again.',
    async run(ctx, input) {
      const { welcomeOrgArrival } = await import('@elkdonis/services');
      return fromPeople(await welcomeOrgArrival(needOrg(ctx), input.arrivalId, ctx.userId, input.role));
    },
  }),
  'org-arrival-dismiss': runner({
    input: z.object({ arrivalId: ARRIVAL_ID }),
    failure: 'Could not dismiss them. Try again.',
    async run(ctx, input) {
      const { dismissOrgArrival } = await import('@elkdonis/services');
      return fromPeople(await dismissOrgArrival(needOrg(ctx), input.arrivalId, ctx.userId));
    },
  }),
};
