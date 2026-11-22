# Booking contract (Jay → Gee), 2026-11-15. Source: apps/elktours/src/lib/{site-settings,tour-slots,slot-actions}.ts

Import the core helpers (slotState, bookingRuleText, minimumRuleText, closesAt, formatLeft) from `@elkdonis/checkout/booking-core`. This is a re-export of @elkdonis/booking/core, because elktours does not depend on booking directly. It will be swapped to a direct dependency at the next build window.

## site-settings.ts (server module)
```ts
type BelowMinimumRuleSetting = "guide_decides" | "auto_cancel";
interface SiteSettings { belowMinimumRule: BelowMinimumRuleSetting; holdGuidePosts: boolean }
getSiteSettings(): Promise<SiteSettings>
saveSiteSettings(patch: Partial<SiteSettings>): Promise<{ok:true; settings:SiteSettings} | {ok:false; error:string}>  // owner only
```
## tour-slots.ts (server module)
```ts
const WAITLIST_AVAILABLE = false
interface TourBookingDefaults { minToRun: number|null; closeBeforeMinutes: number; waitlistCap: number|null }
type SlotViewState = "open"|"full_waitlist"|"full"|"closed"|"cancelled"
interface SlotGuide { id: string; name: string; short: string }
interface TourSlotView {
  slotId: string; tourId: string; startsAt: string; endsAt: string; guide: SlotGuide|null;
  capacity: number; seatsTaken: number; seatsLeft: number; minToRun: number|null; closesAt: string;
  state: SlotViewState; stateKey: "cancelled"|"past"|"open"|"confirmed"|"below"; label: string;
  tone: "muted"|"ok"|"short"|"confirmed"|"attention"; note: string|null; minimumReached: boolean; shortBy: number;
  waitlistCount: number; waitlistCap: number|null; priceMinor: number|null; currency: string; maxParty: number; ruleText: string }
interface BoardSlot extends TourSlotView {
  tourTitle: string; tourSlug: string; status: "scheduled"|"cancelled"; bookings: number;
  slotNote: string|null; runDecision: "run"|null }
type Quote = {ok:true; slotId:string; tourId:string; partySize:number; perPersonMinor:number; totalMinor:number;
  currency:string; closesAt:string; policyText:string; ruleText:string} | {ok:false; error:string}
interface BoardQuery { from?: Date|string; to?: Date|string; guideUserId?: string; includeCancelled?: boolean }
listTourSlots(tourId, opts?: {from?, to?}): Promise<TourSlotView[]>   // published + PUBLIC tours only
getBookingRule(): Promise<{kind: BelowMinimumRuleSetting}>
quoteBooking({slotId, partySize}): Promise<Quote>
listBoardSlots(opts?: BoardQuery): Promise<BoardSlot[]>
getBoardSlot(slotId): Promise<BoardSlot|null>
boardCounts(opts?: {guideUserId?}): Promise<{belowMinimum:number; withWaitlist:number; nextSlot: BoardSlot|null}>
listDecisions(opts?: {guideUserId?}): Promise<{below: BoardSlot[]; waits: BoardSlot[]; rule: BelowMinimumRuleSetting}>
getTourBookingDefaults(tourId): Promise<TourBookingDefaults|null>
```
## slot-actions.ts ("use server", requireOrgEditor = owner|guide, ActionResult = {ok:true,...}|{ok:false,error})
```ts
interface NewSlotsInput { tourId: string; dates: string[] /*YYYY-MM-DD Paris*/; times: string[] /*HH:MM, max 4*/;
  durationMinutes?: number; minToRun?: number|null; maxPlaces: number; closeBeforeMinutes?: number;
  waitlist?: boolean; waitlistCap?: number|null; priceMinor?: number|null; guideUserId?: string|null }
type SlotProblem = "clash"|"closed"|"exists"|"past"|"over_cap"
interface SlotPreviewItem { day; time; startsAt; endsAt; ok: boolean; reason: SlotProblem|null; message: string|null; clashWith?: {tourTitle; startsAt} }
interface SlotPreview { items: SlotPreviewItem[]; ready: number; notStored: Array<"duration"|"minToRun"|"closeBeforeMinutes"|"waitlist"|"price"> }
interface ManifestRow { bookingId; name: string|null; email; party: number; note: string|null; status: "awaiting_payment"|"confirmed"|"cancelled"; orderNumber: string|null; createdAt }
interface WaitRow { position: number; name: string; party: number }
interface RefundDue { bookingId; orderNumber: string|null; name: string|null; email; totalMinor: number; currency }
interface SlotPatch { startsAt?; capacity?; guideUserId?; note?; minToRun?; closeBeforeMinutes?; priceMinor?; waitlist?; waitlistCap? } // last five refused until cutover
previewSlots(input): ActionResult<{preview: SlotPreview}>
createSlots(input): ActionResult<{created; skipped; notStored; firstDay: string|null}>
getSlot(slotId): ActionResult<{slot: BoardSlot; manifest: ManifestRow[]; waitlist: WaitRow[]; ruleText: string}>
cancelSlot(slotId, reason?): ActionResult<{notified: number; refundsDue: RefundDue[]}>   // no Stripe refund
updateSlot(slotId, patch): ActionResult<{slot: BoardSlot|null}>
saveTourBookingDefaults(tourId, patch: Partial<TourBookingDefaults>): ActionResult<{defaults}>
runSlot / reopenSlot(slotId,{hours}) / closeSlotNow / offerWaitlistPlace  // return {ok:false,error:"Available after the booking cutover."}
```
## Notes for the UI
- Guides already reach the board (EDITOR_ROLES = owner, guide).
- Per-tour defaults (min, cutoff, waitlist cap) live in `threads.metadata.tourBooking`. Put a small "Booking rules" group on the tour form → `saveTourBookingDefaults`.
- Until the cutover: no waitlist (hide Offer, show "Full"); per-slot min/cutoff/price follow the tour (createSlots returns `notStored` so the UI can say so); Run/Reopen/Close-now are disabled with the returned message.
- No minimum set → minimumReached true, note null, ruleText "".
- Pay: call quoteBooking first, then bookTourAction. Jay is adding the cutoff check inside bookTourAction too.


