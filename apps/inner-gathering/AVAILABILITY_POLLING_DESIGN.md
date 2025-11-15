# Availability Polling Feature Design
**Date:** October 26, 2024
**App:** inner-gathering
**Approach:** Hybrid - Nextcloud Polls/Calendar + shadcn UI

---

## Research Summary

### ✅ Nextcloud Has Built-In Solutions

Based on research, Nextcloud provides:

1. **Nextcloud Polls App** (Official)
   - Voting on multiple options
   - Anonymous polls
   - Multiple choice support
   - Top 20 most popular Nextcloud app

2. **Nextcloud Calendar with Meeting Proposals** (2024/2025 Feature)
   - Configure meeting with title, duration, participants
   - Select multiple time slots
   - Participants receive email with poll to vote
   - Lock in final meeting with one click
   - Automatic availability detection

3. **Nextcloud Talk Polls**
   - Create polls directly in chat
   - Anonymous voting
   - Multiple choice support

### Popular Alternative Approaches

1. **When2Meet Style** - Visual grid where users drag/click available times
2. **Doodle Style** - List of time options with checkboxes
3. **Calendly Style** - Show available slots based on everyone's calendars

---

## Recommended Approach: Hybrid Solution

### Strategy: Best of Both Worlds

**Use Nextcloud Backend + shadcn UI Frontend**

#### Why This Approach?

✅ **Leverage Nextcloud's Power**
- Calendar integration already exists
- Automatic timezone handling
- User provisioning already set up
- No need to build complex scheduling logic

✅ **Custom User Experience**
- Beautiful shadcn UI components
- Mobile-first design matching inner-gathering
- Seamless integration with existing UI
- Full control over UX

✅ **Avoid Reinventing the Wheel**
- Don't build timezone conversion logic
- Don't build calendar availability detection
- Don't manage meeting scheduling conflicts

---

## Architecture Design

### Option 1: Nextcloud Calendar API + shadcn UI (RECOMMENDED)

```
┌─────────────────────────────────────────────────┐
│         Inner-Gathering (shadcn UI)             │
├─────────────────────────────────────────────────┤
│                                                 │
│  1. User creates "Availability Poll"            │
│     └─> shadcn Calendar components              │
│     └─> Select date range                       │
│     └─> Select time slots                       │
│                                                 │
│  2. Backend creates Meeting Proposal            │
│     └─> @elkdonis/nextcloud/calendar API        │
│     └─> Store proposal in database              │
│                                                 │
│  3. Participants mark availability              │
│     └─> shadcn Calendar + Time picker           │
│     └─> Updates sent to Nextcloud               │
│     └─> Real-time updates via polling/websocket │
│                                                 │
│  4. Visual grid shows overlapping availability  │
│     └─> When2Meet-style heat map                │
│     └─> Darker = more people available          │
│                                                 │
│  5. Creator locks in final time                 │
│     └─> Creates actual meeting in database      │
│     └─> Creates Nextcloud calendar event        │
│     └─> Notifications sent to all               │
│                                                 │
└─────────────────────────────────────────────────┘
                      ↕
┌─────────────────────────────────────────────────┐
│            Nextcloud (Backend)                  │
├─────────────────────────────────────────────────┤
│  - Calendar API (availability)                  │
│  - User timezone detection                      │
│  - Email notifications                          │
│  - Event creation                               │
└─────────────────────────────────────────────────┘
```

### Option 2: Nextcloud Polls API + shadcn UI

```
Use Nextcloud Polls app API directly:
- Create poll via OCS API
- Fetch poll data
- Display with shadcn components
- Submit votes via API
```

**Pros:**
- Simpler backend integration
- Poll app handles all logic

**Cons:**
- Nextcloud Polls app may not have timezone-aware time slots
- Less control over scheduling logic

### Option 3: Custom When2Meet Clone (NOT RECOMMENDED)

Build from scratch with `react-schedule-selector`

**Cons:**
- ❌ Must build timezone conversion
- ❌ Must build availability aggregation
- ❌ Must build conflict detection
- ❌ More code to maintain
- ❌ Duplicates what Nextcloud already does

---

## Implementation Plan

### Phase 1: Database Schema (1-2 hours)

