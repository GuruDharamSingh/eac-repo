// ============================================================================
// How a host shows an entry: open a surface in place, follow a link, press a
// button that performs it (`runAction`), or nothing to press. Client-safe:
// the surface descriptor is a type import only.
//
// Labels and hints moved unchanged from
// apps/arts-collective/src/components/learn/TaskBox.tsx (2026-11-06).
// ============================================================================
import type { SurfaceDescriptor } from '@elkdonis/cms-ui/surface';
import type { ActionLinks, ActionStatus } from './types';
import { actionParams } from './catalogue';

/** One field of a `form` presentation. Values go to `runAction(id, values)`; the server's zod schema decides. */
export interface PresentField {
  name: string;
  label: string;
  type: 'text' | 'email';
  maxLength?: number;
  placeholder?: string;
}

export type Presentation =
  /**
   * Open a host surface in place. `fallback` is where to go when the host
   * cannot open this descriptor (no compose wired for that org, say).
   */
  | { kind: 'surface'; label: string; descriptor: SurfaceDescriptor; hint?: string; note?: string; fallback?: { label: string; href: string } }
  | { kind: 'link'; label: string; href: string; external?: boolean; hint?: string; note?: string }
  /** A button that performs the entry through the host's `runAction(id)`. Hidden once done. */
  | { kind: 'run'; label: string; busyLabel: string; hint?: string; note?: string }
  /** A small form in the step itself, saved through `runAction(id, values)`. Prefilled from `status.values`. */
  | { kind: 'form'; label: string; busyLabel: string; fields: PresentField[]; hint?: string; note?: string }
  /** A page of this host, framed in a dialog over the step (same origin). Closing it re-reads the step. */
  | { kind: 'frame'; label: string; src: string; title: string; hint?: string; note?: string }
  /** A page elsewhere that cannot be framed, in a small window. Its closing re-reads the step. */
  | { kind: 'popup'; label: string; href: string; hint?: string; note?: string }
  | { kind: 'none'; hint: string; note?: string };

export interface PresentInput {
  id: string;
  status: ActionStatus;
  /** The organisation an `org` entry acts on, when the host resolved one. */
  orgId: string | null;
  links: Pick<ActionLinks, 'artdirect' | 'nextcloud'>;
  /** The step's choices (`settings.task.params`). */
  params?: Record<string, unknown> | null;
}

const KIND_LABEL: Record<string, string> = { article: 'Write a post', event: 'Add an event', meeting: 'Add a meeting' };

