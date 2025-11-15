# Nextcloud Iframe Integration - Rollback Decision

**Date:** October 27, 2024
**Status:** ✅ Rolled Back to Hybrid Approach

---

## Summary

After implementing iframe-based Nextcloud integration (documented in `NEXTCLOUD_IFRAME_INTEGRATION.md`), we discovered that iframes were **too finicky** for production use and have rolled back to the **hybrid approach** (custom UI + Nextcloud API backend).

---

## Timeline

### October 26, 2024
- **Analysis Phase:** `NEXTCLOUD_INTEGRATION_ANALYSIS.md` created
  - Recommended "Architecture B: Hybrid" approach
  - Explicitly rejected iframe approach as "❌ Too limiting for custom UX"

- **Implementation Phase:** Despite analysis, iframe approach was implemented
  - Created `PollsEmbed`, `CalendarEmbed` components
  - Updated polls and calendar pages to use iframes
  - Documented in `NEXTCLOUD_IFRAME_INTEGRATION.md`

### October 27, 2024
- **Rollback Phase:** Returned to hybrid approach
  - Restored poll pages to use custom components
  - Created calendar placeholder page
  - Deprecated iframe components

---

## Why Iframes Failed

### Problems Encountered

1. **Cross-Origin Issues**
   - Nextcloud security headers (X-Frame-Options, CSP)
   - PostMessage communication complexity
   - Cookie/session sharing difficulties

2. **Limited Customization**
   - Cannot match EAC design system
   - Nextcloud branding visible
   - Cannot deeply customize workflows
   - Responsive design issues on mobile

3. **Authentication Friction**
   - Users need to be logged into Nextcloud separately
   - Session management complexity
   - Cannot easily provision/auto-login users

4. **Maintenance Burden**
   - Nextcloud UI changes break embeds
   - Need to configure CSRF exceptions
   - Sandbox attribute conflicts

5. **User Experience**
   - Iframe loading states jarring
   - Different UI patterns confusing
   - Scrolling and navigation issues

---

## Hybrid Approach (Current Implementation)

### Architecture

```
┌──────────────────────────────────────────┐
│  EAC Inner-Gathering App (Next.js)       │
│                                          │
│  ┌────────────────────────────────────┐ │
│  │  Custom UI Components              │ │
│  │  - PollsList                       │ │
│  │  - PollCreator                     │ │
│  │  - PollVoting                      │ │
│  │  - (Future: Calendar components)   │ │
│  └──────────────┬─────────────────────┘ │
│                 │                        │
│  ┌──────────────▼─────────────────────┐ │
│  │  API Routes                        │ │
│  │  - GET /api/polls                  │ │
│  │  - POST /api/polls                 │ │
│  │  - GET /api/polls/[id]            │ │
│  │  - POST /api/polls/[id]/vote      │ │
│  └──────────────┬─────────────────────┘ │
└─────────────────┼───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│  @elkdonis/nextcloud Package            │
│  - polls.ts (API wrapper)               │
│  - calendar.ts (CalDAV wrapper)         │
│  - files.ts (WebDAV wrapper)            │
│  - talk.ts (Talk API wrapper)           │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│  Nextcloud Instance                     │
│  - Polls App API                        │
│  - Calendar (CalDAV)                    │
│  - Files (WebDAV)                       │
│  - Talk API                             │
└─────────────────────────────────────────┘
```

### Benefits

✅ **Full UI Control** - Match EAC design system perfectly
✅ **Better UX** - Smooth, integrated experience
✅ **Flexible** - Add EAC-specific features easily
✅ **Maintainable** - No iframe/CSP configuration
✅ **Mobile-Friendly** - Responsive custom UI
✅ **Authentication** - Seamless session handling

---

## Current Status

### Polls (Hybrid Implementation Complete) ✅

**Pages:**
- `/polls` - Uses `PollsList` component
- `/polls/new` - Uses `PollCreator` component
- `/polls/[id]` - Uses `PollVoting` component

