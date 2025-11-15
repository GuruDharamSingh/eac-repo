import type { BlogConfig } from '@elkdonis/blog-client';

const ownerEmail =
  process.env.NEXT_PUBLIC_BLOG_GURU_DHARAM_OWNER_EMAIL ?? 'gurudharamsingh@gmail.com';
const ownerUserId = process.env.NEXT_PUBLIC_BLOG_GURU_DHARAM_OWNER_ID;

export const blogConfig: BlogConfig = {
  orgId: 'guru-dharam',
  orgName: "Guru Dharam's Practice Group",
  orgSlug: 'blog-guru-dharam',
  tagline: 'Teachings, practices, and reflections',
  navLinks: [
    { label: 'Home', href: '/' },
    { label: 'New Entry', href: '/entry' },
    { label: 'Admin', href: '/admin' },
  ],
  hero: {
    title: 'Wisdom teachings and guided practices from Guru Dharam',
    description:
      'Explore articles, meditations, and resources to support your spiritual journey within the collective.',
    ctaLabel: 'Compose a post',
    ctaHref: '/entry',
  },
  ownerEmails: ownerEmail ? [ownerEmail] : [],
  ownerUserIds: ownerUserId ? [ownerUserId] : [],
  ownerRoles: ['guide'],
  entryRedirectPath: '/entry',
  uploadPath: '/api/media/upload',
};