```sql
-- Availability Polls
CREATE TABLE availability_polls (
  id VARCHAR(21) PRIMARY KEY,
  org_id VARCHAR(50) NOT NULL REFERENCES organizations(id),
  creator_id UUID NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  description TEXT,

  -- Date/time range for poll
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  earliest_time TIME NOT NULL,     -- e.g., 09:00
  latest_time TIME NOT NULL,        -- e.g., 21:00
  time_slot_duration INTEGER NOT NULL DEFAULT 30,  -- minutes

  -- Nextcloud integration
  nextcloud_poll_id VARCHAR(255),
  nextcloud_calendar_proposal_id VARCHAR(255),

  -- Status
  status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'locked', 'cancelled')),
  locked_time_slot TIMESTAMPTZ,    -- Final chosen time
  final_meeting_id VARCHAR(21) REFERENCES meetings(id),

  -- Settings
  allow_maybe BOOLEAN DEFAULT true,
  require_authentication BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  deadline TIMESTAMPTZ
);

-- Individual availability responses
CREATE TABLE availability_responses (
  id VARCHAR(21) PRIMARY KEY,
  poll_id VARCHAR(21) NOT NULL REFERENCES availability_polls(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),  -- NULL if anonymous
  user_name VARCHAR(255),             -- For anonymous responses

  -- Timezone handling
  user_timezone VARCHAR(100) NOT NULL, -- e.g., 'America/New_York'

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(poll_id, user_id)
);

-- Time slot selections (YES/NO/MAYBE)
CREATE TABLE availability_slots (
  response_id VARCHAR(21) NOT NULL REFERENCES availability_responses(id) ON DELETE CASCADE,
  time_slot TIMESTAMPTZ NOT NULL,
  availability VARCHAR(10) NOT NULL CHECK (availability IN ('yes', 'no', 'maybe')),

  PRIMARY KEY (response_id, time_slot)
);

CREATE INDEX idx_polls_org ON availability_polls(org_id);
CREATE INDEX idx_polls_status ON availability_polls(status);
CREATE INDEX idx_responses_poll ON availability_responses(poll_id);
CREATE INDEX idx_slots_response ON availability_slots(response_id);
CREATE INDEX idx_slots_time ON availability_slots(time_slot);
```

### Phase 2: Nextcloud Integration (2-3 hours)

**Add to `packages/nextcloud/src/calendar.ts`:**

```typescript
import { WebDAVClient } from 'webdav';

export interface CalendarAvailability {
  start: Date;
  end: Date;
  isBusy: boolean;
}

/**
 * Get user's calendar availability for a date range
 */
export async function getUserAvailability(
  client: WebDAVClient,
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<CalendarAvailability[]> {
  // Query Nextcloud Calendar API for free/busy times
  const response = await fetch(
    `${client.baseUrl}/remote.php/dav/calendars/${userId}/inbox/`,
    {
      method: 'REPORT',
      headers: {
        'Content-Type': 'application/xml',
        'Depth': '1',
      },
      body: generateFreeBusyQuery(startDate, endDate),
    }
  );

  return parseCalendarAvailability(await response.text());
}

/**
 * Create meeting proposal in Nextcloud Calendar
 */
export async function createMeetingProposal(
  client: WebDAVClient,
  options: {
    title: string;
    duration: number;
    participants: string[];
    proposedSlots: Date[];
  }
): Promise<{ proposalId: string }> {
  // Use Nextcloud Calendar API to create meeting proposal
  // This will send emails to participants automatically
}
```

### Phase 3: shadcn UI Components (4-6 hours)

**Components to Add:**

```bash
npx shadcn@latest add calendar dialog select checkbox radio-group
```

**Create Custom Components:**

1. **`availability-poll-creator.tsx`**
   - Form to create new poll
   - Date range picker (shadcn calendar)
   - Time range selector
   - Participant selector

2. **`availability-grid.tsx`**
   - When2Meet-style visual grid
   - Shows all time slots
   - Color-coded by # of available people
   - Click to mark your availability

3. **`availability-timeline.tsx`**
   - Alternative view: timeline of all responses
   - User avatars with their available slots
   - Timezone display

4. **`availability-summary.tsx`**
   - Shows best times (most available)
   - Statistics (X out of Y people available)
   - Lock-in button for organizer

### Phase 4: API Routes (2-3 hours)

