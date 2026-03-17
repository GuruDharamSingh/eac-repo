export const siteConfig = {
  orgId: 'amrit_canada',
  orgName: 'Amrit Vela Toronto',
  tagline: 'A 4:00 AM, 2.5 hour journey of Jap Ji, Yoga and Kirtan',
  ownerEmails: [
    process.env.NEXT_PUBLIC_AMRIT_CANADA_OWNER_EMAIL ?? 'gurudharamsingh@gmail.com',
  ].filter(Boolean),
  ownerRoles: ['guide'],
} as const;
