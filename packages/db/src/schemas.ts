import { db } from './client';

/**
 * Elkdonis Arts Collective Network - Database Schema
 * Single-schema design with living content model
 */

export async function setupDatabase() {
  console.log('🔨 Setting up database...');

  await createTables();
  await seedOrganizations();

  console.log('✅ Database setup complete');
}

async function createTables() {
  console.log('📋 Creating tables...');

  // Organizations (each site/blog/space within the collective)
  await db`
    CREATE TABLE IF NOT EXISTS organizations (
      id VARCHAR(50) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(100) UNIQUE NOT NULL,
      description TEXT,
      nextcloud_folder_id VARCHAR(255),
      nextcloud_folder_path VARCHAR(500),
      nextcloud_public_share_token VARCHAR(255),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // Users
  await db`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      display_name VARCHAR(255),
      avatar_url TEXT,
      bio TEXT,
      is_admin BOOLEAN DEFAULT false,
      nextcloud_user_id VARCHAR(255),
      nextcloud_synced BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // User-Organization memberships
  await db`
    CREATE TABLE IF NOT EXISTS user_organizations (
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      org_id VARCHAR(50) REFERENCES organizations(id) ON DELETE CASCADE,
      role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('guide', 'member', 'viewer')),
      joined_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (user_id, org_id)
    )
  `;

  // Topics
  await db`
    CREATE TABLE IF NOT EXISTS topics (
      id VARCHAR(21) PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      slug VARCHAR(255) NOT NULL UNIQUE,
      description TEXT,
      parent_id VARCHAR(21) REFERENCES topics(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await db`CREATE INDEX IF NOT EXISTS idx_topics_parent ON topics(parent_id)`;

  // Meetings
  await db`
    CREATE TABLE IF NOT EXISTS meetings (
      id VARCHAR(21) PRIMARY KEY,
      org_id VARCHAR(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      guide_id UUID NOT NULL REFERENCES users(id),
      title TEXT NOT NULL,
      slug VARCHAR(255) NOT NULL,
      description TEXT,
      notes TEXT,

      -- Time fields
      scheduled_at TIMESTAMPTZ,
      time_zone VARCHAR(100),
      duration_minutes INTEGER,

      -- Location
      location TEXT,
      is_online BOOLEAN DEFAULT true,
      meeting_url TEXT,

      -- Video/Recording
      video_url TEXT,
      video_link TEXT,

      -- Recurrence
      recurrence_pattern VARCHAR(20) CHECK (recurrence_pattern IN ('DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM')),
      recurrence_custom_rule TEXT,

      -- RSVP
      is_rsvp_enabled BOOLEAN DEFAULT false,
      rsvp_deadline TIMESTAMPTZ,
      attendee_limit INTEGER,

      -- Co-hosts (stored as JSON array of user IDs)
      co_host_ids JSONB DEFAULT '[]',

      -- Notifications
      reminder_minutes_before INTEGER,

      -- Recording & Workflow
      auto_record BOOLEAN DEFAULT false,
      follow_up_workflow BOOLEAN DEFAULT false,

      -- Tags (stored as JSON array)
      tags JSONB DEFAULT '[]',

      -- Attachments (stored as JSON array of objects)
      attachments JSONB DEFAULT '[]',

      -- Status and visibility
      status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('scheduled', 'completed', 'draft', 'published', 'archived')),
      visibility VARCHAR(20) DEFAULT 'PUBLIC' CHECK (visibility IN ('PUBLIC', 'ORGANIZATION', 'INVITE_ONLY')),

      -- Nextcloud integration
      nextcloud_file_id VARCHAR(255),
      nextcloud_talk_token VARCHAR(255),
      nextcloud_recording_id VARCHAR(255),
      nextcloud_last_sync TIMESTAMPTZ,

      -- Metadata
      metadata JSONB DEFAULT '{}',

      -- Timestamps
      created_at TIMESTAMPTZ DEFAULT NOW(),
      published_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ DEFAULT NOW(),

      -- Counters
      view_count INTEGER DEFAULT 0,
      reply_count INTEGER DEFAULT 0,

      UNIQUE(org_id, slug)
    )
  `;

  await db`CREATE INDEX IF NOT EXISTS idx_meetings_org ON meetings(org_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_meetings_guide ON meetings(guide_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_meetings_status ON meetings(status)`;
  await db`CREATE INDEX IF NOT EXISTS idx_meetings_visibility ON meetings(visibility) WHERE status = 'published'`;
  await db`CREATE INDEX IF NOT EXISTS idx_meetings_published ON meetings(published_at DESC) WHERE status = 'published'`;
  await db`CREATE INDEX IF NOT EXISTS idx_meetings_scheduled ON meetings(scheduled_at) WHERE scheduled_at IS NOT NULL`;

  // Meeting topics
  await db`
    CREATE TABLE IF NOT EXISTS meeting_topics (
      meeting_id VARCHAR(21) REFERENCES meetings(id) ON DELETE CASCADE,
      topic_id VARCHAR(21) REFERENCES topics(id) ON DELETE CASCADE,
      PRIMARY KEY (meeting_id, topic_id)
    )
  `;

  // Meeting attendees
  await db`
    CREATE TABLE IF NOT EXISTS meeting_attendees (
      meeting_id VARCHAR(21) REFERENCES meetings(id) ON DELETE CASCADE,
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      attendance_status VARCHAR(20) DEFAULT 'registered' 
        CHECK (attendance_status IN ('registered', 'attended', 'absent')),
      registered_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (meeting_id, user_id)
    )
  `;

  await db`CREATE INDEX IF NOT EXISTS idx_attendees_meeting ON meeting_attendees(meeting_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_attendees_user ON meeting_attendees(user_id)`;

  // Posts
  await db`
    CREATE TABLE IF NOT EXISTS posts (
      id VARCHAR(21) PRIMARY KEY,
      org_id VARCHAR(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      author_id UUID NOT NULL REFERENCES users(id),
      title TEXT NOT NULL,
      slug VARCHAR(255) NOT NULL,
      body TEXT,
      excerpt TEXT,
      status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
      visibility VARCHAR(20) DEFAULT 'PUBLIC' CHECK (visibility IN ('PUBLIC', 'ORGANIZATION', 'INVITE_ONLY')),
      nextcloud_file_id VARCHAR(255),
      nextcloud_last_sync TIMESTAMPTZ,
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      published_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      view_count INTEGER DEFAULT 0,
      reply_count INTEGER DEFAULT 0,
      UNIQUE(org_id, slug)
    )
  `;

  await db`CREATE INDEX IF NOT EXISTS idx_posts_org ON posts(org_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_posts_author ON posts(author_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status)`;
  await db`CREATE INDEX IF NOT EXISTS idx_posts_visibility ON posts(visibility) WHERE status = 'published'`;
  await db`CREATE INDEX IF NOT EXISTS idx_posts_published ON posts(published_at DESC) WHERE status = 'published'`;

  // Post topics
  await db`
    CREATE TABLE IF NOT EXISTS post_topics (
      post_id VARCHAR(21) REFERENCES posts(id) ON DELETE CASCADE,
      topic_id VARCHAR(21) REFERENCES topics(id) ON DELETE CASCADE,
      PRIMARY KEY (post_id, topic_id)
    )
  `;

  // Replies
  await db`
    CREATE TABLE IF NOT EXISTS replies (
      id VARCHAR(21) PRIMARY KEY,
      parent_type VARCHAR(20) NOT NULL CHECK (parent_type IN ('meeting', 'post', 'reply')),
      parent_id VARCHAR(21) NOT NULL,
      user_id UUID NOT NULL REFERENCES users(id),
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await db`CREATE INDEX IF NOT EXISTS idx_replies_parent ON replies(parent_type, parent_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_replies_user ON replies(user_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_replies_created ON replies(created_at DESC)`;

  // Media
  await db`
    CREATE TABLE IF NOT EXISTS media (
      id VARCHAR(21) PRIMARY KEY,
      org_id VARCHAR(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      uploaded_by UUID NOT NULL REFERENCES users(id),
      attached_to_type VARCHAR(20) CHECK (attached_to_type IN ('meeting', 'post')),
      attached_to_id VARCHAR(21),
      nextcloud_file_id VARCHAR(255) NOT NULL,
      nextcloud_path VARCHAR(500) NOT NULL,
      url TEXT NOT NULL,
      type VARCHAR(20) CHECK (type IN ('image', 'video', 'audio', 'document')),
      filename VARCHAR(255),
      size_bytes INTEGER,
      mime_type VARCHAR(100),
      caption TEXT,
      alt_text TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      CHECK (
        (attached_to_type IS NOT NULL AND attached_to_id IS NOT NULL) OR
        (attached_to_type IS NULL AND attached_to_id IS NULL)
      )
    )
  `;

  await db`CREATE INDEX IF NOT EXISTS idx_media_attached ON media(attached_to_type, attached_to_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_media_org ON media(org_id)`;

  // Events (activity log)
  await db`
    CREATE TABLE IF NOT EXISTS events (
      id VARCHAR(21) PRIMARY KEY,
      org_id VARCHAR(50) REFERENCES organizations(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id),
      action VARCHAR(50) NOT NULL,
      resource_type VARCHAR(50),
      resource_id VARCHAR(21),
      data JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await db`CREATE INDEX IF NOT EXISTS idx_events_org ON events(org_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_events_user ON events(user_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at DESC)`;

  console.log('✅ Tables created');
}

async function seedOrganizations() {
  console.log('🌱 Seeding organizations...');

  const orgs = [
    {
      id: 'elkdonis',
      name: 'Elkdonis Arts Collective',
      slug: 'elkdonis',
      description: 'Central admin hub for the collective'
    },
    {
      id: 'inner_group',
      name: 'InnerGathering',
      slug: 'inner-gathering',
      description: 'Mobile-first community for spiritual gatherings and connection'
    },
    {
      id: 'sunjay',
      name: "Sunjay's Teaching Circle",
      slug: 'sunjay',
      description: 'Inner teaching organization led by Sunjay'
    },
    {
      id: 'guru-dharam',
      name: "Guru Dharam's Practice Group",
      slug: 'guru-dharam',
      description: 'Spiritual practice and teachings'
    }
  ];

  for (const org of orgs) {
    await db`
      INSERT INTO organizations (id, name, slug, description)
      VALUES (${org.id}, ${org.name}, ${org.slug}, ${org.description})
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description
    `;
  }

  // Seed example topics
  const topics = [
    { id: 'yung-drung-bon', name: 'Yung Drung Bon', slug: 'yung-drung-bon', description: 'Ancient Tibetan spiritual tradition' },
    { id: 'fourthway', name: 'Fourth Way', slug: 'fourthway', description: 'Gurdjieff teachings and practices' },
    { id: 'meditation', name: 'Meditation', slug: 'meditation', description: 'Contemplative practices' },
    { id: 'ritual', name: 'Ritual & Ceremony', slug: 'ritual', description: 'Sacred practices and ceremonies' }
  ];

  for (const topic of topics) {
    await db`
      INSERT INTO topics (id, name, slug, description)
      VALUES (${topic.id}, ${topic.name}, ${topic.slug}, ${topic.description})
      ON CONFLICT (id) DO NOTHING
    `;
  }

  console.log('✅ Organizations and topics seeded');
}