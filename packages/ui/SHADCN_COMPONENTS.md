# shadcn/ui Components in @elkdonis/ui

Comprehensive UI components from shadcn/ui, shared across all apps in the monorepo.

## Installation Complete ✅

All components are now available in `@elkdonis/ui` package and can be imported by any app.

---

## Available Components

### 1. **Navbar05** - Dashboard Navigation Bar

**Path**: `@elkdonis/ui/shadcn/shadcn-io/navbar-05`

**Description**: Full-featured navigation bar with mobile responsive hamburger menu, user dropdown, notifications, and help menu.

**Features**:
- Mobile hamburger menu with smooth animation
- User avatar dropdown (profile, settings, billing, logout)
- Notification dropdown with badge count
- Help/info menu
- Responsive breakpoints
- Customizable logo and navigation links

**Usage**:
```tsx
import { Navbar05 } from '@elkdonis/ui/shadcn/shadcn-io/navbar-05';

<Navbar05
  userName="John Doe"
  userEmail="john@example.com"
  userAvatar="/avatar.jpg"
  notificationCount={3}
  navigationLinks={[
    { href: '/forum', label: 'Forum' },
    { href: '/meetings', label: 'Meetings' },
  ]}
  onUserItemClick={(item) => {
    if (item === 'logout') handleLogout();
  }}
/>
```

**Props**:
- `logo?: ReactNode` - Custom logo component
- `logoHref?: string` - Logo link destination
- `navigationLinks?: { href: string; label: string }[]` - Nav menu items
- `userName?: string` - Display name
- `userEmail?: string` - User email
- `userAvatar?: string` - Avatar image URL
- `notificationCount?: number` - Badge count
- `onNavItemClick?: (href: string) => void` - Nav click handler
- `onUserItemClick?: (item: string) => void` - User menu click handler

---

### 2. **MinimalTiptap** - Rich Text Editor

**Path**: `@elkdonis/ui/shadcn/shadcn-io/minimal-tiptap`

**Description**: Clean, minimal rich text editor built on Tiptap with essential formatting tools.

**Features**:
- Bold, italic, strike, code formatting
- Headings (H1, H2, H3)
- Lists (bullet, ordered)
- Blockquotes
- Horizontal rules
- Undo/redo
- Customizable placeholder
- Controlled/uncontrolled modes

**Usage**:
```tsx
import { MinimalTiptap } from '@elkdonis/ui/shadcn/shadcn-io/minimal-tiptap';

<MinimalTiptap
  content={initialContent}
  onChange={(html) => setContent(html)}
  placeholder="Start writing..."
  editable={true}
/>
```

**Props**:
- `content?: string` - Initial HTML content
- `onChange?: (content: string) => void` - Content change callback
- `placeholder?: string` - Empty state text
- `editable?: boolean` - Enable/disable editing
- `className?: string` - Additional CSS classes

**Use Cases**:
- Post/reply composition
- Meeting notes
- Rich text fields
- Comment editing

---

### 3. **Table** - Advanced Data Table

**Path**: `@elkdonis/ui/shadcn/shadcn-io/table`

**Description**: Powerful table component built on TanStack Table with sorting, powered by Jotai for state management.

**Features**:
- Column sorting (asc/desc)
- Sortable headers with dropdown
- Type-safe with TypeScript
- Composable API (TableProvider, TableHeader, TableBody, etc.)
- State management via Jotai atoms
- Empty state handling

**Usage**:
```tsx
import {
  TableProvider,
  TableHeader,
  TableHeaderGroup,
  TableHead,
  TableColumnHeader,
  TableBody,
  TableRow,
  TableCell,
  type ColumnDef,
} from '@elkdonis/ui/shadcn/shadcn-io/table';

const columns: ColumnDef<Post>[] = [
  {
    accessorKey: 'title',
    header: ({ column }) => (
      <TableColumnHeader column={column} title="Title" />
    ),
  },
  {
    accessorKey: 'author',
    header: 'Author',
  },
];

<TableProvider columns={columns} data={posts}>
  <TableHeader>
    {({ headerGroup }) => (
      <TableHeaderGroup headerGroup={headerGroup}>
        {({ header }) => <TableHead header={header} />}
      </TableHeaderGroup>
    )}
  </TableHeader>
  <TableBody>
    {({ row }) => (
      <TableRow row={row}>
        {({ cell }) => <TableCell cell={cell} />}
      </TableRow>
    )}
  </TableBody>
</TableProvider>
```

**Use Cases**:
- Admin panels (user lists, content moderation)
- Data dashboards
- Sortable content lists
- Report tables

---

### 4. **List** - Draggable List Component

**Path**: `@elkdonis/ui/shadcn/shadcn-io/list`

**Description**: Drag-and-drop list component built with dnd-kit for reordering items.

**Features**:
- Drag-and-drop reordering
- Touch support (mobile)
- Keyboard navigation
- Accessibility announcements
- Smooth animations
- Customizable item rendering

**Usage**:
```tsx
import { List } from '@elkdonis/ui/shadcn/shadcn-io/list';

<List
  items={items}
  onReorder={(newItems) => setItems(newItems)}
  renderItem={(item) => (
    <div className="p-4 bg-white border rounded">
      {item.title}
    </div>
  )}
/>
```

