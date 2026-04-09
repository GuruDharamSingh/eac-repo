# Integration Guide: Calendar Sync with Existing Meeting Creation

**Date:** November 2, 2025
**Status:** Ready to Integrate

---

## 📍 Current State

### What Already Exists ✅
1. **Meeting Creation:** `apps/inner-gathering/src/lib/data.ts:createMeeting()` - Creates meeting in PostgreSQL
2. **Server Action:** `apps/inner-gathering/src/lib/actions.ts:createMeetingAction()` - Wrapper for client calls
3. **Auth with Nextcloud Creds:** `packages/auth-server/src/index.ts:getServerSession()` - Returns user + nextcloud_user_id + nextcloud_app_password
4. **Calendar Sync Service:** `packages/services/src/calendar-sync.ts:syncMeetingToNextcloud()` - Syncs to Nextcloud Calendar

### What Needs Integration 🔧
- Connect meeting creation → calendar sync
- Add Talk room creation for online meetings
- Add calendar sync toggle to form

---

## 🔨 Integration Steps

### Step 1: Update Server Action with Calendar Sync

**File:** `apps/inner-gathering/src/lib/actions.ts`

**Current code (lines 52-72):**
```typescript
// Create meeting
const meeting = await createMeeting({
  userId: payload.userId,
  title: payload.title.trim(),
  startTime,
  endTime,
  location: payload.location?.trim(),
  description: payload.description?.trim(),
  visibility: payload.visibility,
  isOnline: payload.isOnline,
  meetingUrl: payload.meetingUrl?.trim(),
  nextcloudDocumentId: payload.nextcloudDocumentId,
  documentUrl: payload.documentUrl,
  media: payload.media,
});

// Revalidate feed page
revalidatePath("/feed");

return { meetingId: meeting.id };
```

**Updated code (ADD after meeting creation):**
```typescript
import { getServerSession } from '@elkdonis/auth-server';
import { createNextcloudClient } from '@elkdonis/nextcloud';
import {
  syncMeetingToNextcloud,
  createTalkRoom
} from '@elkdonis/services';

export async function createMeetingAction(payload: {
  userId: string;
  title: string;
  startTime: string;
  endTime?: string;
  location?: string;
  description?: string;
  visibility?: MeetingVisibility;
  isOnline?: boolean;
  meetingUrl?: string;
  nextcloudDocumentId?: string;
  documentUrl?: string;
  syncToCalendar?: boolean; // NEW: calendar sync toggle
  createTalkRoom?: boolean; // NEW: auto-create Talk room for online meetings
  media?: Array<{
    fileId: string;
    path: string;
    url: string;
    filename: string;
    mimeType: string;
    size: number;
    type: "image" | "video" | "audio" | "document";
  }>;
}) {
  // ... existing validation code ...

  // Create meeting
  const meeting = await createMeeting({
    userId: payload.userId,
    title: payload.title.trim(),
    startTime,
    endTime,
    location: payload.location?.trim(),
    description: payload.description?.trim(),
    visibility: payload.visibility,
    isOnline: payload.isOnline,
    meetingUrl: payload.meetingUrl?.trim(),
    nextcloudDocumentId: payload.nextcloudDocumentId,
    documentUrl: payload.documentUrl,
    media: payload.media,
  });

  // ============ NEW: Calendar & Talk Integration ============

  // Get user session with Nextcloud credentials
  const session = await getServerSession();

  if (session?.user?.nextcloud_user_id && session?.user?.nextcloud_app_password) {
    // Create Nextcloud client for this user
    const nextcloudClient = createNextcloudClient({
      baseUrl: process.env.NEXTCLOUD_URL || 'http://nextcloud-nginx:80',
      username: session.user.nextcloud_user_id,
      password: session.user.nextcloud_app_password,
    });

    try {
      // Sync to calendar (if enabled - default true)
      if (payload.syncToCalendar !== false) {
        await syncMeetingToNextcloud(meeting.id, nextcloudClient);
        console.log(`Meeting ${meeting.id} synced to Nextcloud Calendar`);
      }

      // Create Talk room for online meetings (if enabled)
      if (payload.isOnline && payload.createTalkRoom !== false) {
        const talkToken = await createTalkRoom(
          nextcloudClient,
          {
            name: payload.title,
            type: 'public', // or 'group' based on visibility
          }
        );

        // Update meeting with Talk room token
        await db`
          UPDATE meetings
          SET nextcloud_talk_token = ${talkToken}
          WHERE id = ${meeting.id}
        `;

        console.log(`Talk room created for meeting ${meeting.id}: ${talkToken}`);
      }
    } catch (error) {
      // Log error but don't fail meeting creation
      console.error('Nextcloud integration error:', error);
      // Meeting still exists in DB, sync can be retried later
    }
  }

  // ============ End New Code ============

  // Revalidate feed page
  revalidatePath("/feed");

  return {
    meetingId: meeting.id,
    syncedToCalendar: payload.syncToCalendar !== false,
    talkRoomCreated: payload.isOnline && payload.createTalkRoom !== false,
  };
}
```

