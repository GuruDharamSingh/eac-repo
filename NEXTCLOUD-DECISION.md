# ✅ Nextcloud Integration - Decision Summary

## 🎯 Your Vision: Seamless Embedded Experience

**What you want:**
- User clicks meeting card → video chat pops up RIGHT THERE
- Collaborative docs feel native to your apps
- Messaging, transcription, all Nextcloud features embedded seamlessly
- User never realizes they're using Nextcloud - it just works!

## ✅ Architecture Decision: **KEEP SEPARATE DOCKER STACK**

### Why This Is BETTER for Deep Integration:

**🎭 The Magic**: Separate stack = Better embedding!

1. **iframe Security** - Different origin = secure embedding with proper CORS
2. **Performance** - Nextcloud's heavy apps don't slow your UI
3. **Independence** - Update Talk/Office apps without redeploying
4. **Production Ready** - Same pattern works when pointing to external Nextcloud
5. **Resource Isolation** - Video transcoding doesn't affect your app server

### How It Works:

```
User Experience:
┌─────────────────────────────────────────┐
│  Meeting Card (your Forum app)          │
│  ┌───────────────────────────────────┐  │
│  │ 🎥 Live Video Chat                │  │  ← Nextcloud Talk embedded
│  │    [Nextcloud iframe]              │  │
│  └───────────────────────────────────┘  │
│  ┌───────────────────────────────────┐  │
│  │ 📝 Collaborative Notes             │  │  ← Nextcloud Text embedded
│  │    [Nextcloud iframe]              │  │
│  └───────────────────────────────────┘  │
│  💬 Chat Sidebar [Nextcloud iframe]     │  ← Same Talk room
└─────────────────────────────────────────┘

Behind the scenes: 3 Nextcloud features, feels like ONE app!
```

## 🏗️ Technical Setup

### Current Stack Configuration:
```
Nextcloud Stack (Port 8080)     App Stack (3000-3003)
├─ Nextcloud + Apps             ├─ Admin
├─ PostgreSQL                   ├─ Forum  
├─ Redis                        ├─ Blogs
└─ Nginx                        └─ PostgreSQL

Connected via: nextcloud-network (Docker bridge)
```

### Nextcloud Apps Installed:
- ✅ **Talk (Spreed)** - Video/audio chat + messaging
- ✅ **Text** - Collaborative markdown editor
- ✅ **Calendar** - Event scheduling
- ✅ **Deck** - Kanban project boards
- ✅ **Forms** - Surveys/registration
- ✅ **Files** - File management

### Still Need (Optional):
- **Collabora/OnlyOffice** - Full office suite (Word/Excel/PowerPoint equivalent)
- **Mail** - Email client integration
- **Whiteboard** - Visual collaboration

## 📊 Database Schema (Updated)

### Key Tables with Nextcloud Integration:

```sql
organizations (
  nextcloud_folder_id VARCHAR(255),     -- Each org has Nextcloud folder
  nextcloud_folder_path VARCHAR(500)    -- Path: /Elkdonis/Sunjay/...
)

users (
  nextcloud_user_id VARCHAR(255),       -- Linked Nextcloud account
  nextcloud_synced BOOLEAN              -- Sync status
)

meetings (
  nextcloud_file_id VARCHAR(255),       -- Meeting notes/docs
  nextcloud_talk_token VARCHAR(255),    -- Video chat room token
  nextcloud_recording_id VARCHAR(255)   -- Recording file (if recorded)
)

posts (
  nextcloud_file_id VARCHAR(255),       -- Can be collaborative doc
  nextcloud_last_sync TIMESTAMPTZ
)

media (
  nextcloud_file_id VARCHAR(255) NOT NULL,  -- ALL media in Nextcloud
  nextcloud_path VARCHAR(500) NOT NULL
)
```

## 🚀 Integration Examples

### 1. Video Chat in Meeting Card:
```tsx
<MeetingCard meeting={meeting}>
  {meeting.nextcloud_talk_token && (
    <iframe 
      src={`http://localhost:8080/call/${meeting.nextcloud_talk_token}`}
      allow="camera; microphone; display-capture"
    />
  )}
</MeetingCard>
```

### 2. Collaborative Post Editing:
```tsx
<PostEditor post={post}>
  {post.nextcloud_file_id && (
    <iframe 
      src={`http://localhost:8080/apps/text/public/${post.nextcloud_file_id}`}
    />
  )}
</PostEditor>
```

### 3. File Browser:
```tsx
<OrgFiles org={org}>
  <iframe 
    src={`http://localhost:8080/apps/files/?dir=${org.nextcloud_folder_path}`}
  />
</OrgFiles>
```

## 🔐 Authentication Flow

```
1. User logs into your app (Supabase)
   ↓
2. Auto-provision Nextcloud user (if doesn't exist)
   ↓
3. Generate Nextcloud app password
   ↓
4. Store in session
   ↓
5. Pass to iframes → user seamlessly logged in everywhere!
```

## 📋 Implementation Phases

### Phase 1: Foundation (Now) ✅
- [x] Separate Nextcloud stack running
- [x] Install collaboration apps (Talk, Calendar, Deck, Forms)
- [x] Update database schema
- [x] Document architecture

### Phase 2: Core Integration (Next)
- [ ] Create `@elkdonis/nextcloud` package
- [ ] WebDAV client for file operations
- [ ] User auto-provisioning
- [ ] Talk room creation API

### Phase 3: UI Embedding (After)
- [ ] Build React components for embedding
- [ ] Video chat in meeting cards
- [ ] Collaborative editor for posts
- [ ] File browser in org pages

### Phase 4: Bidirectional Sync
- [ ] Nextcloud webhooks → your app
- [ ] Auto-discover uploaded files
- [ ] Real-time chat sync
- [ ] Calendar → Meeting integration

## 🎯 The Result

**Users will experience:**
- Click meeting → instant video chat opens
- Edit post → collaborative editor appears
- Upload file → shows in Nextcloud AND your app
- Join chat → seamless messaging
- Schedule event → auto-creates meeting

**They'll never know it's Nextcloud** - it's just "The Grand Forum" doing its thing! 🎭

## 📚 Full Documentation

See `NEXTCLOUD-INTEGRATION.md` for complete technical details, API patterns, and implementation guides.

---

**Bottom Line**: Separate stack is PERFECT for what you want. The embedding approach gives you native-feeling integration while keeping clean architecture. Best of both worlds! ✨
