# Mounting the content library, the Content card and the Channel card on an app

Written 2026-11-26 by Cornerstone agent C. Art-auction follows this in Step 3. Paths are relative to the app.
Status: the pieces below are written and type-checked in isolation, not yet mounted by any app (unknown: behaviour in a
running app). Search itself (`searchContent`, agent A) and the unified `ContentLibrary` props (agent B) must have landed.

## 0. One-time wiring (needs the PM: installs and a rebuild)

1. `package.json` dependencies: `@elkdonis/content`, `@elkdonis/hub`, `@elkdonis/channel` (the last only for the Channel card),
   all `workspace:*`. **`packages/content` and `packages/channel` also need `"@elkdonis/hub": "workspace:*"`** (the cards
   import `@elkdonis/hub/contract` and `/ui`), then one `pnpm install`. Until then those two packages fail `check-types`
   on their new `hub/` files (TS2307).
2. `next.config.ts` `transpilePackages`: add `@elkdonis/content`, `@elkdonis/hub`, `@elkdonis/channel`, `@elkdonis/cms-ui`.
3. CSS, in the hub page or `globals.css`:
   ```ts
   import "@elkdonis/hub/hub-cards.css";          // + "@elkdonis/hub/industry.css" if you use theme="industry"
   import "@elkdonis/content/content.css";
   import "@elkdonis/content/summary.css";        // Channel card only
   import "@elkdonis/channel/site.css";           // Channel card only
   import "@elkdonis/channel/hub.css";            // Channel card only
   ```

## 1. The host and the routes (Content)

`src/lib/content-host.ts`:
```ts
import type { ContentHost } from "@elkdonis/content/host";   // defaultHost() is there too
export const contentHost: ContentHost = {
  viewer: async () => { const v = await getViewer(); return v ? { userId: v.userId } : null; },  // the SESSION, never a parameter
  site: { orgId: "market", name: "Collect Art", domain: "market.arts-collective.com", timeZone: "America/Toronto", storeOrgIds: ["market"] },
  urls: { piece: (ref) => ref.store === "artwork" ? `/artworks/${ref.id}` : null, studio: () => "/studio", siteHome: () => "/" },
  actions: ["artwork-hide", "artwork-show"],                                    // registry ids the lightbox may offer
  fileSources: async (v) => [{ key: "mine", label: "My files", root: `users/${v.userId}` }],   // optional; Files view
};
```
Route files, three lines each (`export const dynamic = "force-dynamic"` as well):
```ts
// app/api/content/search/route.ts
import { contentRoutes } from "@elkdonis/content/routes"; import { contentHost } from "@/lib/content-host";
export const GET = contentRoutes(contentHost).search;
// app/api/content/folders/route.ts  -> .folders      app/api/content/upload/route.ts -> export const POST = ....upload (501 until Step 5)
```
Optional `resolve` (keys to items, max 50): `app/api/content/resolve/route.ts` is `export const GET = contentRoutes(contentHost).resolve;` (`GET ?keys=thread:<id>,artwork:<id>`; signed-out sees public rows only; `no-store`).

Behaviour: a signed-out request may only ask for `scope=network` (else 401); `folders` answers 404 for a missing or a
not-allowed folder and hides `Private/` unless the source says `showPrivate`; every answer is `Cache-Control: no-store`.

## 2. The hub site, viewer and write door (as sunjay `lib/hub-site.ts`, `app/hub/actions.ts`)

