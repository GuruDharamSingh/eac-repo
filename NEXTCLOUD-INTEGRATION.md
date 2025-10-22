# Nextcloud Deep Integration Architecture

## 🎯 Vision: Seamless Embedded Experience

**Goal**: Users interact with Nextcloud features (video chat, docs, messaging) **natively within your apps** - they never know they're using Nextcloud!

## Architecture Decision: **KEEP SEPARATE STACK** ✅

**Why separate is BETTER for deep integration:**

### ✅ Advantages of Separate Stack:
1. **iframe Embedding** - Nextcloud runs on different origin, perfect for security
2. **Independent Scaling** - Nextcloud resource-heavy apps don't affect your app performance  
3. **Isolated Updates** - Update Talk/Office apps without redeploying your apps
4. **Clean API Boundary** - Forces proper API design between systems
5. **Production Ready** - Can point to external Nextcloud instance later

### 🔄 How Deep Integration Works:

```
┌─────────────────────────────────────────────────────────┐
│                    USER EXPERIENCE                       │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  👤 User visits Meeting Card in Forum App                │
│  ↓                                                        │
│  🎥 Clicks "Join Video Chat"                             │
│  ↓                                                        │
│  📹 Nextcloud Talk embedded DIRECTLY in page             │
│  ↓                                                        │
│  💬 Chat sidebar appears (same Nextcloud Talk room)      │
│  ↓                                                        │
│  📝 "View Notes" opens Nextcloud Text editor inline      │
│  ↓                                                        │
│  📊 Collaborative notes with real-time editing           │
│                                                           │
│  ✨ User thinks it's all ONE integrated platform!        │
└─────────────────────────────────────────────────────────┘
```

## 🏗️ Technical Architecture

### Stack Configuration:

```
CURRENT (Recommended):
┌──────────────────────────────────────────────────────┐
│                  nextcloud-network                    │
├──────────────────────────────────────────────────────┤
│                                                        │
│  📦 Nextcloud Stack          📦 App Stack             │
│  (Port 8080)                 (Ports 3000-3003)        │
│                                                        │
│  ├─ Nextcloud (FPM)         ├─ Admin App              │
│  ├─ Nginx                   ├─ Forum App              │
│  ├─ PostgreSQL              ├─ Blog Apps              │
│  ├─ Redis                   ├─ PostgreSQL             │
│  └─ [Future: TURN server]   └─ Redis                  │
│                                                        │
│  Your apps embed Nextcloud features via:              │
│  • iframe for UI components                           │
│  • WebDAV API for file operations                     │
│  • OCS API for app integration                        │
│  • Direct Talk API for chat/video                     │
│                                                        │
└──────────────────────────────────────────────────────┘
```

## 🎬 Integration Patterns

### 1. **Video Chat (Nextcloud Talk)**
```typescript
// Meeting card component
<MeetingCard meeting={meeting}>
  {meeting.has_talk_room && (
    <NextcloudTalkEmbed 
      roomToken={meeting.talk_room_token}
      embedded={true}
      hideNavigation={true}
    />
  )}
</MeetingCard>

// Renders as:
<iframe 
  src="http://localhost:8080/call/{token}?embed=true"
  allow="camera; microphone; display-capture"
/>
```

### 2. **Collaborative Documents (Nextcloud Text)**
```typescript
// Post editing component  
<PostEditor post={post}>
  {post.nextcloud_file_id && (
    <NextcloudTextEditor
      fileId={post.nextcloud_file_id}
      collaborative={true}
    />
  )}
</PostEditor>

// Renders as:
<iframe 
  src="http://localhost:8080/apps/text/public/{fileId}?embed=true"
/>
```

### 3. **File Browser**
```typescript
// Organization files view
<OrgFileManager org={org}>
  <NextcloudFiles
    folderId={org.nextcloud_folder_id}
    showUpload={true}
    onFileSelect={handleFileAttach}
  />
</OrgFileManager>
```

### 4. **Direct Messaging**
```typescript
// User DM sidebar
<ChatSidebar user={user}>
  <NextcloudTalkChat
    conversationToken={user.dm_token}
    compact={true}
  />
</ChatSidebar>
```

## 📋 Required Nextcloud Apps

### Already Installed:
- ✅ **Files** - File management
- ✅ **Text** - Collaborative markdown editor
- ✅ **Talk (Spreed)** - Video/audio chat + messaging

