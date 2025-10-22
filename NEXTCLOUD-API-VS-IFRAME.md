# Nextcloud Integration: iframe vs API Layer

## 🤔 The Two Approaches

### Approach 1: iframe Embedding (What I suggested)
**When to use**: Embedding Nextcloud's **existing UI** (Talk video interface, Text editor UI)

### Approach 2: API Layer (What you're thinking)
**When to use**: Building your **own UI** that talks to Nextcloud backend

## 📊 Comparison

| Feature | iframe Embedding | API Layer |
|---------|-----------------|-----------|
| **Setup Complexity** | Simple | Complex |
| **UI Control** | Limited (Nextcloud's UI) | Full (your custom UI) |
| **Maintenance** | Low (Nextcloud updates UI) | High (you maintain UI) |
| **Performance** | Moderate (full UI loaded) | Fast (minimal data transfer) |
| **User Experience** | Nextcloud look & feel | Your custom design |
| **CORS Issues** | None (separate origin) | Must configure |
| **Credentials** | Shared session | API tokens |
| **Feature Completeness** | 100% (all features) | Only what you build |

## 🎯 RECOMMENDED: **Hybrid Approach**

Use **BOTH** depending on the feature:

```
┌──────────────────────────────────────────────────────┐
│              HYBRID INTEGRATION                       │
├──────────────────────────────────────────────────────┤
│                                                        │
│  Use API Layer for:                                   │
│  ✅ File uploads/downloads                            │
│  ✅ File listing                                      │
│  ✅ User provisioning                                 │
│  ✅ Creating Talk rooms                               │
│  ✅ Sending chat messages                             │
│  ✅ Simple data operations                            │
│                                                        │
│  Use iframe Embedding for:                            │
│  ✅ Video chat UI (complex WebRTC)                    │
│  ✅ Collaborative editor (complex real-time sync)     │
│  ✅ Full-featured file browser                        │
│  ✅ Calendar UI (complex interactions)                │
│                                                        │
└──────────────────────────────────────────────────────┘
```

## 🔧 API Layer Implementation

### Architecture:
```
Your App (Next.js)
    ↓
@elkdonis/nextcloud (API client)
    ↓
Nextcloud REST APIs:
    - WebDAV (files)
    - OCS API (users, shares, apps)
    - Talk API (chat, rooms)
    - Text API (documents)
```

### Credential Handling:

```typescript
// packages/nextcloud/src/auth.ts
import { getServerSession } from 'next-auth';

export async function getNextcloudClient(userId: string) {
  // Get user's Nextcloud credentials from your database
  const user = await db`
    SELECT nextcloud_user_id, nextcloud_app_password 
    FROM users 
    WHERE id = ${userId}
  `;

  return new NextcloudClient({
    baseUrl: process.env.NEXTCLOUD_URL, // http://nextcloud-nginx:80
    username: user.nextcloud_user_id,
    password: user.nextcloud_app_password, // App-specific password
  });
}

// Usage in API route:
export async function POST(req: Request) {
  const session = await getServerSession();
  const client = await getNextcloudClient(session.user.id);
  
  // Now make Nextcloud API calls
  const files = await client.files.list('/Photos');
  return Response.json(files);
}
```

### CORS Configuration:

**Good news**: With separate Docker stack on same network, **NO CORS issues for server-side calls!**

```typescript
// Server-side API calls (Next.js API routes)
// ✅ NO CORS - containers talk directly via Docker network

// apps/admin/src/app/api/files/upload/route.ts
export async function POST(req: Request) {
  const client = await getNextcloudClient(session.user.id);
  
  // This hits: http://nextcloud-nginx:80/remote.php/dav/files/...
  // Docker network = no CORS!
  const result = await client.files.upload(file);
  
  return Response.json(result);
}
```

**Only need CORS for**: Client-side direct calls (which we avoid)

```typescript
// ❌ Client-side direct call (would need CORS)
fetch('http://localhost:8080/ocs/v2.php/...') 

// ✅ Instead, go through your API
fetch('/api/nextcloud/files')
  ↓
  Your Next.js API route
  ↓
  Nextcloud (Docker network, no CORS)
```

## 🎨 Example: File Upload - API Layer

### Your Custom UI:
```tsx
// apps/forum/src/components/FileUploader.tsx
'use client';

export function FileUploader({ meetingId }: { meetingId: string }) {
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (file: File) => {
    setUploading(true);
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('meetingId', meetingId);
    
    // Call YOUR API (not Nextcloud directly)
    const response = await fetch('/api/meetings/upload', {
      method: 'POST',
      body: formData,
    });
    
    const result = await response.json();
    setUploading(false);
    
    // Your custom success UI
    toast.success(`${file.name} uploaded!`);
  };

  return (
    <div className="custom-uploader">
      {/* Your beautiful custom UI */}
      <input type="file" onChange={(e) => handleUpload(e.target.files[0])} />
      {uploading && <YourCustomSpinner />}
    </div>
  );
}
```

### Your API Route:
```typescript
// apps/forum/src/app/api/meetings/upload/route.ts
import { getNextcloudClient } from '@elkdonis/nextcloud';
import { db } from '@elkdonis/db';

export async function POST(req: Request) {
  const session = await getServerSession();
  const formData = await req.formData();
  const file = formData.get('file') as File;
  const meetingId = formData.get('meetingId') as string;
  
  // Get meeting to know which folder
  const meeting = await db`
    SELECT m.*, o.nextcloud_folder_path 
    FROM meetings m
    JOIN organizations o ON m.org_id = o.id
    WHERE m.id = ${meetingId}
  `;
  
  // Upload to Nextcloud via API
  const client = await getNextcloudClient(session.user.id);
  const uploadPath = `${meeting.nextcloud_folder_path}/meetings/${meetingId}/${file.name}`;
  
  const nextcloudFile = await client.files.upload(uploadPath, file);
  
  // Store reference in your database
  await db`
    INSERT INTO media (
      id, org_id, uploaded_by, attached_to_type, attached_to_id,
      nextcloud_file_id, nextcloud_path, url, filename, size_bytes, mime_type
    ) VALUES (
      ${generateId()}, ${meeting.org_id}, ${session.user.id}, 
      'meeting', ${meetingId},
      ${nextcloudFile.id}, ${uploadPath}, ${nextcloudFile.url},
      ${file.name}, ${file.size}, ${file.type}
    )
  `;
  
  return Response.json({ success: true, file: nextcloudFile });
}
```

**Result**: 
- ✅ Your custom UI
- ✅ No CORS issues (server-side call)
- ✅ File lives in Nextcloud
- ✅ Reference in your database

## 🎥 Example: Video Chat - iframe Embedding

**Why iframe here?** 

Building your own WebRTC video chat is **extremely complex**:
- Video/audio encoding
- Screen sharing
- Recording
- Transcription
- Connection management
- TURN/STUN servers
- Mobile support
- Browser compatibility

Nextcloud Talk already does this perfectly!

```tsx
// apps/forum/src/components/MeetingVideoChat.tsx
'use client';

export function MeetingVideoChat({ talkToken }: { talkToken: string }) {
  return (
    <div className="video-chat-container">
      {/* Your custom header */}
      <div className="chat-header">
        <h3>Live Video Chat</h3>
        <YourCustomControls />
      </div>
      
      {/* Nextcloud Talk iframe - let them handle complex WebRTC */}
      <iframe
        src={`${process.env.NEXT_PUBLIC_NEXTCLOUD_URL}/call/${talkToken}`}
        allow="camera; microphone; display-capture"
        className="w-full h-[600px] border-0"
      />
      
      {/* Your custom footer */}
      <div className="chat-footer">
        <YourCustomChatPanel />
      </div>
    </div>
  );
}
```

## 📝 Example: Collaborative Editing - Hybrid

### Option A: iframe (Easy)
```tsx
<iframe src={`${NEXTCLOUD_URL}/apps/text/${fileId}`} />
```
- ✅ Full collaborative features immediately
- ✅ No maintenance
- ❌ Nextcloud's UI styling

### Option B: API Layer + Your Editor (Hard)
```tsx
<YourCustomEditor 
  content={content}
  onChange={handleChange}
  onSave={() => saveToNextcloud()}
/>
```
- ✅ Your custom styling
- ✅ Full control
- ❌ Must build collaborative sync yourself (complex!)
- ❌ Must handle conflicts, offline mode, etc.

## 🔐 Credential Strategy - Detailed

### 1. User Provisioning (Auto-create Nextcloud users)

```typescript
// packages/nextcloud/src/users/provision.ts
export async function provisionNextcloudUser(user: AppUser) {
  const adminClient = getAdminClient(); // Uses NEXTCLOUD_ADMIN_PASSWORD
  
  // Create Nextcloud user
  await adminClient.users.create({
    userid: user.id, // Use same ID
    password: generateSecurePassword(), // Random password
    email: user.email,
    displayName: user.display_name,
  });
  
  // Generate app password for API access
  // (more secure than using main password)
  const appPassword = await adminClient.users.generateAppPassword(user.id);
  
  // Store in YOUR database
  await db`
    UPDATE users 
    SET nextcloud_user_id = ${user.id},
        nextcloud_app_password = ${encrypt(appPassword)}, -- Encrypt it!
        nextcloud_synced = true
    WHERE id = ${user.id}
  `;
  
  return appPassword;
}
```

### 2. Session Management

```typescript
// packages/nextcloud/src/auth.ts
export async function getNextcloudSession(userId: string) {
  const user = await db`
    SELECT nextcloud_user_id, nextcloud_app_password 
    FROM users 
    WHERE id = ${userId}
  `;
  
  if (!user.nextcloud_synced) {
    // Auto-provision if not yet synced
    await provisionNextcloudUser(user);
  }
  
  return {
    username: user.nextcloud_user_id,
    password: decrypt(user.nextcloud_app_password),
  };
}
```

### 3. iframe Authentication

For iframes to work seamlessly, user must be logged into Nextcloud:

```typescript
// middleware.ts - Run on every request
export async function middleware(req: NextRequest) {
  const session = await getServerSession();
  
  if (session) {
    // Ensure user is logged into Nextcloud too
    await ensureNextcloudSession(session.user.id);
  }
  
  return NextResponse.next();
}

async function ensureNextcloudSession(userId: string) {
  const ncSession = await getNextcloudSession(userId);
  
  // Set cookie that Nextcloud will recognize
  // (This is the tricky part - might need SSO solution)
  
  // Alternative: Use Nextcloud's external auth
  // or embed with public share tokens
}
```

## 🎯 FINAL RECOMMENDATION

### For Your Grand Forum:

```typescript
// ✅ Use API Layer for:
1. File uploads/downloads (your custom UI)
2. User management (auto-provision)
3. Creating Talk rooms (programmatic)
4. Folder management (organize by org)
5. Basic operations (list, move, delete files)

// ✅ Use iframe for:
1. Video chat (Talk UI is excellent)
2. Collaborative doc editing (complex to build)
3. Calendar view (rich interactions)
4. Admin/settings pages (one-off views)

// 📦 Package Structure:
packages/nextcloud/
├── src/
│   ├── client.ts          // ← API Layer (WebDAV, OCS)
│   ├── auth.ts            // ← Credential management
│   ├── files.ts           // ← File operations API
│   ├── talk.ts            // ← Talk API + iframe helper
│   ├── users.ts           // ← User provisioning
│   └── components/
│       ├── FileUploader.tsx     // ← Your custom UI
│       ├── FileBrowser.tsx      // ← Your custom UI
│       ├── TalkEmbed.tsx        // ← iframe wrapper
│       └── TextEditor.tsx       // ← iframe wrapper
```

## 🚀 Benefits of Hybrid Approach:

1. **Best UX**: Custom UI where it matters, powerful iframes for complex features
2. **Fast Development**: Don't reinvent WebRTC/collaborative editing
3. **No CORS**: Server-side API calls via Docker network
4. **Secure**: App passwords, encrypted storage
5. **Maintainable**: Nextcloud handles complex features
6. **Flexible**: Easy to swap iframe → custom UI later if needed

## 💡 Next Steps

Want me to:
1. Build the API layer (`@elkdonis/nextcloud` package)?
2. Show you a working file upload example?
3. Create a hybrid video chat component?

The API layer gives you **full control** without the iframe limitations you're worried about! 🎯
