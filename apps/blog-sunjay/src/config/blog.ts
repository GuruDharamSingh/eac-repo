import type { BlogConfig } from '@elkdonis/blog-client';

const ownerEmail =
  process.env.NEXT_PUBLIC_BLOG_SUNJAY_OWNER_EMAIL ?? 'justin.gillisb@gmail.com';
const ownerUserId = process.env.NEXT_PUBLIC_BLOG_SUNJAY_OWNER_ID;

export const blogConfig: BlogConfig = {
  orgId: 'sunjay',
  orgName: "Sunjay's Teaching Circle",
  orgSlug: 'blog-sunjay',
  tagline: 'Personal blog and creative works',
  navLinks: [
    { label: 'Home', href: '/' },
    { label: 'New Entry', href: '/entry' },
    { label: 'Admin', href: '/admin' },
  ],
  hero: {
    title: 'Sharing teachings, reflections, and creative explorations',
    description:
      'A living archive of writings, talks, and media from Sunjay. Subscribe for updates and behind-the-scenes insights.',
    ctaLabel: 'Create a new entry',
    ctaHref: '/entry',
  },
  ownerEmails: ownerEmail ? [ownerEmail] : [],
  ownerUserIds: ownerUserId ? [ownerUserId] : [],
  ownerRoles: ['guide'],
  entryRedirectPath: '/entry',
  uploadPath: '/api/media/upload',
};