### To Install:
```bash
# Office suite (choose one):
docker exec -u 82 nextcloud-app php occ app:install richdocuments  # Collabora
# OR
docker exec -u 82 nextcloud-app php occ app:install onlyoffice     # OnlyOffice

# Productivity apps:
docker exec -u 82 nextcloud-app php occ app:install calendar       # Events
docker exec -u 82 nextcloud-app php occ app:install deck           # Kanban boards
docker exec -u 82 nextcloud-app php occ app:install forms          # Surveys/Forms
docker exec -u 82 nextcloud-app php occ app:install mail           # Email client
```

## 🗄️ Database Schema Updates

### Updated Schema (already modified):

```sql
-- Organizations - each has Nextcloud folder
CREATE TABLE organizations (
  nextcloud_folder_id VARCHAR(255),      -- Nextcloud folder ID
  nextcloud_folder_path VARCHAR(500),    -- Path: /Elkdonis/Sunjay
  ...
);

-- Users - linked to Nextcloud accounts  
CREATE TABLE users (
  nextcloud_user_id VARCHAR(255),        -- Nextcloud username
  nextcloud_synced BOOLEAN,              -- Sync status
  ...
);

-- Meetings - can have Talk rooms + collaborative docs
CREATE TABLE meetings (
  nextcloud_file_id VARCHAR(255),        -- Meeting notes file
  nextcloud_talk_token VARCHAR(255),     -- Video chat room [NEW]
  nextcloud_recording_id VARCHAR(255),   -- Recording file [NEW]
  ...
);

-- Posts - can be collaborative documents
CREATE TABLE posts (
  nextcloud_file_id VARCHAR(255),        -- Collaborative doc
  nextcloud_last_sync TIMESTAMPTZ,       -- Sync timestamp
  ...
);

-- Media - ALL files live in Nextcloud
CREATE TABLE media (
  nextcloud_file_id VARCHAR(255) NOT NULL,
  nextcloud_path VARCHAR(500) NOT NULL,   -- Full path in Nextcloud
  ...
);
```

### Additional Tables Needed:

```sql
-- Nextcloud Talk Rooms (for video/chat)
CREATE TABLE talk_rooms (
  id VARCHAR(21) PRIMARY KEY,
  meeting_id VARCHAR(21) REFERENCES meetings(id),
  talk_token VARCHAR(255) NOT NULL UNIQUE,     -- Nextcloud room token
  room_name VARCHAR(255),
  room_type VARCHAR(20),                        -- 'video', 'chat', 'group'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Nextcloud Webhooks (for bidirectional sync)
CREATE TABLE nextcloud_webhooks (
  id VARCHAR(21) PRIMARY KEY,
  event_type VARCHAR(50),                       -- 'file.created', 'talk.message'
  resource_id VARCHAR(255),                     -- Nextcloud resource ID
  processed BOOLEAN DEFAULT false,
  payload JSONB,
  received_at TIMESTAMPTZ DEFAULT NOW()
);
```

## 🔌 Integration Package Structure

```
packages/nextcloud/
├── src/
│   ├── index.ts                 # Main exports
│   ├── client.ts                # WebDAV/OCS client
│   ├── talk/
│   │   ├── rooms.ts             # Create/manage Talk rooms
│   │   ├── chat.ts              # Send/receive messages  
│   │   └── embed.tsx            # React embed components
│   ├── files/
│   │   ├── upload.ts            # File operations
│   │   ├── webdav.ts            # WebDAV client
│   │   └── browser.tsx          # File browser component
│   ├── text/
│   │   ├── editor.ts            # Text API integration
│   │   └── collaborative.tsx    # Collaborative editor embed
│   ├── users/
│   │   ├── provision.ts         # Auto-create Nextcloud users
│   │   └── sync.ts              # Keep users in sync
│   └── webhooks/
│       ├── receiver.ts          # Handle Nextcloud events
│       └── processor.ts         # Process webhooks
└── package.json
```

## 🔐 Authentication Strategy

### Single Sign-On (SSO) Flow:

```typescript
// When user logs into your app (Supabase Auth)
1. User authenticates → Supabase creates session
2. Your app checks if nextcloud_user_id exists
3. If not → Auto-provision Nextcloud user (same credentials)
4. Generate Nextcloud app password for this session
5. Store in session → use for all Nextcloud API calls
6. Nextcloud iframe uses same session → seamless!
```