```typescript
// apps/inner-gathering/src/app/api/polls/route.ts
// POST - Create new availability poll
// GET - List polls

// apps/inner-gathering/src/app/api/polls/[id]/route.ts
// GET - Get poll details
// PATCH - Update poll (lock time)
// DELETE - Delete poll

// apps/inner-gathering/src/app/api/polls/[id]/responses/route.ts
// POST - Submit availability
// GET - Get all responses (aggregated)
```

### Phase 5: UI Pages (3-4 hours)

```
/polls                  - List all polls
/polls/new              - Create new poll
/polls/[id]             - View & respond to poll
/polls/[id]/results     - Visual results (organizer view)
```

---

## UI/UX Design

### Create Poll Flow

```
Step 1: Basic Info
┌─────────────────────────────────────┐
│ Create Availability Poll            │
├─────────────────────────────────────┤
│ Title: [_________________________] │
│                                     │
│ Description (optional):             │
│ [_______________________________]  │
│                                     │
│ [Next: Select Dates]                │
└─────────────────────────────────────┘

Step 2: Date & Time Range
┌─────────────────────────────────────┐
│ When could this meeting happen?     │
├─────────────────────────────────────┤
│ From: [Nov 1, 2024  ▼]              │
│ To:   [Nov 5, 2024  ▼]              │
│                                     │
│ Time range each day:                │
│ Earliest: [09:00 AM ▼]              │
│ Latest:   [05:00 PM ▼]              │
│                                     │
│ Time slot duration: [30 min ▼]     │
│                                     │
│ [Back] [Next: Options]               │
└─────────────────────────────────────┘

Step 3: Settings
┌─────────────────────────────────────┐
│ Poll Settings                       │
├─────────────────────────────────────┤
│ ☑ Allow "Maybe" responses           │
│ ☑ Require login to respond          │
│ ☑ Hide other participants' answers  │
│                                     │
│ Response deadline (optional):       │
│ [Nov 3, 2024 at 11:59 PM]          │
│                                     │
│ [Back] [Create Poll]                 │
└─────────────────────────────────────┘
```

### Respond to Poll Flow

```
Mobile View: When2Meet Style Grid
┌─────────────────────────────────────┐
│ ← Team Meeting - Week of Nov 1      │
├─────────────────────────────────────┤
│ Your timezone: PST (GMT-8)    [Edit]│
├─────────────────────────────────────┤
│        Mon  Tue  Wed  Thu  Fri      │
│ 9:00   [💚] [💚] [❤️] [💚] [💚]     │ (Green = Yes)
│ 9:30   [💚] [💚] [💚] [💚] [💚]     │ (Red = No)
│10:00   [💚] [❤️] [💚] [💚] [💚]     │ (Yellow = Maybe)
│10:30   [💚] [💚] [💚] [❤️] [💚]     │
│11:00   [💚] [💚] [💚] [💚] [💚]     │ Click/drag to select
│...                                   │
├─────────────────────────────────────┤
│ Legend:                              │
│ 💚 I'm available                     │
│ ⚠️ Maybe available                   │
│ ❤️ Not available                     │
├─────────────────────────────────────┤
│ [Save My Availability]               │
└─────────────────────────────────────┘
```

### Results View (Organizer)

```
Heat Map View
┌─────────────────────────────────────┐
│ Results: Team Meeting (5/8 responded)│
├─────────────────────────────────────┤
│        Mon  Tue  Wed  Thu  Fri      │
│ 9:00   [░1] [░1] [▓3] [▓4] [░2]    │ Darker = more available
│ 9:30   [▓4] [█5] [▓3] [▓4] [█5] ⭐  │ ⭐ = Best time
│10:00   [▓3] [▓4] [▓4] [░2] [▓3]    │
│10:30   [░2] [▓3] [█5] [▓3] [▓4]    │
│11:00   [░1] [░2] [▓4] [█5] [▓3]    │
│...                                   │
├─────────────────────────────────────┤
│ Best time: Tue Nov 2, 9:30 AM PST   │
│ 5 out of 8 people available         │
│                                     │
│ [Lock This Time] [View Details]     │
└─────────────────────────────────────┘
```

---

## Technical Implementation Details

### Timezone Handling

