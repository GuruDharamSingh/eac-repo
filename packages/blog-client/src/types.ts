export interface BlogNavLink {
  label: string;
  href: string;
  external?: boolean;
}

export interface BlogHeroConfig {
  title: string;
  description?: string;
  ctaLabel?: string;
  ctaHref?: string;
}

export interface BlogConfig {
  orgId: string;
  orgName: string;
  orgSlug?: string;
  tagline?: string;
  navLinks?: BlogNavLink[];
  hero?: BlogHeroConfig;
  ownerEmails?: string[];
  ownerUserIds?: string[];
  ownerRoles?: Array<'guide' | 'member' | 'viewer'>;
  entryRedirectPath?: string;
  uploadPath?: string;
}

export interface UploadedMedia {
  id: string;
  fileId: string;
  path: string;
  url: string;
  filename: string;
  mimeType: string;
  size: number;
  type: 'image' | 'video' | 'audio' | 'document';
}

export interface BlogPostSubmission {
  title: string;
  body: string;
  excerpt?: string;
  link?: string;
  tags: string[];
  createForumThread: boolean;
  forumThreadTitle?: string;
  metadata?: Record<string, unknown>;
  media?: UploadedMedia[];
}