**API Routes:**
- `GET /api/polls` - List user's polls
- `POST /api/polls` - Create availability poll
- `GET /api/polls/[id]` - Get poll details + options
- `GET /api/polls/[id]/vote` - Get vote results
- `POST /api/polls/[id]/vote` - Submit votes

**Components:**
- `apps/inner-gathering/src/components/polls-list.tsx`
- `apps/inner-gathering/src/components/poll-creator.tsx`
- `apps/inner-gathering/src/components/poll-voting.tsx`

### Calendar (Placeholder - Implementation Pending) 🚧

**Current State:**
- `/calendar` - Shows "Coming Soon" placeholder
- Links to `/meetings` for current functionality
- Links to Nextcloud Calendar for advanced features

**Planned Implementation:**
Per `NEXTCLOUD_INTEGRATION_ANALYSIS.md`:
1. Add calendar API wrapper (`packages/nextcloud/src/calendar.ts`)
2. Update meetings schema with calendar sync columns
3. Create calendar sync service
4. Build custom calendar UI components
5. Implement bidirectional sync

---

## Iframe Components Status

**Location:** `packages/nextcloud/src/components/`

**Status:** Deprecated but kept for reference

- `NextcloudEmbed.tsx` - Generic iframe wrapper
- `PollsEmbed.tsx` - Polls iframe embed
- `CalendarEmbed.tsx` - Calendar iframe embed
- `TalkEmbed.tsx` - May still be useful for video

**Note:** These components are still exported from `@elkdonis/nextcloud/client` but are marked as experimental and not recommended.

---

## Files Modified in Rollback

### Pages Updated
1. `apps/inner-gathering/src/app/polls/page.tsx`
   - **Before:** Used `<PollsEmbed>` iframe
   - **After:** Uses `<PollsList>` custom component

2. `apps/inner-gathering/src/app/polls/[id]/page.tsx`
   - **Before:** Used `<PollEmbed>` iframe
   - **After:** Uses `<PollVoting>` custom component

3. `apps/inner-gathering/src/app/calendar/page.tsx`
   - **Before:** Used `<CalendarEmbed>` with tabs
   - **After:** "Coming Soon" placeholder with links

### Package Updated
4. `packages/nextcloud/src/components/index.ts`
   - Added deprecation notice for iframe components
   - Documented recommended hybrid approach

---

## Lessons Learned

### What Worked
- ✅ Custom UI components with shadcn/ui
- ✅ Nextcloud API wrappers in `@elkdonis/nextcloud`
- ✅ Separation of concerns (UI vs API)
- ✅ API-first design

### What Didn't Work
- ❌ Iframe embedding of Nextcloud apps
- ❌ Relying on Nextcloud UI for core features
- ❌ Cross-origin iframe communication
- ❌ Mixing EAC UI with embedded Nextcloud UI

### Key Insight
**"Don't reinvent the wheel" doesn't mean "embed the wheel"**

The right approach is:
- Use Nextcloud's **backend** (API, storage, logic)
- Build our own **frontend** (UI, UX, workflows)
- This gives us both reliability AND control

---

## Next Steps

### Immediate (Week 1-2)
1. ✅ Test restored polls functionality
2. ✅ Verify API routes still work correctly
3. ✅ Update any documentation references

### Short-Term (Month 1)
4. Implement calendar sync service
5. Add calendar columns to meetings table
6. Create calendar API wrapper
7. Build basic calendar UI components

### Medium-Term (Month 2-3)
8. Implement bidirectional calendar sync
9. Add calendar event creation from meetings
10. Build advanced calendar features
11. Add mobile calendar app integration

---

## References

- `NEXTCLOUD_INTEGRATION_ANALYSIS.md` - Original analysis recommending hybrid approach
- `NEXTCLOUD_IFRAME_INTEGRATION.md` - Iframe implementation attempt (now deprecated)
- Architecture decision: Hybrid approach is superior for our use case

---

**Prepared by:** Development Team
**Date:** October 27, 2024
**Status:** Rollback Complete ✅
