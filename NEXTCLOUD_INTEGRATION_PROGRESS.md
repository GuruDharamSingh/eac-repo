# Nextcloud Integration Implementation Progress

**Date:** November 2, 2025
**Status:** Phase 1 & 2 Complete - Core Infrastructure Ready

---

## ✅ Completed Work

### Phase 1: Foundation & Database Setup

#### 1.1 Database Migrations

**Migration 004 - Availability Polls** ✅
- Created PostgreSQL tables for hybrid polling system
- Tables: `availability_polls`, `availability_responses`, `availability_slots`
- Supports timezone-aware scheduling polls
- Includes triggers for automatic count updates
- **Location:** `packages/db/migrations/004_availability_polls.sql`

**Migration 005 - Nextcloud Calendar** ✅ (Already existed)
- Verified columns: `nextcloud_calendar_event_id`, `nextcloud_calendar_synced`, `nextcloud_talk_token`
- Supports bidirectional calendar sync
- **Location:** `packages/db/migrations/005_nextcloud_enhancements.sql`

**Migration 007 - OIDC SSO** ✅
- Added columns for SAML/OIDC integration
- Fields: `oidc_subject`, `oidc_issuer`, `nextcloud_oidc_synced`, `nextcloud_app_password`
- Enables seamless Single Sign-On between Supabase and Nextcloud
- **Location:** `packages/db/migrations/007_oidc_sso.sql`

### Phase 2: CalDAV Calendar Integration

#### 2.1 Calendar API Wrapper ✅

**Created:** `packages/nextcloud/src/calendar.ts`

**Features:**
- Create calendar events via WebDAV
- Update existing calendar events
- Delete calendar events
- Get calendar event by ID
- iCalendar (RFC 5545) format support
- Helper functions for meeting sync

**Key Functions:**
```typescript
createCalendarEvent(client, event)
updateCalendarEvent(client, eventId, updates)
deleteCalendarEvent(client, eventId)
getCalendarEvent(client, eventId)
syncMeetingToCalendar(client, meeting)
updateMeetingInCalendar(client, eventId, meeting)
```

#### 2.2 Bidirectional Sync Service ✅

**Created:** `packages/services/src/calendar-sync.ts`

**Features:**
- Sync EAC meetings → Nextcloud Calendar
- Sync Nextcloud Calendar → EAC meetings (webhook-based)
- Bulk sync for organizations
- Sync status tracking
- Automatic event creation/update detection

**Key Functions:**
```typescript
syncMeetingToNextcloud(meetingId, userClient)
deleteMeetingFromCalendar(meetingId, userClient)
syncCalendarEventToMeeting(eventId, userClient)
handleCalendarWebhook(eventData, userClient)
syncAllMeetingsForOrg(orgId, userClient)
getMeetingSyncStatus(meetingId)
```

#### 2.3 Calendar Webhook Endpoint ✅

**Created:** `apps/inner-gathering/src/app/api/webhooks/nextcloud/calendar/route.ts`

**Features:**
- Receives Nextcloud calendar change notifications
- Processes: create, update, delete events
- Verifies webhook secret for security
- Auto-syncs changes back to EAC database

**Endpoint:** `POST /api/webhooks/nextcloud/calendar`

**Setup Required:**
1. Install Nextcloud "Workflow" app
2. Create workflow: "When calendar event changes" → "Make HTTP request"
3. URL: `http://inner-gathering:3004/api/webhooks/nextcloud/calendar`
4. Add header: `X-Nextcloud-Webhook-Secret: <your-secret>`

---

## 📦 Modified Files

### Package Dependencies
- `packages/nextcloud/package.json` - Added `@types/react` (dev dependency)
- `packages/services/package.json` - Added `@elkdonis/nextcloud` (workspace dependency)

### Exports
- `packages/nextcloud/src/index.ts` - Exported calendar module
- `packages/services/src/index.ts` - Exported calendar-sync functions

### Built Packages
- ✅ `@elkdonis/nextcloud@0.1.0` - Built successfully
- ✅ `@elkdonis/services@1.0.0` - Built successfully

---

## 🚀 How to Use Calendar Sync

### 1. Sync a Meeting to Calendar

```typescript
import { syncMeetingToNextcloud } from '@elkdonis/services';
import { createNextcloudClient } from '@elkdonis/nextcloud';

// Create client for user
const client = createNextcloudClient({
  baseUrl: process.env.NEXTCLOUD_URL!,
  username: user.nextcloud_user_id,
  password: user.nextcloud_app_password,
});

// Sync meeting
const eventId = await syncMeetingToNextcloud(meetingId, client);
// Meeting now appears in Nextcloud Calendar!
```

### 2. Check Sync Status

```typescript
import { getMeetingSyncStatus } from '@elkdonis/services';

const status = await getMeetingSyncStatus(meetingId);
console.log(status);
// {
//   synced: true,
//   lastSync: 2025-11-02T10:30:00Z,
//   eventId: 'meeting-abc123',
//   needsSync: false
// }
```

### 3. Bulk Sync for Organization