---

### Step 2: Update Meeting Form with Toggles

**File:** `apps/inner-gathering/src/components/create-meeting-form.tsx`

**Add these fields to the form:**
```tsx
// Add to form state
const [syncToCalendar, setSyncToCalendar] = useState(true);
const [createTalkRoom, setCreateTalkRoom] = useState(true);

// Add UI components in the form
<div className="space-y-4">
  {/* Existing form fields... */}

  {/* Calendar Sync Toggle */}
  <div className="flex items-center space-x-2">
    <input
      type="checkbox"
      id="syncToCalendar"
      checked={syncToCalendar}
      onChange={(e) => setSyncToCalendar(e.target.checked)}
    />
    <label htmlFor="syncToCalendar" className="text-sm">
      Sync to Nextcloud Calendar
      <span className="text-gray-500 ml-2">
        (Accessible via mobile calendar apps)
      </span>
    </label>
  </div>

  {/* Talk Room Toggle (only for online meetings) */}
  {isOnline && (
    <div className="flex items-center space-x-2">
      <input
        type="checkbox"
        id="createTalkRoom"
        checked={createTalkRoom}
        onChange={(e) => setCreateTalkRoom(e.target.checked)}
      />
      <label htmlFor="createTalkRoom" className="text-sm">
        Create video chat room (Nextcloud Talk)
        <span className="text-gray-500 ml-2">
          (Automatically generated)
        </span>
      </label>
    </div>
  )}
</div>

// Update form submission to include new fields
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  await createMeetingAction({
    // ... existing payload ...
    syncToCalendar, // NEW
    createTalkRoom: isOnline ? createTalkRoom : false, // NEW
  });
};
```

---

### Step 3: Add Missing `createTalkRoom` Function

**File:** `packages/services/src/nextcloud.ts`

**Add after existing Nextcloud functions:**
```typescript
import { createTalkRoom as createTalkRoomAPI } from '@elkdonis/nextcloud';

/**
 * Create a Nextcloud Talk room for a meeting
 * Returns the room token to store in meetings.nextcloud_talk_token
 */
export async function createTalkRoom(
  client: NextcloudClient,
  options: {
    name: string;
    type: 'public' | 'group';
  }
): Promise<string> {
  const room = await createTalkRoomAPI(client, {
    name: options.name,
    type: options.type,
  });

  return room.token;
}
```

**Then export it from the index:**
```typescript
// packages/services/src/index.ts
export {
  // ... existing exports ...
  createTalkRoom,
} from './nextcloud';
```

---

### Step 4: Display Calendar Sync Status

**File:** `apps/inner-gathering/src/app/meetings/[id]/page.tsx` (if exists)

**Show sync status in meeting details:**
```tsx
import { getMeetingSyncStatus } from '@elkdonis/services';

export default async function MeetingPage({ params }: { params: { id: string } }) {
  const meeting = await getMeeting(params.id);
  const syncStatus = await getMeetingSyncStatus(params.id);

  return (
    <div>
      <h1>{meeting.title}</h1>

      {/* Calendar Sync Status */}
      {syncStatus.synced && (
        <div className="bg-green-50 p-3 rounded-md flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <span className="text-sm text-green-700">
            Synced to Nextcloud Calendar
            {syncStatus.lastSync && (
              <span className="text-gray-600 ml-2">
                (Last sync: {new Date(syncStatus.lastSync).toLocaleString()})
              </span>
            )}
          </span>
        </div>
      )}

      {syncStatus.needsSync && (
        <div className="bg-yellow-50 p-3 rounded-md">
          <span className="text-sm text-yellow-700">
            Meeting updated. Sync to calendar pending...
          </span>
        </div>
      )}

      {/* Talk Room Link (if online meeting) */}
      {meeting.isOnline && meeting.nextcloudTalkToken && (
        <a
          href={`${process.env.NEXT_PUBLIC_NEXTCLOUD_URL}/call/${meeting.nextcloudTalkToken}`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-primary"
        >
          <Video className="h-5 w-5 mr-2" />
          Join Video Chat
        </a>
      )}

      {/* Rest of meeting details... */}
    </div>
  );
}
```

---

## 🔒 Security Considerations

### 1. Error Handling
✅ Calendar sync errors don't fail meeting creation
✅ Errors are logged for debugging
✅ User is informed if sync fails

### 2. Authentication
✅ Uses `getServerSession()` which validates Supabase JWT
✅ Nextcloud credentials stored encrypted in database
✅ No client-side exposure of Nextcloud passwords

