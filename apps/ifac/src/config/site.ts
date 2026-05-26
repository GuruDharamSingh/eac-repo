export const siteConfig = {
  orgId: "ifac",
  orgSlug: "ifac",
  orgName: "International Fine Art Collectors",
  shortName: "IFAC",
  domain: "ifacgroup.com",
  port: 3008,
  tagline:
    "An online gallery and artist community connecting collectors with independent fine artists and art dealers around the world.",
  ownerEmails: [
    process.env.NEXT_PUBLIC_IFAC_OWNER_EMAIL ?? "info@ifacgroup.com",
  ].filter(Boolean),
  centralAdminUrl: process.env.NEXT_PUBLIC_EAC_ADMIN_URL ?? "http://localhost:3000",
} as const;