```typescript
import { syncAllMeetingsForOrg } from '@elkdonis/services';

const result = await syncAllMeetingsForOrg('elkdonis', client);
console.log(`Synced: ${result.synced}, Failed: ${result.failed.length}`);
```

---

## 🔧 Environment Variables Required

Add to `.env` or `.env.local`:

```bash
# Nextcloud Calendar Sync
NEXTCLOUD_URL=http://nextcloud-nginx:80
NEXTCLOUD_ADMIN_USER=elkdonis
NEXTCLOUD_ADMIN_PASSWORD=<your-secure-password>

# Webhook Security
NEXTCLOUD_WEBHOOK_SECRET=<generate-random-secret>
```

Generate webhook secret:
```bash
openssl rand -hex 32
```

---

## 📋 Remaining Work

### Phase 3: UI & Frontend (Not Started)

**Priority 1: Meeting Creation with Calendar Sync**
- [ ] Create `/meetings/new` page in inner-gathering
- [ ] Meeting form with all fields (title, description, date/time, location)
- [ ] "Sync to Calendar" toggle (default: on)
- [ ] Timezone selector
- [ ] Attachment upload
- [ ] Integration with Talk for online meetings
- [ ] Integration with availability polls

**Priority 2: Calendar View UI**
- [ ] Replace placeholder `/calendar` page
- [ ] Month/week/day views
- [ ] Display synced meetings from Nextcloud
- [ ] Inline meeting creation
- [ ] Sync status indicators

**Priority 3: Availability Polling UI**
- [ ] Update poll creator to support hybrid model
- [ ] "Simple Poll" (Nextcloud) vs "Meeting Schedule" (PostgreSQL) toggle
- [ ] Availability poll results with heatmap
- [ ] "Create Meeting" button from poll results

### Phase 4: SSO Implementation (Not Started)

- [ ] Install Nextcloud OIDC/SAML app
- [ ] Configure Supabase GoTrue as OIDC provider
- [ ] Update authentication flow for auto-provisioning
- [ ] Test SSO login across all apps
- [ ] Document SSO setup process

### Phase 5: Testing & Documentation

- [ ] Test calendar sync (EAC → Nextcloud)
- [ ] Test bidirectional sync (Nextcloud → EAC)
- [ ] Test webhook integration
- [ ] Test availability polls (PostgreSQL)
- [ ] Test meeting creation with all integrations
- [ ] Write user documentation
- [ ] Write developer documentation

---

## 🏗️ Architecture Summary

### Calendar Sync Flow

```
┌─────────────────────────────────────────────────────┐
│                 EAC Meeting Created                 │
│            (via inner-gathering app)                │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────┐
│         syncMeetingToNextcloud(meetingId)           │
│    - Fetches meeting from PostgreSQL               │
│    - Creates iCal event                            │
│    - Uploads via WebDAV                            │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────┐
│            Nextcloud Calendar (CalDAV)              │
│    - Stores event in user's calendar               │
│    - Accessible via mobile apps                    │
│    - Can be edited in Nextcloud                    │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼ (if edited)
┌─────────────────────────────────────────────────────┐
│          Nextcloud Workflow Webhook                 │
│    POST /api/webhooks/nextcloud/calendar           │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────┐
│        handleCalendarWebhook(eventData)             │
│    - Fetches updated event from Nextcloud          │
│    - Updates meeting in PostgreSQL                 │
│    - Logs sync event                               │
└─────────────────────────────────────────────────────┘
```

### Hybrid Polling System

```
User Creates Poll
       │
       ├─→ Meeting Schedule? → PostgreSQL availability_polls
       │                       - Timezone-aware
       │                       - Tight meeting integration
       │                       - Advanced conflict detection
       │
       └─→ Simple Poll?      → Nextcloud Polls API
                               - General voting
                               - Anonymous polls
                               - Mobile app access
```

---

## 💡 Next Steps for Development

1. **Immediate:** Test the calendar sync functionality
   ```bash
   # Start the services
   docker compose up -d

   # Check if webhook endpoint is accessible
   curl http://localhost:3004/api/webhooks/nextcloud/calendar
   ```

2. **Priority:** Implement meeting creation page
   - Use existing meeting form patterns from other apps
   - Add calendar sync toggle
   - Test end-to-end flow

3. **Later:** Build calendar UI
   - Consider using `react-big-calendar` or similar
   - Display meetings from both PostgreSQL and Nextcloud

4. **Future:** Configure OIDC SSO
   - Requires Nextcloud app installation
   - More complex setup, lower priority

---

## 🎯 Success Criteria Met

✅ Database migrations completed (004, 005, 007)
✅ CalDAV wrapper created with full CRUD operations
✅ Bidirectional sync service implemented
✅ Webhook endpoint created and ready
✅ Packages built successfully
✅ All TypeScript type checking passed

---

## 📝 Notes

- Calendar sync uses simplified WebDAV approach (not full tsdav library)
- Works with existing Nextcloud Calendar app
- iCalendar RFC 5545 format support included
- Timezone handling implemented in availability polls
- OIDC columns ready for future SSO implementation

---

**Next Session:** Focus on building the meeting creation UI and calendar view to make this functionality user-accessible.