## Changes 2026-11-16 (lib side of REVIEW_G7)

**"None" for a minimum (B2).** At slot level `minToRun` of `null` in the booking package means "inherit the offer's", so None cannot be stored as null. The convention: **a minimum of 1 is None.**
- The UI keeps sending `minToRun: null` for None, in `SlotPatch.minToRun` (`updateSlot`) and `NewSlotsInput.minToRun` (`createSlots`); the action stores 1. Sending 1 does the same. A number above 1 is a real minimum.
- The views return `minToRun: null` for None (a stored 1 reads as null), so the stepper shows "None" for null and the existing code `min > 0 ? min : null` keeps working. `shortBy` is 0, `note` is null, `minimumReached` is true and `ruleText` is "" for a slot with no minimum; such a slot never lands in "Needs your call" and is never auto-cancelled.
- `minimumRuleText` for no minimum: "No minimum: every slot runs, however many book. Holds N."

**Minimum above the places (B3).** `previewSlots` and `createSlots` now return `{ ok:false, error }` with "The minimum to run (N) cannot be more than the places (M). Raise the places or lower the minimum." The UI should keep `maxPlaces >= minToRun` (clamp when a tour is picked: `max = max(max, min)`), so the preview never reaches the error.

**Guides and slots (L1, L2, L4).** Owners act on everything. A guide may read and act (`getSlot`, `updateSlot`, `cancelSlot`, `runSlot`, `reopenSlot`, `closeSlotNow`) only on a slot they lead (`slot.guide.id`) or whose tour they wrote; otherwise `{ ok:false, error:"That slot is not yours." }`. `createSlots`/`previewSlots` for a guide: the tour must be theirs ("That is not your tour.") and `guideUserId` is forced to the guide; `updateSlot` refuses a guide changing the guide ("Only the office can change the guide."); `saveTourBookingDefaults` needs the tour to be theirs for a guide. `getCollaborate(tourId)` returns `[]` for a guide who did not write the tour, so the page should `notFound()` in that case (page work for Gee).

**Invitations (L5).** `listInvitations`: artist, own only; guide, invitations to them plus those on tours they wrote; owner, all.

**Feed review (L3).** `listFeedPostsToConfirm()` returns `[]` for a guide and `reviewFeedPostAction` returns `{ ok:false, error:"Only the office confirms posts." }`. The page should send a guide away from `/manage/feed-review`.

**Artist profile (B1).** `saveArtistProfileAction` no longer blanks craft or about when a field is sent empty (they are kept; a non-empty value replaces). New read in `lib/artist-wizard.ts`:
```ts
getMyArtistProfile(): Promise<{ name: string; email: string; craft: string | null; area: string | null; about: string | null } | null>
```
for prefilling step I (name from `users.display_name`, area from `users.city`, craft from `org_profiles.role_title`, about from `org_profiles.bio_override`).