### Implementation:
```typescript
// packages/nextcloud/src/users/provision.ts
export async function provisionNextcloudUser(user: User) {
  const client = getNextcloudClient();
  
  // Create Nextcloud user
  await client.users.create({
    userid: user.id,
    password: generateSecurePassword(),
    email: user.email,
    displayName: user.display_name
  });
  
  // Generate app password for API access
  const appPassword = await client.users.generateAppPassword(user.id);
  
  // Update your database
  await db`
    UPDATE users 
    SET nextcloud_user_id = ${user.id},
        nextcloud_synced = true
    WHERE id = ${user.id}
  `;
  
  return appPassword;
}
```

## 🚀 Deployment Considerations

### Development (Current):
```yaml
# docker-compose.yml (Nextcloud stack)
services:
  nextcloud:
    environment:
      - TRUSTED_DOMAINS=localhost:8080 localhost:3000 localhost:3001 localhost:3002 localhost:3003
      - OVERWRITEPROTOCOL=http
      - OVERWRITEHOST=localhost:8080
```

### Production (Future):
```yaml
# Point to production Nextcloud
NEXTCLOUD_URL=https://cloud.elkdonis.com
NEXTCLOUD_API_KEY=<admin-app-password>

# Apps embed via:
<iframe src="https://cloud.elkdonis.com/call/{token}" />
```

## 📝 Next Steps

### Phase 1: Foundation (This Session)
- [x] Schema updates (folder paths, sync flags)
- [ ] Install required Nextcloud apps (Talk, Office suite)
- [ ] Create `@elkdonis/nextcloud` package
- [ ] Build WebDAV client for file operations

### Phase 2: Core Integration  
- [ ] User auto-provisioning on signup
- [ ] File upload → Nextcloud → database record
- [ ] Embed file browser in apps
- [ ] Create Talk rooms for meetings

### Phase 3: Rich Features
- [ ] Embedded video chat in meeting cards
- [ ] Collaborative document editing
- [ ] Real-time chat sidebar
- [ ] Webhook processing for bidirectional sync

### Phase 4: Advanced
- [ ] Nextcloud Calendar → Meeting scheduling
- [ ] Nextcloud Mail → Notifications
- [ ] Nextcloud Forms → Registration/RSVP
- [ ] Nextcloud Deck → Project management per org

## 🎨 UI/UX Design Patterns

### Seamless Embedding:
```tsx
// Meeting page - everything embedded
<MeetingPage meeting={meeting}>
  
  {/* Video chat loads INLINE */}
  <VideoSection>
    <NextcloudTalkEmbed token={meeting.talk_token} />
  </VideoSection>

  {/* Collaborative notes right beside video */}
  <NotesSection>
    <NextcloudTextEditor fileId={meeting.nextcloud_file_id} />
  </NotesSection>

  {/* Chat sidebar from same Talk room */}
  <ChatSidebar>
    <TalkChat token={meeting.talk_token} />
  </ChatSidebar>

  {/* Shared files from meeting folder */}
  <FilesSection>
    <NextcloudFiles folder={meeting.folder_path} />
  </FilesSection>
</MeetingPage>
```

**User sees**: One unified interface
**Under the hood**: 4 Nextcloud features embedded seamlessly!

## 🔄 Bidirectional Sync Strategy

### App → Nextcloud:
- User uploads file in app → WebDAV → Nextcloud
- User creates meeting → Create Talk room → Store token
- User edits post → Update Nextcloud Text file

### Nextcloud → App:
- User uploads to org folder → Webhook → Create media record
- Talk message sent → Webhook → Show in app notifications  
- File shared → Webhook → Update permissions in app

### Webhook Endpoint:
```typescript
// apps/admin/src/app/api/webhooks/nextcloud/route.ts
export async function POST(req: Request) {
  const webhook = await req.json();
  
  // Store for processing
  await db`
    INSERT INTO nextcloud_webhooks (event_type, resource_id, payload)
    VALUES (${webhook.type}, ${webhook.id}, ${webhook})
  `;
  
  // Process async
  await processWebhook(webhook);
  
  return new Response('OK');
}
```

## 🎯 Summary

**ANSWER: Keep separate stack** - it's actually BETTER for deep integration!

**You can absolutely have**:
- ✅ Video chat embedded in meeting cards
- ✅ Collaborative docs that feel native
- ✅ File browsers integrated in your UI
- ✅ Real-time messaging sidebars
- ✅ All Nextcloud apps presented seamlessly

**The separate stack gives you:**
- Better performance isolation
- Easier maintenance and updates  
- Production-ready architecture
- Security through proper boundaries
- Ability to scale independently

**Users will NEVER know they're using Nextcloud** - they'll just see one beautiful, integrated Grand Forum platform! 🎭
