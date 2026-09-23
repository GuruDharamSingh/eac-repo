# Community Page Architecture + Excalidraw Rough Plan
**Date:** April 28, 2026  
**For:** Next session agent + product owner reference

---

## 1. What the `/community` page IS

`/community` is the **wider lens**. The artist's template at `/` is the close-up — their flyer, their work, their voice. `/community` is the pull-back: the Elkdonis Arts Collective as a living network, cross-org activity, what's happening regionally, motivation to join and participate. The artist is the entry point; the collective is the destination.

It should feel like a rich arts hub:
- RSS feeds from regional arts orgs and institutions
- Weather/location context (what's happening in the world, in the city)
- Cross-org community feed (what artists across the network are posting)
- A quick entry box at the bottom — write a thought, leave something
- Visually: HTML block aesthetic (GrapesJS-style), newspaper grid, 2010s density
- Technically: React where needed for live data, but the block/embed philosophy holds

Excalidraw: **deferred** — rough containerization plan is in §4, not a current priority.

---

## 2. Architecture decision: extend the embed system

The existing `<eac-embed data-eac-component="x">` slot system is the right foundation. It already handles server-side React component injection into any HTML string. The answer is NOT to fight GrapesJS/React — it's to add new embed types that the community page and future Silex pages can both use.

**New embed types to add to `silex-embeds.tsx`:**

```html
<!-- RSS feed from external source -->
<eac-embed data-eac-component="rss-feed"
           data-source="https://arts.council.ca/feed"
           data-limit="5"
           data-title="Regional arts news">

<!-- Weather for visitor's region (IP-based) -->
<eac-embed data-eac-component="weather"
           data-city="auto"
           data-units="metric">

<!-- Quick note entry (client-interactive island) -->
<eac-embed data-eac-component="quick-note"
           data-placeholder="Leave a thought..."
           data-org="acme">

<!-- Excalidraw drawing island -->
<eac-embed data-eac-component="excalidraw"
           data-thread-id="..."
           data-mode="draw">
```

All of these render via the existing `renderSilexHtmlWithEmbeds()` → `renderEmbed()` pipeline. Silex authors can drop them into any page using blocks from the GrapesJS block panel (registered in `client-config.js`). The community page HTML uses them inline.

**Why this is the right move:**
- No new framework/paradigm
- Embed types are automatically available to Silex page authors, not just the community page
- Client-interactive embeds (notes, drawing) can use React's `use client` with hydration targeting the embed slot
- The HTML skeleton stays exportable/standalone

---

## 3. New embed implementations

### 3.1 RSS Feed embed

**Package:** `rss-parser` (npm, Node-only, handles RSS 2.0 + Atom + custom namespaces)  
**Caching:** `unstable_cache` wrapping `parser.parseURL(url)` — NOT native `fetch`, so must be explicitly cached

```typescript
// silex-embeds.tsx addition
import Parser from 'rss-parser';
import { unstable_cache } from 'next/cache';

const parser = new Parser();
const getCachedFeed = unstable_cache(
  (url: string) => parser.parseURL(url),
  ['rss-feed'],
  { revalidate: 3600, tags: ['rss'] }
);
```

Display: article list with headline, source, date, excerpt. Newspaper style.

**Suggested default feeds for arts community:**
- Local arts council RSS (configurable per org via `data-source`)
- `data-source="community"` → aggregate from a curated list stored in the DB (a new `community_feeds` table or just env config)

### 3.2 Weather embed

**API:** Open-Meteo — `https://api.open-meteo.com/v1/forecast?latitude=X&longitude=Y&current_weather=true`  
- Completely free, no API key, no registration
- Uses native `fetch` → Next.js caches it automatically: `fetch(url, { next: { revalidate: 1800 } })`
- Returns temp, windspeed, weather code, is_day

**Visitor geolocation:** IP-based server-side using request headers
- `request.headers.get('x-forwarded-for')` → IP
- Call `http://ip-api.com/json/{ip}` server-side (HTTP only on free tier, never from browser)
- Returns lat/lng, city, timezone
- Rate limit: 45 req/min — cache per IP for 30 minutes in Redis

**For "weather for the world":** Show multiple cities in a horizontal ticker or small card grid. The org can configure a list of cities in their org settings (future: `org_settings.weather_cities` JSONB). For now: hardcode a set of global art capitals (Paris, Lagos, Buenos Aires, Tokyo, Toronto, London, Mumbai).

### 3.3 Traffic embed

**Reality check:** No free keyless production traffic API exists. Two practical approaches:

**Option A — OpenStreetMap tiles (no key, client-side):**
- Embed a `<eac-embed data-eac-component="map">` that renders a Leaflet map client-side
- OSM tile layer: `https://tile.openstreetmap.org/{z}/{x}/{y}.png`
- Shows the region, no live traffic data but gives geographic context
- User's browser geolocation API (with permission) centers the map

**Option B — Static traffic note (no external API):**
- Skip live traffic entirely for now
- Display a "getting here" section with the org's address from `workshop_pages.location_address`
- Link to Google Maps / Apple Maps / OpenStreetMap for directions
- Add a Leaflet map tile embed

**Recommendation:** Option A for the community page, labeled "Region" not "Traffic." Real traffic data is a TomTom/HERE key away but adds cost. Defer until there's a use case.

### 3.4 Quick note / entry box

A big textarea at the bottom of the community page. No login required. Submits via a server action.

**Storage:** Extend the existing `guest_submissions` table (already exists from amrit-canada migration 021):
```sql
-- guest_submissions already has: id, thread_id, kind, name, email, message, metadata
-- For community notes: kind = 'community_note', thread_id = NULL or org-scoped
```
Or add a dedicated `community_notes` table:
```sql
CREATE TABLE community_notes (
  id        VARCHAR(21) PRIMARY KEY,
  org_id    VARCHAR(50) REFERENCES organizations(id) ON DELETE CASCADE,
  author_ip TEXT,
  content   TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

The entry box is a React `use client` component (needs form state + submission feedback) hydrated inside its embed slot. The embed slot approach still works — render a server component wrapper that contains the client island.

**Future:** Connect this to Excalidraw as an alternative input mode (draw instead of write).

---

## 4. Excalidraw — rough container plan (deferred, not current priority)

**What exists today:**
- `@excalidraw/excalidraw` React component in `packages/ui/src/components/excalidraw-editor.tsx`
- Used only in inner-gathering at `/meetings/[id]/drawing`
- Drawings stored as JSONB in `event_pages.drawing` (migration 017)
- Not linked to `threads` — only to the old `event_pages` table

**The target (when ready):**
Excalidraw containerized like Silex — token bridge, accessible from any thread, drawings stored in `threads.drawing` JSONB.

```
Docker stack:
  kiliandeca/excalidraw         → port 6807 (SPA client)
  kiliandeca/excalidraw-storage-backend → REST storage, backed by existing Redis
  excalidraw/excalidraw-room    → port 6808 (WebSocket collab)

Token bridge (same pattern as Silex):
  POST /api/excalidraw/token  →  GET /api/excalidraw/auth  →  POST /api/excalidraw/save

DB: ALTER TABLE threads ADD COLUMN IF NOT EXISTS drawing JSONB DEFAULT NULL;

iframe embed: set frame-ancestors in excalidraw nginx CSP
```

The `ExcalidrawEditor` React component already works well for embedded use. The container is only needed when drawings need to be authored standalone (not inline in a page) or shared across orgs. Build it when that use case arrives.

---

## 5. Community page rebuild plan

The community page HTML currently uses `<eac-embed>` slots for workshops, feed, countdown, and community-feed. The rebuild adds:

```html
<!-- New sections to add to buildCommunityHtml() -->

<!-- Top ticker: RSS headlines -->
<eac-embed data-eac-component="rss-feed" data-source="regional" data-limit="3" data-variant="ticker">

<!-- Weather strip -->  
<eac-embed data-eac-component="weather" data-city="auto">

<!-- Main: existing workshop-cards + org-feed (keep) -->

<!-- Sidebar: map / region -->
<eac-embed data-eac-component="map" data-variant="region">

<!-- Bottom: big entry box -->
<eac-embed data-eac-component="quick-note" data-org="[orgSlug]">
```

Visual sections become "blocks" in newspaper terminology:
- **Ticker** — top horizontal RSS scroll (CSS `overflow: hidden + marquee` or JS rotation)
- **Above the fold** — weather + featured workshop (existing)
- **Below fold** — main (workshops, updates) + sidebar (about, live room, network feed)
- **Footer zone** — map, quick note entry, region info
- **Very bottom** — Excalidraw canvas invite (when enabled per org)

---

## 6. GrapesJS block registration for new embed types

Each new embed type should be registered in `packages/silex-nextcloud-connector/src/client-config.js` as a draggable block so Silex authors can use them on their pages:

```javascript
// in client-config.js liveSlotBlocks array:
{ id: "eac-slot-rss", label: "RSS Feed", 
  content: slot("rss-feed", { "data-source": "", "data-limit": "5", "data-title": "News" }) },
{ id: "eac-slot-weather", label: "Weather", 
  content: slot("weather", { "data-city": "auto" }) },
{ id: "eac-slot-map", label: "Region Map", 
  content: slot("map", { "data-variant": "region" }) },
{ id: "eac-slot-quick-note", label: "Quick Note", 
  content: slot("quick-note", { "data-placeholder": "Leave a thought..." }) },
```

This makes them available to ALL Silex page authors, not just the community page.

---

## 7. Implementation order

**Phase 1 — New embed types (no new containers, 1 session)**
1. `pnpm add rss-parser` in arts-collective
2. Add `RssFeedEmbed` to `silex-embeds.tsx` — `data-source` attr accepts a URL or `"regional"` (curated list)
3. Add `WeatherEmbed` — calls `GET /api/geo` (new) then Open-Meteo
4. Add `QuickNoteEmbed` — client island, server action → `community_notes` table (new migration)
5. Add `MapEmbed` — Leaflet client island, OSM tiles, centered on visitor's city
6. Register all four as blocks in `client-config.js` (available to Silex authors too)
7. Update `buildCommunityHtml()` to include the new sections

**Phase 2 — Geo endpoint + weather**
1. `GET /api/geo` — reads `x-forwarded-for`, calls ip-api.com server-side, caches in Redis per IP for 30 min
2. Wire `WeatherEmbed` → `/api/geo` → Open-Meteo

**Phase 3 — Excalidraw container (deferred)**
See §4 above. Not until there's a clear use case for standalone drawing sessions.

---

## 8. What already exists to reuse

| Need | Already exists | Location |
|---|---|---|
| Excalidraw React component | `ExcalidrawEditor` | `packages/ui/src/components/excalidraw-editor.tsx` |
| Drawing autosave pattern | `DrawingPage` | `apps/inner-gathering/src/components/drawing-page.tsx` |
| Drawing DB column | migration 017 | `event_pages.drawing` (needs to move to `threads.drawing`) |
| Token bridge pattern | Silex token | `apps/arts-collective/src/app/api/silex/token/route.ts` |
| SSO bridge pattern | Talk join | `apps/arts-collective/src/app/api/talk/join/route.ts` |
| Redis cache | already in stack | `@elkdonis/redis` package |
| Guest submissions | table + API | `amrit-canada`, migration 021 |
| IP-based geo | not built | — |
| RSS parsing | not built | — |
| Weather | not built | — |
| Map tiles | not built | — |

---

## 9. One-pager on the GrapesJS ↔ React question

The research confirmed: GrapesJS's own roadmap moves toward Web Components, not React. The eac-embed slot pattern we already use IS the web-component pattern — `<eac-embed>` is a custom element slot; the platform replaces it at runtime.

**No fighting needed.** The correct mental model:
- GrapesJS owns the **canvas** (editing experience, HTML/CSS output)
- React Server Components own the **data** (what fills the canvas at runtime)
- React Client Components handle **interactivity** (forms, live updates, drawing)
- The embed slot system bridges them without DOM conflicts

For the community page specifically: the HTML skeleton is the "GrapesJS aesthetic" — same block visual language, same CSS tokens. React fills the slots. Client islands hydrate specific regions. The user never sees the seam.

The GrapesJS `grapesjs-react` package (`@grapesjs/react`) is for building a custom editor UI, not for rendering — not relevant here. The `grapesjs-studio-sdk` `custom-renderer` plugin would let GrapesJS canvas preview React components live during editing, which is a future enhancement for the Silex integration but not needed for the community page.
