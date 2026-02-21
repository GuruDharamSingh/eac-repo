# @elkdonis/nextcloud

Nextcloud integration package for Elkdonis Arts Collective.

## 🎯 Modular Design

This package follows a **modular approach** - import only what you need:

```typescript
// Core client
import { createNextcloudClient, getAdminClient } from '@elkdonis/nextcloud';

// File operations (only if your app needs files)
import { uploadFile, listFiles } from '@elkdonis/nextcloud/files';

// User management (typically only admin app)
import { provisionUser, syncAllUsers } from '@elkdonis/nextcloud/users';

// Talk integration (forum app, meetings)
import { createTalkRoom, getTalkEmbedUrl } from '@elkdonis/nextcloud/talk';

// React components (optional UI)
import { TalkEmbed, FileUploader } from '@elkdonis/nextcloud/components';
```

## 📦 Installation

Already installed in your monorepo! Just import from your apps.

## 🔧 Configuration

### Environment Variables

```env
# Required
NEXTCLOUD_URL=http://nextcloud-nginx:80  # Docker network URL
NEXTCLOUD_ADMIN_USER=elkdonis
NEXTCLOUD_ADMIN_PASSWORD=<generate-strong-password>  # See scripts/generate-secrets.sh

# For client-side components (browser)
NEXT_PUBLIC_NEXTCLOUD_URL=http://localhost:8080
```

### Production

```env
NEXTCLOUD_URL=https://cloud.yourfriend.com
NEXTCLOUD_ADMIN_USER=admin
NEXTCLOUD_ADMIN_PASSWORD=<generate-with-openssl-rand-base64-32>
NEXT_PUBLIC_NEXTCLOUD_URL=https://cloud.yourfriend.com
```

## 📚 Usage Examples

### 1. File Upload in API Route

```typescript
// apps/forum/src/app/api/meetings/upload/route.ts
import { createNextcloudClient } from '@elkdonis/nextcloud';
import { uploadFile } from '@elkdonis/nextcloud/files';
import { db } from '@elkdonis/db';

export async function POST(req: Request) {
  const formData = await req.formData();
  const file = formData.get('file') as File;
  const meetingId = formData.get('meetingId') as string;

  // Get meeting to know org folder
  const [meeting] = await db`
    SELECT m.*, o.nextcloud_folder_path 
    FROM meetings m
    JOIN organizations o ON m.org_id = o.id
    WHERE m.id = ${meetingId}
  `;

  // Create client for current user
  const client = createNextcloudClient({
    baseUrl: process.env.NEXTCLOUD_URL!,
    username: session.user.nextcloud_user_id,
    password: session.user.nextcloud_app_password,
  });

  // Upload to Nextcloud
  const ncFile = await uploadFile(client, file, {
    orgPath: meeting.nextcloud_folder_path,
    subfolder: `meetings/${meetingId}`,
  });

  // Save to database
  await db`
    INSERT INTO media (id, org_id, nextcloud_file_id, nextcloud_path, filename)
    VALUES (${generateId()}, ${meeting.org_id}, ${ncFile.id}, ${ncFile.path}, ${ncFile.filename})
  `;

  return Response.json({ success: true, file: ncFile });
}
```

### 2. Auto-provision Users (Admin App)

```typescript
// apps/admin/src/lib/auth-callback.ts
import { getAdminClient } from '@elkdonis/nextcloud';
import { provisionUser } from '@elkdonis/nextcloud/users';

export async function onUserSignup(user: User) {
  const admin = getAdminClient();
  
  // Auto-create Nextcloud user
  await provisionUser(admin, {
    userId: user.id,
    email: user.email,
    displayName: user.display_name,
  });
  
  console.log(`✅ Created Nextcloud user for ${user.email}`);
}
```

### 3. Create Talk Room for Meeting (Forum App)