```typescript
// Utils for timezone conversion
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';

export function convertToUserTimezone(
  utcTime: Date,
  userTimezone: string
): Date {
  return toZonedTime(utcTime, userTimezone);
}

export function generateTimeSlots(
  startDate: Date,
  endDate: Date,
  startTime: string,  // "09:00"
  endTime: string,    // "17:00"
  duration: number,   // 30 minutes
  timezone: string
): Date[] {
  const slots: Date[] = [];
  // Generate UTC slots that correspond to local time range
  // Store everything in UTC, display in user's timezone
}
```

### Real-Time Updates

```typescript
// Option 1: Polling (simpler)
useEffect(() => {
  const interval = setInterval(() => {
    fetchPollResponses(pollId);
  }, 5000); // Every 5 seconds

  return () => clearInterval(interval);
}, [pollId]);

// Option 2: WebSocket (better UX)
const { responses } = useWebSocket(`/api/polls/${pollId}/subscribe`);
```

### Aggregation Logic

```typescript
export function aggregateAvailability(
  responses: AvailabilityResponse[]
): Map<Date, AvailabilitySummary> {
  const summary = new Map();

  for (const response of responses) {
    for (const slot of response.slots) {
      if (!summary.has(slot.time_slot)) {
        summary.set(slot.time_slot, {
          total: 0,
          yes: 0,
          maybe: 0,
          no: 0,
        });
      }

      const s = summary.get(slot.time_slot);
      s.total++;

      if (slot.availability === 'yes') s.yes++;
      else if (slot.availability === 'maybe') s.maybe++;
      else s.no++;
    }
  }

  return summary;
}
```

---

## Integration with Nextcloud

### Approach 1: Use Nextcloud as Truth Source

```typescript
// 1. Create meeting proposal in Nextcloud
const proposal = await createNextcloudMeetingProposal({
  title: poll.title,
  duration: 60,
  participants: poll.participants.map(p => p.email),
  proposedSlots: generateTimeSlots(poll),
});

// 2. Store proposal ID in database
await db`
  UPDATE availability_polls
  SET nextcloud_calendar_proposal_id = ${proposal.id}
  WHERE id = ${poll.id}
`;

// 3. Sync votes from Nextcloud periodically
const votes = await fetchNextcloudProposalVotes(proposal.id);
```

### Approach 2: Use Database as Truth Source

```typescript
// 1. Store all data in our database
// 2. When poll is locked, create Nextcloud event
const event = await createNextcloudCalendarEvent({
  title: poll.title,
  start: poll.locked_time_slot,
  end: addMinutes(poll.locked_time_slot, poll.duration),
  attendees: poll.participants.map(p => p.email),
});

// 3. Send notifications through Nextcloud
await sendNextcloudNotifications(event);
```

**Recommendation:** Start with Approach 2 (database as truth), sync to Nextcloud when locked.

---

## Testing Checklist

- [ ] Create poll with date range
- [ ] Respond to poll (mark availability)
- [ ] View responses in different timezones
- [ ] Aggregate responses correctly
- [ ] Heat map shows accurate data
- [ ] Lock time and create meeting
- [ ] Nextcloud event created correctly
- [ ] Notifications sent to participants
- [ ] Mobile responsive grid
- [ ] Drag-to-select functionality
- [ ] Anonymous responses (if enabled)
- [ ] Deadline enforcement

---

## Future Enhancements

1. **Recurring Availability**
   - "Every Tuesday 2-4pm"
   - Save as template

2. **Calendar Integration**
   - Import from Google Calendar
   - Block out busy times automatically

3. **Smart Suggestions**
   - AI suggests best times based on patterns
   - "Most people available in mornings"

4. **Mobile App**
   - Push notifications for new polls
   - Quick response via app

5. **Analytics**
   - Response rate tracking
   - Best/worst times trends

---

## Recommendation: GO WITH HYBRID APPROACH

**Start Simple:**
1. Build custom UI with shadcn (Phase 3)
2. Store data in database (Phase 1)
3. Sync to Nextcloud on lock (Phase 2)
4. Add real-time updates later

**This gives you:**
- ✅ Beautiful, mobile-first UI
- ✅ Full control over UX
- ✅ Leverage Nextcloud for final scheduling
- ✅ Incremental development

**Estimated Time:** 2-3 days for MVP

---

**Created By:** Claude AI
**Status:** Design Complete - Ready for Implementation