**Use Cases**:
- Priority lists
- Todo reordering
- Navigation menu builder
- Content ordering

---

### 5. **Kanban** - Kanban Board

**Path**: `@elkdonis/ui/shadcn/shadcn-io/kanban`

**Description**: Full-featured kanban board with drag-and-drop between columns.

**Features**:
- Multi-column layout
- Drag cards between columns
- Drag overlay preview
- Touch/mouse/keyboard support
- Accessibility announcements
- Auto-scroll on drag
- Customizable columns and cards

**Usage**:
```tsx
import {
  KanbanProvider,
  KanbanBoard,
  KanbanHeader,
  KanbanCards,
  KanbanCard,
} from '@elkdonis/ui/shadcn/shadcn-io/kanban';

const columns = [
  { id: 'todo', name: 'To Do' },
  { id: 'in_progress', name: 'In Progress' },
  { id: 'done', name: 'Done' },
];

const data = [
  { id: '1', name: 'Task 1', column: 'todo' },
  { id: '2', name: 'Task 2', column: 'in_progress' },
];

<KanbanProvider
  columns={columns}
  data={data}
  onDataChange={(newData) => setData(newData)}
>
  {(column) => (
    <KanbanBoard id={column.id}>
      <KanbanHeader>{column.name}</KanbanHeader>
      <KanbanCards id={column.id}>
        {(item) => (
          <KanbanCard key={item.id} {...item}>
            {item.name}
          </KanbanCard>
        )}
      </KanbanCards>
    </KanbanBoard>
  )}
</KanbanProvider>
```

**Use Cases**:
- Project management
- Content workflow (draft → review → published)
- Task tracking
- Moderation queue

---

## Core UI Components

These are the base shadcn/ui components used by the above:

- **Button** - `@elkdonis/ui/shadcn/button`
- **Card** - `@elkdonis/ui/shadcn/card`
- **Select** - `@elkdonis/ui/shadcn/select`
- **DropdownMenu** - `@elkdonis/ui/shadcn/dropdown-menu`
- **Badge** - `@elkdonis/ui/shadcn/badge`
- **Avatar** - `@elkdonis/ui/shadcn/avatar`
- **Separator** - `@elkdonis/ui/shadcn/separator`
- **Textarea** - `@elkdonis/ui/shadcn/textarea`
- **NavigationMenu** - `@elkdonis/ui/shadcn/navigation-menu`
- **Popover** - `@elkdonis/ui/shadcn/popover`
- **ScrollArea** - `@elkdonis/ui/shadcn/scroll-area`
- **Toggle** - `@elkdonis/ui/shadcn/toggle`
- **Table** (base) - `@elkdonis/ui/shadcn/table`

---

## Utility Functions

### cn() - Class Name Merger

**Path**: `@elkdonis/ui/lib/utils`

Combines `clsx` and `tailwind-merge` for optimal className handling.

```tsx
import { cn } from '@elkdonis/ui/lib/utils';

<div className={cn('p-4 bg-white', isActive && 'bg-blue-50', className)} />
```

---

## Forum-Specific Component Recommendations

### For Forum Feed Page:
- **Navbar05** - Top navigation with user menu
- **Button** - Sort/filter controls
- **Badge** - Org tags, topic pills
- **Avatar** - User avatars in thread list
- **Card** - Thread list items

### For Thread Detail Page:
- **Navbar05** - Same top nav
- **MinimalTiptap** - Reply composer
- **Avatar** - Author + reply authors
- **Button** - React, watch, bookmark actions
- **DropdownMenu** - More actions menu
- **Badge** - Reaction counts, status indicators
- **Separator** - Between sections

### For Admin Panel:
- **Table** - User list, content moderation queue
- **Kanban** - Moderation workflow (pending → approved → rejected)
- **DropdownMenu** - Bulk actions
- **Badge** - Flag counts, status

---

## Migration from Mantine

The UI package now supports **both** Mantine and shadcn components:

**Mantine components** (existing):
- Located in `@elkdonis/ui/components/`
- Used by inner-gathering app

**shadcn components** (new):
- Located in `@elkdonis/ui/shadcn/`
- Used by forum app (and can be used by other apps)

**Approach**: Gradually migrate to shadcn as needed. No rush to replace working Mantine components.

---

## Styling

All shadcn components use **Tailwind CSS** with CSS variables for theming.

**Theme configuration** is in each app's `globals.css`:
- Light/dark mode support
- Customizable color palette (--primary, --secondary, etc.)
- Consistent border radius (--radius)

**Each app** can customize the theme independently while using the same shared components.

---

## Building the Package

After adding or modifying components:

```bash
cd packages/ui
pnpm build
```

This compiles TypeScript and bundles components for use by apps.

---

## Next Steps

1. **Build forum feed UI** using:
   - Navbar05 for top nav
   - Card for thread items
   - Button/Badge for controls

2. **Build thread detail UI** using:
   - MinimalTiptap for reply forms
   - Nested reply component (to be built)
   - Avatar/Badge for metadata

3. **Admin dashboard** using:
   - Table for user/content lists
   - Kanban for moderation workflow

---

Built with ❤️ for Elkdonis Arts Collective
