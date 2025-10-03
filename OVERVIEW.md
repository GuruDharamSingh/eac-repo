# EAC Repo Overview

## 1. Monorepo Snapshot
- **Project**: eac-repo – shared packages plus app surfaces built on a common Postgres database via Prisma.
- **Packages**:
  - packages/db: Prisma client wrapper (published build in dist/) pointing at db.prisma.io.
  - packages/types: Shared TypeScript interfaces (Meeting, Organization, etc.).
  - Misc config packages scheduled for cleanup (@elkdonis/ui remnants are unused after Mantine migration).
- **Apps**:
  - pps/meeting-app: Next.js 15 App Router with Mantine UI (primary focus).
  - pps/docs, pps/web: legacy starter content marked for removal.

## 2. Meeting App State
- **Tech stack**: Next.js 15 + Mantine (core/hooks/dates) + Day.js.
- **Pages**:
  - /dashboard: Summary metrics (total/upcoming meetings, RSVPs) plus Mantine sign-in/up stub.
  - /: Meeting feed rendered with Mantine Paper cards.
  - /new: Three-section meeting form (Basic information, Organization & settings, Tags & media).
- **Form behaviour**:
  - Required fields: title, date, start time, location, organization.
  - Virtual meeting checkbox toggles the meeting URL input.
  - RSVP deadline, attendee cap (with "No limit" checkbox), public/require-RSVP flags.
  - Tags add/remove UI; meeting image URL stored in ttachments array when submitting.
- **Auth**: AuthHeaderForm is UI-only (no Prisma integration yet).

## 3. Prisma Connectivity
- Diagnostic script: packages/db/scripts/check-prisma.cjs
  `ash
  pnpm --filter db exec node scripts/check-prisma.cjs
  `
  Expected output: Prisma connection check: [ { ok: 1 } ]
  Confirms the bundled Prisma client reaches the hosted Postgres database.

## 4. Known Gaps / Cleanup
- Meeting creation still requires manual organization selection; user/org relationships are not enforced server-side.
- Authentication, sessions, and authorization are not wired to Prisma.
- @elkdonis/ui is unused; repo still has stale files under packages/ui.
- ESLint/Turbo config needs aligning with the Mantine setup.

## 5. Forward Vision (for next agent)
1. **Schema & Roles**
   - Refactor Prisma models so User and Organization are decoupled via UserOrganization join table with roles (VISITOR, MEMBER, ADMIN, SUPER_ADMIN).
   - Ensure meetings always reference an org; determine creator permissions based on role membership.
2. **Headless CMS Direction**
   - Treat meeting-app as the internal CMS for the EAC network (shared posts/meetings exposed via API to other apps).
   - Plan for additional content types as schema evolves.
3. **Auth & Access Control**
   - Implement real sign-in/up using Prisma (password hashing, sessions/tokens).
   - Gate meeting creation/editing by organization role and surface org picker only where allowed.
4. **Repository Hygiene**
   - Remove unused UI package remnants, reconcile ESLint configs, and tidy workspace lockfiles.

> **Next milestone**: adjust the Prisma schema and service layer to honour user–organization separation with role-based permissions, then revisit the meeting form to reflect those business rules.
