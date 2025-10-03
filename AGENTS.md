# Repository Guidelines

## Project Structure & Module Organization
- `apps/meeting-app`: Next.js 15 App Router surface with Mantine UI; active features live under `src/app/*` and companion libs in `src/lib/`.
- `packages/db`: Prisma-backed client consumed as `@elkdonis/db`; schema at `packages/db/prisma/schema.prisma` and scripts under `packages/db/scripts/`.
- `packages/types`: Shared TypeScript contracts exported from `packages/types/src/index.ts`.
- `packages/config`: Central Prettier/ESLint presets; each workspace extends `@elkdonis/config`.
- `packages/ui`: Legacy Tailwind/Radix components kept for reference only; avoid new dependencies here.

## Build, Test, and Development Commands
- `pnpm install`: Sync workspace deps (Node 18+).
- `pnpm dev --filter meeting-app`: Start the Next.js app with Turbopack for local iteration.
- `pnpm build`: Turbo-powered build across all workspaces; ensures database client and UI packages compile.
- `pnpm lint` / `pnpm check-types`: Repository-wide linting and TypeScript checks; run both before PRs.
- `pnpm --filter @elkdonis/db run db:migrate`: Apply Prisma migrations; follow with `pnpm --filter @elkdonis/db run db:seed` for fixtures.

## Coding Style & Naming Conventions
- Prettier enforces 2-space indentation, 80-char width, and double quotes; run `pnpm format` before committing markdown or TS changes.
- Align with ESLint's TypeScript rules (`@typescript-eslint/no-unused-vars` etc.); keep unused placeholders prefixed with `_`.
- Components and pages use PascalCase filenames (`MeetingCard.tsx`); hooks/utilities use camelCase (`useMeetingFilters.ts`).
- Prefer Mantine components over Tailwind; retire imports from `@elkdonis/ui` unless refactoring legacy code.

## Testing Guidelines
- No automated suite is wired yet; when adding tests, colocate under `__tests__` with `*.test.ts[x]` naming and register commands in package scripts.
- Validate Prisma changes locally via `pnpm --filter @elkdonis/db run db:generate` and `pnpm --filter @elkdonis/db exec node scripts/check-prisma.cjs` before shipping.
- Document any manual verification steps in the PR description until automated coverage exists.

## Commit & Pull Request Guidelines
- Follow Conventional Commits (`feat(meeting-app): add RSVP filters`); scope by workspace or package.
- Keep commits focused; avoid mixing schema, UI, and tooling adjustments without rationale.
- PRs must outline intent, testing results, and environment impacts; include screenshots/GIFs for UI updates and link tracking issues.

## Environment & Database Notes
- Provide a `.env.local` with `DATABASE_URL`; keep secrets out of git and share via the secure vault.
- Prisma connects to the hosted Postgres in development; reset safely using `pnpm --filter @elkdonis/db run db:reset` when data drift occurs.
- When changing schema, update generated types and notify downstream consumers (`packages/types`, `apps/meeting-app/src/lib/data.ts`).
