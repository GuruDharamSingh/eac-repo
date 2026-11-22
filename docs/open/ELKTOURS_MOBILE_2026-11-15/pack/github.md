repo: GuruDharamSingh/eac-repo
branch: main
path: apps/elktours

## Last sync
date: 2026-11-15T23:47:00Z

### Updated in this project
- Elkdonis Forum (sections, sub-sections, topics, replies, public/members/private); Local Artists and About pages; place tags + edit page
- Discover: favourite places, places catalogue, guide profiles, guides' feed; Experiences tab; suggest form
- Tour detail hero: fly-over film, live 3D route, photos; guide switches for what the page shows
- Added artists & experiences: experience page, artist profile, sign-up wizard, shared board, tour-stop collaboration
- Mobile app design: guest city guide + guide/office scheduling console
- Copied site fonts (Basteleur, Brothers, Venture) into fonts/
- Palette and data model taken from the "zinc and brass" elktours app

## Screen map
| Screen | Repo files |
|---|---|
| Elkdonis App · Discover, Experiences, Detail | apps/elktours/src/components/tours/tour-card.tsx, apps/elktours/src/lib/tours.ts, docs/open/ELKTOURS_BRIEF_2026-10-18.md |
| Elkdonis App · Tour detail hero, Tour page media | apps/elktours/src/blocks/tour/blocks.tsx, apps/elktours/src/blocks/tour/config.tsx, apps/elktours/src/components/tours/route-preview-launcher.tsx, apps/elktours/src/components/tours/tour-story.tsx, apps/elktours/src/components/manage/asset-panel.tsx |
| Elkdonis App · Forum, Section, Thread, Compose | packages/cms-ui/src/surface/surfaces/ForumSurface.tsx, packages/cms-ui/src/surface/kinds.ts, apps/sunjay/src/lib/forum.ts |
| Elkdonis App · Date & time, Booking & payment | apps/elktours/src/components/tours/booking-form.tsx |
| Elkdonis App · Schedule | apps/elktours/src/components/manage/schedule-planner.tsx, apps/elktours/src/lib/schedule-plan.ts |
| Elkdonis App · New slots | apps/elktours/src/components/manage/repeat-scheduler.tsx, apps/elktours/src/components/manage/departures-panel.tsx |
| Elkdonis App · Slot detail, Decisions | apps/elktours/src/components/manage/departures-panel.tsx |
| Elkdonis App · Experience, Artist, Board, Create, Collaborate | docs/open/ELKTOURS_EXPERIENCES_SPEC_2026-11-02.md, apps/elktours/src/components/experiences/*, apps/elktours/src/components/manage/experience-form.tsx, apps/elktours/src/components/manage/tour-builder.tsx |
| Theme (all screens) | apps/elktours/src/app/globals.css, apps/elktours/public/fonts/* |
