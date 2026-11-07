# @elkdonis/series-site

An org's public series, in one place (moved out of `apps/ifac`, 2026-11-02): the Series page, a series' page, a
session's page, the landing hero card (`EventStage`, `seriesStageSlide`), "I'm coming", subscribe and the inline sign-in,
the session emails and reminders, the routes behind them, and the planner pages. The planner surface, composer and
services stay where they were: `@elkdonis/cms-ui/hub`, `@elkdonis/services` (`meeting-series.ts`).

## Mounting it in an org site

1. Write a `SeriesSite` (`src/config.ts`): the org's names, who may join in words (`audience`), its chrome.
2. Thin route files: `export default (props) => <SeriesPage site={site} {...props} />` and
   `export const { GET, POST } = rsvpRoutes(site)`. `apps/sunjay/src/app/series` and `apps/sunjay/src/app/api/series` are the shortest
   example.
3. Run the reminders from `instrumentation.ts`: `createSeriesReminders(site).runReminderTick(origin)`.
4. Add the package to `dependencies` and `transpilePackages`.

## Editing a series

Edit a series only through the planner (`/hub/series/<id>`; `#settings` opens cover, about and schedule). A generic content
form that writes kind, slug, section or `metadata` unmakes it: on 2026-11-03 the sunjay form replaced `metadata` whole, which removed the
series settings and Zoom details. A site mounting these pages must refuse a series in its content save (`saveContentAction` in
`apps/sunjay/src/lib/cms/actions.ts`) and pass `seriesEditHref` to its surface connectors unless it has the series compose form.

## Theme

The pages draw inside `.ifs` on the `--ifs-*` tokens at the top of `site.css`. A site overrides the tokens on its own class
beside `.ifs`. The `ifs-`, `ist-`, `isx-` prefixes were kept in the move so IFAC's markup outside the series pages did not change.

## Not moved

The email suite's per-series letters and mailings (`apps/ifac/src/lib/series-letters*`, `/manage/email/series/*`). The planner links to them only when
it is given `emailsHref`. A site without them sends the org's default letters.
