# Repository Structure Overview

## Monorepo Layout
- `apps/meeting-app`: Next.js 15 Mantine-powered UI for browsing, creating, and summarizing meetings; this is the actively developed surface.
- `packages/db`: Prisma client package (`@elkdonis/db`) with generated client, connection bootstrap, and scripts for database diagnostics.
- `packages/types`: Shared TypeScript contracts (`@elkdonis/types`) covering meetings, organizations, RSVPs, and user-organization roles.
- `packages/config`: Centralized ESLint and Prettier presets that the workspaces consume.
- `packages/ui`: Legacy Tailwind/Radix component library slated for removal post-Mantine migration.
- Root configs (`package.json`, `pnpm-workspace.yaml`, `turbo.json`) coordinate Turbo build orchestration and workspace dependency management.

## Meeting App Highlights
- `apps/meeting-app/src/app/layout.tsx`: Root layout establishing Mantine provider, Google Geist fonts, and the persistent bottom navigation.
- `apps/meeting-app/src/app/page.tsx`: Index route fetching meetings via `getMeetings` and rendering `MeetingCard` instances.
- `apps/meeting-app/src/app/dashboard/page.tsx`: Dashboard metrics view combining meeting and RSVP aggregates alongside the placeholder auth form.
- `apps/meeting-app/src/app/new/page.tsx` and `apps/meeting-app/src/app/new/new-meeting-form.tsx`: Meeting creation flow; the form handles validation, RSVP options, and submission through the server action.
- `apps/meeting-app/src/lib/data.ts`: Prisma-backed data access layer mapping database models into shared types and exporting CRUD helpers.
- `apps/meeting-app/src/lib/actions.ts`: Server actions that sanitize payloads, resolve a creator, invoke `createMeeting`, and revalidate relevant pages.
- `apps/meeting-app/src/components`: Mantine-based UI building blocks, notably `meeting-card.tsx`, `bottom-nav.tsx`, and the demo `auth-header-form.tsx`.
- `apps/meeting-app/src/lib/sample-data.ts`: In-memory fixtures for meeting and RSVP examples (still used by some components for local demos).

## Data and Shared Types
- `packages/db/src/index.ts`: Package entry re-exporting the Prisma client and generated types; consumes `client.ts` to enforce a singleton in dev.
- `packages/db/src/client.ts`: Initializes Prisma, asserts `DATABASE_URL`, and configures query logging for development.
- `packages/db/prisma/schema.prisma`: Authoritative schema defining organizations, users, user-organization memberships (with roles), meetings, and RSVPs.
- `packages/db/src/seed.ts`: Seeds sample organizations, users, meetings, and RSVPs for local development.
- `packages/db/scripts/check-prisma.cjs`: CLI health check that verifies the hosted Postgres connection via the bundled client.
- `packages/types/src/index.ts`: Barrel file exporting user, organization, meeting, RSVP, and membership role interfaces for workspace consumers.

## Tooling and Workflow Notes
- Turbo tasks (`pnpm dev`, `pnpm build`, `pnpm lint`) fan out to workspace scripts via `turbo.json`.
- ESLint/Prettier settings live under `packages/config` and are referenced from app-level `eslint.config.mjs`/`.prettierrc.js` files.
- Environment secrets (e.g., `DATABASE_URL`) are expected in `.env.local` files at either the repo root or under `apps/meeting-app/`.

