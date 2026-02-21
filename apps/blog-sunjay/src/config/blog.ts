import type { BlogConfig } from '@elkdonis/blog-client';

const ownerEmail =
  process.env.NEXT_PUBLIC_BLOG_SUNJAY_OWNER_EMAIL ?? 'justin.gillisb@gmail.com';
const ownerUserId = process.env.NEXT_PUBLIC_BLOG_SUNJAY_OWNER_ID;

export const blogConfig: BlogConfig = {
  orgId: 'sunjay',
  orgName: "Sunjay's Sacred Arts",
  orgSlug: 'blog-sunjay',
  tagline: 'Rock Balancing • Qi Gong • Sufi Practices • Conscious Creativity',
  navLinks: [
    { label: 'Home', href: '/' },
    { label: 'Writings', href: '/posts' },
    { label: 'New Entry', href: '/entry', ownerOnly: true },
    { label: 'Admin', href: '/admin', ownerOnly: true },
  ],
  hero: {
    title: 'Awakening Through Art, Healing & Presence',
    description:
      'A living archive of teachings, practices, and creative explorations from Jason Ford — artist, shaman, rock balancer, and Sufi practitioner.',
    ctaLabel: 'Create a new entry',
    ctaHref: '/entry',
    ctaOwnerOnly: true,
  },
  ownerEmails: ownerEmail ? [ownerEmail] : [],
  ownerUserIds: ownerUserId ? [ownerUserId] : [],
  ownerRoles: ['guide'],
  entryRedirectPath: '/entry',
  uploadPath: '/api/media/upload',
};
