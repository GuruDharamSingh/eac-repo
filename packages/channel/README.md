# @elkdonis/channel

Channel's server side, shared by arts-collective and the org sites. Created
2026-11-12 (Phase 2 of `docs/open/CHANNEL_ON_SITES_2026-11-12.md`). Source
export, no build step; add it to the consuming app's `transpilePackages`.

## Subpaths

- `@elkdonis/channel/model`: types (`ChannelModel`, `Piece`, `Outlet`, ...) and date helpers.
- `@elkdonis/channel/load`: `loadChannelModel(viewer, params, deps)` (server only).
- `@elkdonis/channel/next`: `channelNextMoves` (pure; runs on the server and in the browser).
- `@elkdonis/channel/quick-spec`, `@elkdonis/channel/labels`: used by `next`; moved beside it.

## What moved (2026-11-12, copied without rewriting)

| From (apps/arts-collective/src) | To (packages/channel/src) |
|---|---|
| `lib/channel/model.ts` | `model.ts` |
| `lib/channel/load.ts` | `load.ts` |
| `lib/channel/next.ts` | `next.ts` (includes `NextOptions.pieceKey`) |
| `components/channel/quick-spec.ts`, `labels.ts` | `quick-spec.ts`, `labels.ts` |

The old paths remain as shims, so arts-collective importers are unchanged.
`lib/channel/load.ts` there wraps the shared loader and passes
`getOrgHomeUrl` from `@/lib/org-url`. `next-source.ts` (registry source),
`actions.ts` (publishing, Meta), `content-*.ts` and `studio-board.ts` stay in
the app.

## Injected dependencies

- `viewer: ChannelViewer` (`{ id, email }`): arts-collective's `SessionUser` satisfies it.
- `deps.getOrgHomeUrl({ slug, primaryDomain })`: each app has its own network host settings.

## Consumers

- arts-collective: through the shims.
- katie-the-potter: first site consumer (Phase 3 of the plan), not yet wired.