```typescript
// apps/forum/src/lib/meetings.ts
import { getAdminClient } from '@elkdonis/nextcloud';
import { createTalkRoom } from '@elkdonis/nextcloud/talk';
import { db } from '@elkdonis/db';

export async function createMeeting(data: CreateMeetingData) {
  // Create meeting in your database
  const [meeting] = await db`
    INSERT INTO meetings (id, org_id, title, ...)
    VALUES (${generateId()}, ${data.orgId}, ${data.title}, ...)
    RETURNING *
  `;

  // Create Talk room
  const admin = getAdminClient();
  const talkRoom = await createTalkRoom(admin, {
    name: data.title,
    type: 'public',
  });

  // Store Talk token
  await db`
    UPDATE meetings 
    SET nextcloud_talk_token = ${talkRoom.token}
    WHERE id = ${meeting.id}
  `;

  return meeting;
}
```

### 4. Embed Video Chat in Meeting Page

```tsx
// apps/forum/src/app/meetings/[id]/page.tsx
import { TalkEmbed } from '@elkdonis/nextcloud/components';

export default async function MeetingPage({ params }: { params: { id: string } }) {
  const [meeting] = await db`SELECT * FROM meetings WHERE id = ${params.id}`;

  return (
    <div>
      <h1>{meeting.title}</h1>
      
      {meeting.nextcloud_talk_token && (
        <TalkEmbed 
          roomToken={meeting.nextcloud_talk_token}
          height="600px"
        />
      )}
    </div>
  );
}
```

## 🏗️ Package Structure

```
packages/nextcloud/
├── src/
│   ├── index.ts              # Main exports
│   ├── client.ts             # Core Nextcloud client
│   ├── files.ts              # File operations (WebDAV)
│   ├── users.ts              # User provisioning
│   ├── talk.ts               # Talk (video/chat) API
│   └── components/
│       ├── TalkEmbed.tsx     # Video chat embed
│       └── FileUploader.tsx  # Custom file upload UI
├── package.json
└── tsconfig.json
```

## 🎯 Which App Needs What?

### Admin App
```typescript
import { getAdminClient } from '@elkdonis/nextcloud';
import { provisionUser, syncAllUsers } from '@elkdonis/nextcloud/users';
import { createFolder } from '@elkdonis/nextcloud/files';
```

### Forum App
```typescript
import { createNextcloudClient } from '@elkdonis/nextcloud';
import { uploadFile, listFiles } from '@elkdonis/nextcloud/files';
import { createTalkRoom, sendMessage } from '@elkdonis/nextcloud/talk';
import { TalkEmbed } from '@elkdonis/nextcloud/components';
```

### Blog Apps
```typescript
import { createNextcloudClient } from '@elkdonis/nextcloud';
import { uploadFile } from '@elkdonis/nextcloud/files';
import { FileUploader } from '@elkdonis/nextcloud/components';
```

## 🔐 Security

- Uses app passwords (not user passwords)
- Server-side API calls (no CORS)
- Encrypted credential storage
- Docker network isolation

## 📝 API Reference

### Core Client

#### `createNextcloudClient(config)`
Creates a client for a specific user.

#### `getAdminClient()`
Gets admin client for privileged operations.

### Files API

#### `uploadFile(client, file, options)`
Upload a file to Nextcloud.

#### `listFiles(client, path)`
List files in a directory.

#### `downloadFile(client, path)`
Download a file.

#### `deleteFile(client, path)`
Delete a file.

### Users API

#### `provisionUser(adminClient, options)`
Create a Nextcloud user.

#### `syncAllUsers(adminClient)`
Sync all users from database to Nextcloud.

### Talk API

#### `createTalkRoom(client, options)`
Create a Talk room.

#### `sendMessage(client, roomToken, message)`
Send a chat message.

#### `getTalkEmbedUrl(roomToken)`
Get iframe URL for embedding.

## 🚀 Next Steps

1. Install dependencies: `pnpm install`
2. Configure environment variables
3. Import into your apps
4. Build amazing features!

## 📖 More Documentation

- See `NEXTCLOUD-INTEGRATION.md` for full architecture
- See `NEXTCLOUD-API-VS-IFRAME.md` for integration patterns
- See `NEXTCLOUD-DECISION.md` for architectural decisions
