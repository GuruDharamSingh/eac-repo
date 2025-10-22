# Nextcloud Collaborative Document Integration

## Overview
Meetings can now have collaborative documents attached that allow real-time collaborative editing through Nextcloud's Text app, embedded directly in the application via iframe.

## How It Works

### 1. Document Creation
When creating a meeting, users can check the "Create a living document" option. This:
- Creates a markdown file in `EAC-Network/{orgId}/Media/Documents/`
- Creates a **public share with edit permissions** (permissions=15)
- Returns a share token that allows anonymous collaborative editing

### 2. Public Share with Edit Permissions
```typescript
// Permission levels:
// 1 = read-only
// 15 = read + write + create + delete (full collaborative editing)
const shareToken = await createPublicShare(path, 15);
```

### 3. Embedding in iframe
The DocumentViewer component embeds Nextcloud's Text app:
```typescript
// For collaborative editing:
const embedUrl = `http://localhost:8080/apps/text/s/{shareToken}`;

// Or just viewing:
const viewUrl = `http://localhost:8080/s/{shareToken}`;
```

### 4. URLs Generated
- **fileId**: Nextcloud's internal file identifier
- **url**: Public view URL (`/s/{shareToken}`)
- **editUrl**: Text app collaborative editor URL (`/apps/text/s/{shareToken}`)
- **shareToken**: Token for public access

## Components

### DocumentViewer
```tsx
import { DocumentViewer } from '@elkdonis/ui';

<DocumentViewer
  shareToken="abc123xyz"
  mode="edit"  // or "view"
  height="600px"
  title="Meeting Notes"
/>
```

### DocumentLink
```tsx
import { DocumentLink } from '@elkdonis/ui';

<DocumentLink
  documentUrl="http://localhost:8080/apps/text/s/abc123xyz"
  title="Living Document"
/>
```

## Database Schema
```sql
ALTER TABLE meetings ADD COLUMN nextcloud_file_id VARCHAR(255);
ALTER TABLE meetings ADD COLUMN video_url TEXT;  -- Repurposed for document URL
ALTER TABLE meetings ADD COLUMN document_share_token VARCHAR(255);
```

## API Endpoints

### POST `/api/create-document`
Creates a collaborative document for a meeting.

**Request:**
```json
{
  "orgId": "inner_group",
  "meetingTitle": "Weekly Meditation",
  "meetingId": "meeting_123"
}
```

**Response:**
```json
{
  "success": true,
  "fileId": "12345",
  "url": "http://localhost:8080/s/abc123xyz",
  "editUrl": "http://localhost:8080/apps/text/s/abc123xyz",
  "shareToken": "abc123xyz"
}
```

## Features

### Real-time Collaboration
- Multiple users can edit simultaneously
- Changes sync in real-time via Nextcloud Text
- No authentication required (public share with edit permissions)
- Works across devices

### Markdown Support
- Full markdown syntax support
- Preview mode available
- Collaborative cursor tracking
- Comment support (if Nextcloud Text supports it)

### Iframe Integration
- Embedded directly in your app
- No need to navigate to Nextcloud
- Seamless user experience
- Responsive design

## Security Considerations

### Public Shares with Edit Access
- Anyone with the share token can edit
- Consider for PUBLIC meetings only
- For ORGANIZATION/INVITE_ONLY meetings, you may want:
  - Read-only public shares (permissions=1)
  - Authenticated access only
  - Separate edit permissions

### Recommended Permissions by Visibility
```typescript
const permissions = {
  PUBLIC: 15,           // Full edit access
  ORGANIZATION: 1,      // Read-only, auth required
  INVITE_ONLY: 1,       // Read-only, auth required
};
```

## Usage Example

### Creating a Meeting with Document
```tsx
const formData = {
  title: "Weekly Meditation",
  createDocument: true,  // ← Enable document creation
  // ... other meeting fields
};

// API creates document and saves shareToken to database
```

### Displaying in Meeting Card
```tsx
{meeting.documentShareToken && (
  <DocumentViewer
    shareToken={meeting.documentShareToken}
    mode="edit"
    title={`${meeting.title} - Living Document`}
  />
)}
```

## Nextcloud Requirements

### Required Apps
- **Nextcloud Text**: Core collaborative editing app
- **Files**: Core file management

### Configuration
- Public link sharing must be enabled
- Text app should support iframe embedding
- CORS settings may need adjustment for cross-origin embedding

### Potential Issues
- **X-Frame-Options**: Nextcloud may block iframe embedding
  - Solution: Configure `X-Frame-Options` to allow your domain
  - Or use `Content-Security-Policy: frame-ancestors 'self' http://localhost:3004`

- **CORS**: Cross-origin requests may be blocked
  - Solution: Configure CORS headers in Nextcloud

## Future Enhancements

1. **Permission Management**: Dynamic permissions based on meeting visibility
2. **Version History**: Track document changes over time
3. **Comment Integration**: Link meeting comments to document
4. **Export Options**: PDF, HTML export
5. **Template Support**: Pre-filled meeting templates
6. **Offline Support**: Local editing with sync