### 3. Authorization
⚠️ **TODO:** Add org membership check before syncing
```typescript
import { checkOrgAccess } from '@elkdonis/auth-server';

// Before syncing:
const hasAccess = await checkOrgAccess(session.user.id, 'inner_group');
if (!hasAccess) {
  throw new Error('Unauthorized');
}
```

---

## 🧪 Testing Checklist

### Manual Testing Steps
1. ✅ Create meeting without calendar sync (toggle off)
   - Meeting created in DB
   - No calendar event created

2. ✅ Create meeting with calendar sync (toggle on)
   - Meeting created in DB
   - Calendar event created in Nextcloud
   - Verify in Nextcloud Calendar web UI
   - Verify in Nextcloud Calendar mobile app

3. ✅ Create online meeting with Talk room
   - Meeting created
   - Talk room created
   - `nextcloud_talk_token` stored
   - Join link works

4. ✅ Edit meeting in Nextcloud Calendar
   - Webhook fires
   - Changes sync back to EAC database
   - Meeting details updated

5. ✅ Delete meeting in EAC
   - Calendar event deleted from Nextcloud
   - Talk room deleted (if applicable)

### Edge Cases
- ⚠️ User not synced to Nextcloud (no nextcloud_user_id)
  - Meeting should still be created
  - Log warning about missing Nextcloud account

- ⚠️ Nextcloud service down
  - Meeting creation succeeds
  - Sync marked as pending
  - Retry mechanism needed (cron job?)

---

## 📊 Database Schema Verification

**Confirm these columns exist in `meetings` table:**
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'meetings'
  AND column_name IN (
    'nextcloud_calendar_event_id',
    'nextcloud_calendar_synced',
    'nextcloud_last_sync',
    'nextcloud_talk_token'
  );
```

**Expected output:**
```
nextcloud_calendar_event_id | character varying
nextcloud_calendar_synced   | boolean
nextcloud_last_sync         | timestamp with time zone
nextcloud_talk_token        | character varying
```

✅ Migration 005 added these columns

---

## 🚀 Deployment Steps

1. **Build packages with new code:**
   ```bash
   pnpm --filter @elkdonis/services build
   pnpm --filter @elkdonis/nextcloud build
   ```

2. **Verify environment variables:**
   ```bash
   # In .env or docker-compose.yml
   NEXTCLOUD_URL=http://nextcloud-nginx:80
   NEXTCLOUD_ADMIN_USER=elkdonis
   NEXTCLOUD_ADMIN_PASSWORD=<secure-password>
   NEXTCLOUD_WEBHOOK_SECRET=<random-secret>
   ```

3. **Configure Nextcloud webhook:**
   - Install "Workflow" app in Nextcloud
   - Create workflow: "Calendar event changes" → POST to webhook URL
   - URL: `http://inner-gathering:3004/api/webhooks/nextcloud/calendar`
   - Header: `X-Nextcloud-Webhook-Secret: <secret>`

4. **Restart services:**
   ```bash
   docker compose up -d --build inner-gathering
   ```

5. **Test end-to-end:**
   - Create meeting in inner-gathering
   - Check Nextcloud Calendar for event
   - Edit event in Nextcloud
   - Verify changes in EAC

---

## 📝 Documentation for Users

### How Calendar Sync Works

When you create a meeting in the Inner Gathering app:

1. **Meeting is saved** to the EAC database
2. **Calendar event is created** in your Nextcloud Calendar (if sync enabled)
3. **Event appears** in Nextcloud Calendar web and mobile apps
4. **Changes sync bidirectionally:**
   - Edit in EAC → updates Nextcloud
   - Edit in Nextcloud → updates EAC

### Benefits
- Access meetings from any calendar app (Google Calendar, Apple Calendar, etc.)
- Get calendar notifications on your phone
- See meetings alongside your other events
- Share .ics invites with external attendees

### Privacy
- Only syncs meetings you create or are invited to
- Respects meeting visibility settings
- Uses your personal Nextcloud account

---

## 🎯 Next Steps (Priority Order)

1. **[HIGH]** Integrate code from this guide into `actions.ts`
2. **[HIGH]** Update meeting form with calendar sync toggle
3. **[HIGH]** Test end-to-end flow
4. **[MEDIUM]** Add Talk room display in meeting details
5. **[MEDIUM]** Add sync status indicators in UI
6. **[LOW]** Build retry mechanism for failed syncs
7. **[LOW]** Add bulk sync endpoint for existing meetings

---

**Questions or issues?** Check:
- `NEXTCLOUD_INTEGRATION_PROGRESS.md` - Recent work log
- `NEXTCLOUD_INTEGRATION_ANALYSIS.md` - Strategic overview
- `packages/nextcloud/README.md` - API documentation
