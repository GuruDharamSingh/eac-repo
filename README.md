# EAC Repository

This monorepo powers the Elkdonis meeting workspace. The project is mid-redesign, carries no production data, and can be reset without migration risk. Prisma currently backs the prototype, but the long-term plan is to replace it with a self-hosted Supabase instance.

## Getting Started
1. Install dependencies with `pnpm install` (root uses workspaces).
2. Add a `.env.local` that defines `DATABASE_URL` (either in the repo root or inside `apps/central-access/`).
3. Launch the central access app with `pnpm dev --filter central-access` (rename tasks if you have not yet migrated the workspace from `meeting-app`).

## Workspace Layout
- `apps/central-access` (formerly `apps/meeting-app`): Production Next.js app for dashboards, meeting listings, and creation flows.
- `packages/db`: Transitional Prisma client wrapper (`@elkdonis/db`) with generated client code and connection bootstrap. This will be deprecated once Supabase is in place.
- `packages/types`: Shared TypeScript contracts (`@elkdonis/types`) for meetings, organizations, RSVPs, and user-organization roles.
- `packages/config`: Centralized ESLint/Prettier presets consumed across workspaces.
- `packages/ui`: Legacy Tailwind/Radix component library kept for reference while Mantine parity is finalized.

## Central Access Entry Points
- `apps/central-access/src/app/layout.tsx`: Registers Mantine providers, Geist fonts, and the persistent bottom navigation shell.
- `apps/central-access/src/app/page.tsx`: Root listing that fetches meetings via `getMeetings` and renders `MeetingCard` entries.
- `apps/central-access/src/app/dashboard/page.tsx`: Metrics dashboard combining meeting and RSVP aggregates with the placeholder auth form.
- `apps/central-access/src/app/new/page.tsx`: Entry for the meeting creation wizard.
- `apps/central-access/src/app/new/new-meeting-form.tsx`: Client-side form logic handling validation, RSVP toggles, and server action submission.
- `apps/central-access/src/lib/data.ts`: Prisma-backed data access layer that maps database models into shared types (to be replaced by Supabase queries).
- `apps/central-access/src/lib/actions.ts`: Server actions that sanitize payloads, resolve a meeting creator, and revalidate key routes.

## Shared Data Packages
- `packages/db/prisma/schema.prisma`: Current schema for organizations, users, meetings, RSVPs, and membership roles. Treat it as disposable while Supabase adoption is planned.
- `packages/db/src/index.ts`: Entry point exporting the Prisma client and generated types.
- `packages/db/src/client.ts`: Prisma client bootstrap that ensures `DATABASE_URL` is present and configures logging.
- `packages/db/scripts/check-prisma.cjs`: Connectivity script to verify the hosted Postgres instance.
- `packages/types/src/index.ts`: Barrel file exporting user, organization, meeting, RSVP, and membership interfaces.

## Tooling
- Turbo orchestrates workspace scripts; use `pnpm dev`, `pnpm build`, or `pnpm lint` to run them across the monorepo.
- ESLint/Prettier live in `packages/config` and are consumed via `eslint.config.mjs` / `.prettierrc.js` in each workspace.
- Tailwind tooling remains in `packages/ui`, but the active app relies on Mantine components.

## Additional Docs`n- `AGENTS.md`: Contributor guide for agents and developers.
- `STRUCTURE_OVERVIEW.md`: High-level guide to the repo layout and critical entry points (kept in sync with this README).
- `OVERVIEW.md`: Earlier deep-dive into the meeting app state, Prisma connectivity, and upcoming roadmap items.

## Possible Next Steps
The redesign work has not started yet; the outline below captures the target direction. Because no production data exists, we can discontinue Prisma without migration steps and stand up self-hosted Supabase as the new platform backend.

- **Unified Platform Vision**
  - Treat the monorepo as the orchestration layer for a content and operations hub. Rename `apps/meeting-app` to `apps/central-access`, expand scope to identity, dashboards, and navigation into forms/blogs.
  - Introduce shared platform packages (`packages/core` for domain services, `packages/ui` refactored for Mantine, `packages/api` for Supabase-backed access control). Supabase becomes the single source of truth via its Postgres + auth stack.

- **Central Access (currently meeting app)**
  - Expand the renamed app to aggregate meetings, form submissions, and blog analytics.
  - Implement Supabase auth/session handling with role-based enforcement using `UserOrganization.role` equivalents.
  - Move heavy server actions into typed services stored in `packages/core`, keeping UI components slim.
  - Surface navigation to meeting management, form responses, content editing, and organization settings.

- **Self-Hosted Forms**
  - Add `apps/forms-admin` for building/previewing forms with Supabase tables (`forms`, `form_fields`, `form_submissions`).
  - Expose public embeds via `/forms/[slug]` routes or iframe-ready bundles. Use shared Zod schemas so admin, API, and embeds validate consistently.
  - Plan for supabase functions or edge workers to fire webhooks and spam controls (captcha, rate limits).

- **Multiple Blogs with Front-End Access**
  - Model `posts`, `post_versions`, `categories`, and `site_themes` in Supabase.
  - Provide authoring in Central Access or a dedicated `apps/content-admin` using a rich text editor (e.g., TipTap with Supabase storage).
  - Deliver public content through `apps/content-web`, leveraging ISR or Supabase caching, and support per-site theming via stored configs.

- **Shared Operational Backbone**
  - Consolidate Supabase queries and RPC calls inside `packages/api`, optionally exposing a GraphQL facade if cross-app querying grows complex.
  - Introduce background jobs using Supabase cron, edge functions, or a lightweight queue (e.g., `bullmq`) for reminders, digests, and alerts.
  - Standardize logging with `pino` and add Sentry (or Supabase observability) across all apps.

- **Renaming and Repo Hygiene Steps**
  - Complete the workspace rename to `apps/central-access` and update Turbo filters/scripts.
  - Refactor `packages/ui` to Mantine primitives; retire unused Tailwind pieces.
  - Refresh seed scripts to populate Supabase tables for forms, content, and meetings.
  - Update documentation and developer onboarding notes to reflect the Supabase-first stack.

- **Immediate Next Moves**
  - Extend the Prisma schema one last time only if necessary for prototyping, but plan to remove Prisma soon.
  - Stand up the Supabase instance (self-hosted) and configure environment variables across apps.
  - Draft UI wireframes so navigation between Central Access, Forms Admin, and Content Web is cohesive.
  - Begin porting existing meeting queries to Supabase SQL and edge functions, validating the new stack end-to-end.


