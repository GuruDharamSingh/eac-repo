# Actions registry: entries proposed by hidden-enneagram round 4 (2026-11-07)

`packages/actions/src/catalogue.ts` and `present.ts` carry another session's uncommitted edits, so nothing
was changed there. These are ready to paste once that session commits. Format copied from the file as it
stood at 18:09 (`d(id, label, describe, scope, area, runnable, derived)`, `params` with `options`).

## 1. `org-publish`: add `service` to the kind param

In `ACTION_CATALOGUE`, the `org-publish` entry's `params[0].options` gains one option, and `describe`
names it:

```ts
  {
    ...d('org-publish', 'Publish on the org site', 'One published piece of a chosen kind on the organisation’s site: a post, an event, a meeting or a service.', 'org', 'content', true),
    performs: 'Saves a draft post (title and plain text) on the organisation’s site. Publishing, events, meetings and services stay with the composer.',
    params: [{
      name: 'kind',
      label: 'Which kind',
      default: 'article',
      options: [
        // `article` is the compose option id; the picker calls it Post (threads.kind 'post').
        { value: 'article', label: 'A post' },
        { value: 'event', label: 'An event' },
        { value: 'meeting', label: 'A meeting' },
        // A bookable offering (threads.kind 'service' + workshop_pages), via upsertServiceOffering;
        // the author is the person acting, who is the payee.
        { value: 'service', label: 'A service' },
      ],
    }],
  },
```

`present.ts`, `KIND_LABEL` gains `service: 'Offer a service'`. The `org-publish` case needs no other
change for hosts that open compose (compose's catalogue already has a service kind behind `hasServices`).
The runner should keep refusing `service` (it saves draft posts only), the way it refuses `event`/`meeting`.

## 2. A Studio-popup presentation for org sites that mount the Studio

Org sites cannot frame the network's `/studio` (cross-origin), and on the org sites `/studio` is the page
editor. Hidden-enneagram mounts the Studio at `/publish` and opens it as the custom surface
`studio:compose`. Proposed: a host-supplied studio path, so `presentAction` can frame it.

`PresentInput` gains an optional field:

```ts
  /** Where this host mounts the authoring Studio, when it does (hidden-enneagram: '/publish'). */
  studioPath?: string | null;
```

and the `studio` and `org-publish` cases use it when present:

```ts
    case 'studio':
      return { kind: 'frame', label: status.partial ? 'Back to the Studio' : 'Open the Studio', src: studioPath ?? '/studio', title: 'Studio', hint: 'Write, then press Publish. Close the Studio to come back here.' };
```

```ts
    case 'org-publish': {
      if (!orgId) return { kind: 'none', hint: 'Start an organisation first.' };
      const { kind } = actionParams('org-publish', params);
      // A host with its own Studio mount frames it on that kind (service and article; event/meeting stay on compose).
      if (studioPath && (kind === 'service' || kind === 'article')) {
        const q = kind === 'service' ? '?kind=service' : '';
        return { kind: 'frame', label: status.done ? 'Publish another' : KIND_LABEL[kind] ?? 'Publish something', src: `${studioPath}${q}`, title: 'Studio', hint: 'Publish closes the Studio and brings you back here.' };
      }
      return {
        kind: 'surface', label: status.done ? 'Publish another' : KIND_LABEL[kind] ?? 'Publish something', descriptor: { type: 'compose', kind, tier: 'full' },
        ...(status.href ? { fallback: { label: 'Open your console', href: status.href } } : {}),
      };
    }
```

The frame contract on hidden-enneagram: `/publish?kind=writing|service&id=&feed=`; inside the frame it posts
`{ source: 'he-studio', type: 'published' | 'saved' | 'close', … }` to its own origin
(`apps/hidden-enneagram/src/components/publish/bridge.ts`). A host frame dialog can close on `published`.

## 3. Optional: a person-scope entry for a first service

Only if the catalogue wants a per-person step (it has `service` today, presented as the profile journey):

```ts
  d('org-service', 'A published service', 'One bookable service on the organisation’s site: a reading, a session or a class, with a price.', 'org', 'content'),
```

Derived (`derived = true`) from `threads` where `org_id` = the org, `kind = 'service'`, `status = 'published'`.
