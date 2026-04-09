# @elkdonis/ui

Shared Mantine UI components for all blog apps in the EAC network.

## Components

### BlogEntryForm

Complete form for creating blog entries with rich text, media uploads, tags, and forum integration.

```tsx
import { BlogEntryForm, BlogEntryFormData } from '@elkdonis/ui';

export default function EntryPage() {
  async function handleSubmit(data: BlogEntryFormData) {
    'use server';
    // Save to database
    // Upload media to Nextcloud
    // Log event
  }

  return (
    <BlogEntryForm
      onSubmit={handleSubmit}
      orgName="Sunjay's Blog"
      submitLabel="Publish"
    />
  );
}
```

**Features:**
- Title input
- Rich text editor (TipTap with Mantine)
- Media upload (drag & drop with preview)
- Link field
- Tags input
- Forum thread creation option
  - Toggle to create forum thread
  - Custom forum thread title

### MediaUpload

Drag-and-drop file upload with previews.

```tsx
import { MediaUpload } from '@elkdonis/ui';

const [files, setFiles] = useState<File[]>([]);

<MediaUpload
  files={files}
  onChange={setFiles}
  maxFiles={5}
  maxSize={10} // MB
/>
```

### RichTextEditor

Mantine TipTap editor with common formatting options.

```tsx
import { RichTextEditor } from '@elkdonis/ui';

const [content, setContent] = useState('');

<RichTextEditor
  content={content}
  onChange={setContent}
  placeholder="Start writing..."
/>
```

## Installation

This package is part of the monorepo and automatically available to all apps.

Make sure to include Mantine providers in your app layout:

```tsx
import '@mantine/core/styles.css';
import '@mantine/tiptap/styles.css';
import '@mantine/dropzone/styles.css';
import { MantineProvider } from '@mantine/core';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <MantineProvider>
          {children}
        </MantineProvider>
      </body>
    </html>
  );
}
```

## Form Data Structure

```typescript
interface BlogEntryFormData {
  title: string;
  body: string; // HTML from rich text editor
  excerpt?: string; // Optional preview text
  link?: string; // Optional external URL
  tags: string[];
  media: File[];
  createForumThread: boolean;
  forumThreadTitle?: string; // Custom title or use post title
}
```