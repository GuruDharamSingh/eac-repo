import type { BlogConfig } from '@elkdonis/blog-client';

export const blogConfig: BlogConfig = {
  orgId: 'elkdonis', // Using the central admin hub org for this test app
  orgName: "BlogTester",
  orgSlug: 'blog-tester',
  tagline: 'A classic minimalist 2010s blog experience',
  navLinks: [
    { label: 'Home', href: '/' },
    { label: 'Posts', href: '/posts' },
    { label: 'Write', href: '/entry', ownerOnly: true },
    { label: 'Dashboard', href: '/admin', ownerOnly: true },
  ],
  hero: {
    title: 'Minimalist Musings',
    description:
      'A clean, focused space for reading and writing. No distractions, just content.',
    ctaLabel: 'Write an article',
    ctaHref: '/entry',
    ctaOwnerOnly: true,
  },
  ownerEmails: [], // Relies on session checks in the API
  ownerUserIds: [], 
  ownerRoles: ['guide', 'member'], // Or whoever has access
  entryRedirectPath: '/entry',
  uploadPath: '/api/media/upload',
};