- `src/lib/hub-site.ts`: `export const hubSite: HubSite = { orgId, name, mark, domain, baseUrl, basePath: "", timeZone, features: {} }`
  and `getHubCardViewer(): Promise<HubViewer | null>` (role in this site's org, `isNetworkAdmin` from `users.is_admin`).
- `src/app/hub/actions.ts` (`"use server"`): `runHubAction(id, input)` for the Content card, via `performHubAction(hubSite, actor, id, input, ALLOW, adapter)`.
  `ALLOW` is `contentHost.actions`. A second action, `runChannelAction`, is the Channel door (section 4). Content with an empty `actions`
  list never calls `act`, so a stub that returns `{ ok: false, error: "none" }` is enough on day one.

## 3. The mounts: one client file for every card

`src/components/hub/cards.tsx`:
```tsx
"use client";
import { useRouter } from "next/navigation";
import { HubCardMount, HubCardDetailMount } from "@elkdonis/hub/mount";
import { contentCard, type ContentFaceData } from "@elkdonis/content/hub";
import { channelCard } from "@elkdonis/channel/hub/card";
import type { ChannelHubData } from "@elkdonis/channel/hub";
import { runHubAction, runChannelAction } from "@/app/hub/actions";

function useNav() { const r = useRouter(); return { navigate: r.push, refresh: r.refresh }; }

export function ContentCardMount({ data }: { data: ContentFaceData }) {
  return <HubCardMount card={contentCard} data={data} act={runHubAction} {...useNav()} />;
}
export function ContentDetail({ data, tab }: { data: ContentFaceData; tab: string | null }) {
  return <HubCardDetailMount card={contentCard} data={data} tab={tab} act={runHubAction} {...useNav()} />;
}
export function ChannelCardMount({ data }: { data: ChannelHubData }) {
  return <HubCardMount card={channelCard} data={data} act={runChannelAction} {...useNav()} />;
}
```
`HubCardMount` props: `card`, `data`, `act` (a server action), optional `links` (plain data: `hubBase`, `basePath`,
`studioPath`, `manage`, `loginPath`), `host` (function overrides, such as `puckEditHref`), `navigate`, `refresh`, `icons`,
`theme`, `vars`, `initialView`. No SurfaceProvider is needed. The pop-up is one fixed layer; a page that also runs cms-ui's
`SurfaceProvider` for stacked frames keeps working, and a stacked flow hands off with `navigate` or the library's `onOpen`.

## 4. The Content card, mounted twice (hub page)

`src/app/hub/page.tsx` (server component):
```tsx
import { contentServer } from "@elkdonis/content/hub/server";
const artworksServer = contentServer({ host: contentHost, preset: { id: "artworks", title: "Artworks", scope: { kind: "site" }, types: ["artwork"], groupBy: "store" } });
const libraryServer  = contentServer({ host: contentHost, preset: { id: "library",  title: "Content library" } });
const v = await getHubCardViewer();
const [artworks, library] = v ? await Promise.all([artworksServer.load(hubSite, v), libraryServer.load(hubSite, v)]) : [null, null];
// ...
{artworks && <ContentCardMount data={artworks} />}
{library && <ContentCardMount data={library} />}
```
The face reports `allowed: false` (and loads nothing) when a non-editor opens a `site` lens; `mine` is open to any signed-in viewer.
Preset fields: `{ id?, title?, scope?, types?, view?, groupBy? }`; defaults: scope `site`, view `published`, groupBy `none`.
Detail page `src/app/hub/content/page.tsx`: pick the server by `searchParams.preset` (`artworks` or `library`), call `.loadDetail(hubSite, v, { tab })`,
render `<ContentDetail data tab />`. The pop-up's "Open page" link carries `?preset=<id>`.

## 5. The Channel card (a loader and a door, about 20 lines)

```ts
// src/lib/hub-channel.ts  (the loader: channelHubData(model, links, orgName); this is sunjay's file today)
// src/app/api/hub/channel/route.ts
import { channelHubRoutes } from "@elkdonis/channel/hub/card-server";
export const dynamic = "force-dynamic";
export const { GET } = channelHubRoutes({ viewer: async () => getApiEditor(), load: (v) => loadHubChannel(v) });
// src/lib/hub-channel-server.ts
import { channelServer } from "@elkdonis/channel/hub/card-server";
export const channelCardServer = channelServer((site, v) => loadHubChannel({ userId: v.userId, email: <look up v.userId> }));
```
`runChannelAction` stays the app's own `"use server"` file (session, `performSiteChannelAction`, `SITE_DOOR_ALLOW`), exactly as sunjay's
`lib/channel-door.ts`. The card hands every write to `host.act(id, input)` and calls `host.refresh()` after a write that went, so the
pop-up needs no `/api/hub/channel` fetch; the route is kept for hosts that want to poll. Render `<ChannelCardMount data>` in a grid
cell for owners and guides only. The app also supplies `channel-model.ts`-style `siteChannelLoader` (per-site; art-auction needs an
artwork-centred market loader, which is Step 4's second half).

## Public reuse

Picking someone else's published item (scope `person:<userId>` or `network`) stores its key plus the chosen image URL and
renders attribution. It never copies the item or its image. Signed-out requests may use `network` or `person` only (public
rows; the server predicate enforces it), and a signed-out request with no scope means `network`.

## 6. Not done (for the PM)

- Sunjay still uses its six glue files. The lifted card draws hub-card chrome (`hc-card`, `PopupShell`), not a `SurfaceCard`
  and surface frame, so the tile is not pixel-identical; no render comparison was run, so no Sunjay patch is offered.
- `/api/content/upload` answers 501 until Step 5.
