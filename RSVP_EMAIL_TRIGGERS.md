# RSVP Email Trigger Flow

## Overview

This document maps out how RSVP actions interact with the attendee system to trigger email notifications.

## Current Implementation

### In-App Notifications (Implemented)

Notifications are stored in the `notifications` table and displayed via the notification bell in the app.

#### Trigger: Minimum Attendees Reached
- **Location**: `apps/inner-gathering/src/app/api/meetings/[id]/rsvp/route.ts`
- **Condition**: When `notify_on_min_attendees = true` AND attendee count reaches `min_attendees` threshold
- **Action**: Creates notification with type `meeting_min_attendees` for the meeting organizer (guide)
- **Prevents Duplicates**: Sets `min_attendees_notified = true` on meeting record

## Proposed Email Triggers

### 1. RSVP Confirmation Email (to attendee)
```
Trigger: User RSVPs to a meeting
Recipient: The user who RSVP'd
Content:
  - Meeting title, date/time, location
  - Calendar link (ICS file)
  - Talk room link (if online)
  - Cancel RSVP link
```

### 2. RSVP Cancellation Email (to attendee)
```
Trigger: User cancels their RSVP
Recipient: The user who cancelled
Content:
  - Confirmation of cancellation
  - Link to re-RSVP (if deadline not passed)
```

### 3. New RSVP Notification (to organizer)
```
Trigger: Someone RSVPs to a meeting
Recipient: Meeting organizer (guide)
Content:
  - Attendee name
  - Current attendee count
  - Link to attendee list
```

### 4. Minimum Attendees Reached (to organizer)
```
Trigger: Attendee count reaches min_attendees threshold
Recipient: Meeting organizer (guide)
Condition: notify_on_min_attendees = true
Content:
  - "Your meeting has reached X attendees!"
  - Current attendee list
  - Link to manage meeting
```
**Status**: ✅ In-app notification implemented

### 5. RSVP Deadline Reminder (to attendees who haven't RSVP'd)
```
Trigger: Cron job, 24 hours before RSVP deadline
Recipients: Users with access who haven't RSVP'd
Content:
  - RSVP deadline approaching
  - Meeting details
  - Link to RSVP
```

### 6. Meeting Reminder (to confirmed attendees)
```
Trigger: Cron job, 24 hours before meeting
Recipients: All confirmed attendees
Content:
  - Meeting starting soon
  - Meeting details, location, Talk link
  - Cancel RSVP link
```

## Email Service Integration Points

### Option A: Direct SMTP (Nodemailer)

```typescript
// packages/email/src/send.ts
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendEmail(to: string, subject: string, html: string) {
  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject,
    html,
  });
}
```

### Option B: Email Service (SendGrid, Resend, etc.)

```typescript
// packages/email/src/send.ts
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendEmail(to: string, subject: string, html: string) {
  await resend.emails.send({
    from: process.env.EMAIL_FROM,
    to,
    subject,
    html,
  });
}
```

## Implementation Flow

### RSVP Submit Flow (POST /api/meetings/[id]/rsvp)

```
User clicks "I'm Going"
        │
        ▼
┌───────────────────────┐
│ Validate RSVP         │
│ - Check deadline      │
│ - Check capacity      │
└───────────┬───────────┘
            │
            ▼
┌───────────────────────┐
│ Insert into           │
│ meeting_attendees     │
└───────────┬───────────┘
            │
            ├────────────────────────────┐
            │                            │
            ▼                            ▼
┌───────────────────────┐    ┌───────────────────────┐
│ Send RSVP Confirmation│    │ Notify Organizer      │
│ Email to Attendee     │    │ of New RSVP           │
└───────────────────────┘    └───────────┬───────────┘
                                         │
                                         ▼
                             ┌───────────────────────┐
                             │ Check min_attendees   │
                             │ threshold             │
                             └───────────┬───────────┘
                                         │
                                    ┌────┴────┐
                                    │ Reached?│
                                    └────┬────┘
                                      Yes│
                                         ▼
                             ┌───────────────────────┐
                             │ Send "Min Reached"    │
                             │ Email to Organizer    │
                             └───────────────────────┘
```

### Database Schema for Email Tracking

```sql
-- Track sent emails to prevent duplicates
CREATE TABLE email_log (
  id TEXT PRIMARY KEY,
  recipient TEXT NOT NULL,
  email_type TEXT NOT NULL,
  reference_id TEXT, -- meeting_id, rsvp_id, etc.
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'sent' -- sent, failed, bounced
);

-- Meeting email preferences
ALTER TABLE meetings ADD COLUMN email_on_rsvp BOOLEAN DEFAULT false;
ALTER TABLE meetings ADD COLUMN email_reminder_hours INTEGER DEFAULT 24;
```

## Cron Jobs Required

| Job Name | Schedule | Description |
|----------|----------|-------------|
| `rsvp-deadline-reminders` | Every hour | Check for meetings with deadlines in 24h |
| `meeting-reminders` | Every hour | Check for meetings starting in 24h |
| `digest-emails` | Daily 8am | Send daily summary to organizers |

## Environment Variables

```env
# Email Configuration
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=noreply@example.com
SMTP_PASS=secret
EMAIL_FROM="Inner Gathering <noreply@example.com>"

# Or for Resend/SendGrid
RESEND_API_KEY=re_xxxxx
```

## Next Steps

1. [ ] Create `packages/email` package with templates
2. [ ] Add email templates (React Email or Handlebars)
3. [ ] Integrate email sending into RSVP API
4. [ ] Add email preferences to user settings
5. [ ] Implement cron jobs for scheduled emails
6. [ ] Add email logging table
7. [ ] Add unsubscribe handling