const host = (origin: string) => origin.replace(/^https?:\/\//, '').replace(/\/$/, '');

export function presentAction({ id, status, orgId, links, params }: PresentInput): Presentation {
  switch (id) {
    case 'profile':
      return { kind: 'surface', label: status.partial ? 'Finish your profile' : 'Fill in your profile', descriptor: { type: 'profile', mode: 'edit' } };
    case 'gain-space':
      return { kind: 'run', label: 'Take my space', busyLabel: 'Setting up…' };
    case 'listing': {
      const note = links.artdirect ? `Your page lives at ${host(links.artdirect)}/<your address>.` : undefined;
      return status.partial
        ? { kind: 'surface', label: 'Open “Where you show”', descriptor: { type: 'profile', tab: 'show' }, hint: 'Switch on the network directory.', note }
        : { kind: 'surface', label: 'Choose your page address', descriptor: { type: 'profile', tab: 'details' }, hint: 'Your address is under Details.', note };
    }
    case 'studio':
      return { kind: 'frame', label: status.partial ? 'Back to the Studio' : 'Open the Studio', src: '/studio', title: 'Studio', hint: 'Write, then press Publish. Close the Studio to come back here.' };
    case 'show-on':
      return { kind: 'surface', label: 'Choose where it shows', descriptor: { type: 'profile', tab: 'show' }, hint: '“Show on” lists each piece on the sites you belong to.' };
    case 'cloud':
      return links.nextcloud
        ? { kind: 'popup', label: 'Open the cloud', href: `${links.nextcloud.replace(/\/$/, '')}/login`, hint: 'Press “Sign in with Elkdonis” in the window that opens, once. Your folders appear within about ten minutes.' }
        : { kind: 'none', hint: 'The cloud sign-in is not configured on this site.' };
    case 'service':
      return { kind: 'surface', label: status.partial ? 'Publish your service' : 'Offer a service', descriptor: { type: 'journey', id: 'profile' }, hint: 'Under “Offer & get paid”.' };
    case 'store':
      return { kind: 'surface', label: status.partial ? 'See your store' : 'Open a store', descriptor: { type: 'journey', id: 'auction' }, hint: 'Step 2 of “Sell your art”.' };
    case 'artwork':
      return { kind: 'surface', label: status.partial ? 'Finish and publish' : 'Add a work', descriptor: { type: 'artwork' } };
    case 'payouts':
      return { kind: 'surface', label: status.partial ? 'Finish with Stripe' : 'Set up payouts', descriptor: { type: 'journey', id: 'auction' }, hint: 'Step 3 of “Sell your art”. Stripe brings you back here.' };
    case 'org':
      return { kind: 'surface', label: 'Start an organisation', descriptor: { type: 'journey', id: 'site' } };
    case 'org-details':
      return orgId ? { kind: 'surface', label: 'Fill in the details', descriptor: { type: 'journey', id: 'org', orgId } } : { kind: 'none', hint: 'Start an organisation first.' };
    case 'org-people':
      return orgId ? { kind: 'surface', label: 'Who is in it', descriptor: { type: 'journey', id: 'org', orgId }, hint: 'The People tab.' } : { kind: 'none', hint: 'Start an organisation first.' };
    case 'org-offering':
      return orgId
        ? {
            kind: 'surface', label: status.done ? 'Publish something else' : 'Publish something', descriptor: { type: 'compose' },
            hint: 'A post, an event or a meeting. To choose what leads the site, pin it from your console; to design the page, Settings → Site & address.',
            ...(status.href ? { fallback: { label: 'Open your console', href: status.href } } : {}),
          }
        : { kind: 'none', hint: 'Start an organisation first.' };
    case 'org-email':
      return orgId
        ? {
            kind: 'form', label: 'Save', busyLabel: 'Saving…',
            fields: [
              { name: 'fromName', label: 'Sending name', type: 'text', maxLength: 100, placeholder: 'The name people see in their inbox' },
              { name: 'replyTo', label: 'Reply-to address', type: 'email', maxLength: 200, placeholder: 'Where replies should go' },
            ],
            ...(status.href ? { note: 'Colours, letters and the address book are in the email suite.' } : {}),
          }
        : { kind: 'none', hint: 'Start an organisation first.' };
    case 'org-publish': {
      if (!orgId) return { kind: 'none', hint: 'Start an organisation first.' };
      const { kind } = actionParams('org-publish', params);
      return {
        kind: 'surface', label: status.done ? 'Publish another' : KIND_LABEL[kind] ?? 'Publish something', descriptor: { type: 'compose', kind, tier: 'full' },
        ...(status.href ? { fallback: { label: 'Open your console', href: status.href } } : {}),
      };
    }
    case 'org-site':
      return status.href && status.done ? { kind: 'link', label: 'Open your site', href: status.href, external: true } : { kind: 'none', hint: 'Nothing to press: the collective confirms the address and adds it to the edge.' };
    // Post entries act on one named post; a course step cannot name one yet (COURSE_ACTIONS
    // leaves them out). A host that shows a post offers them beside it.
    case 'thread-edit':
    case 'thread-publish':
    case 'thread-pin':
      return { kind: 'none', hint: 'This acts on one post; it is offered beside the post itself.' };
    // Channel (2026-11-07): the next moves live on the channel's own pages; the other
    // channel entries act on one piece, slot or step and are offered beside it there.
    case 'channel-next':
      return { kind: 'link', label: status.done ? 'Open Channel' : 'See what is next', href: status.href ?? '/channel', hint: status.done ? undefined : status.detail ?? undefined };
    case 'channel-suggestion-accept':
    case 'channel-suggestion-dismiss':
    case 'channel-slot-fill':
    case 'channel-plan-step':
      return { kind: 'none', hint: 'This acts on one piece, slot or step; Channel offers it beside them.' };
    // The Akhand Path's day steps: the day page on elkdonis-arts.org, which the check names.
    case 'paath-read':
    case 'paath-record':
    case 'paath-note':
    case 'paath-publish': {
      const label = { 'paath-read': 'Open the day’s reading', 'paath-record': 'Record on the day page', 'paath-note': 'Write the note', 'paath-publish': status.done ? 'See the uploads' : 'Approve the recording' }[id];
      return status.href ? { kind: 'link', label, href: status.href, external: true } : { kind: 'none', hint: status.detail ?? 'Open the Akhand Path.' };
    }
    default:
      return { kind: 'none', hint: 'This step is not known to this site yet.' };
  }
}
