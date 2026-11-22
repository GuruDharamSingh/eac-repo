import type { AppMocks } from "../types";

// M1 owns this file. One entry per elktours app-local block, keyed by block id (blocks.json). All are "static":
// copies of the block's markup with invented sample content (./data); see the notes on each module.
// Web blocks (tour page, experience page): ./tour, ./experience + ./web.css. Phone blocks (m-*): ./phone + the
// generated, scoped phone sheets (scope-css.py).

const web = "Static copy of the page block's markup (Tailwind classes), elktours colours, invented tour/experience.";
const phone = "Static copy of the phone block's markup over the app's own phone stylesheet (scoped), invented sample.";

const s = (note: string, load: AppMocks[string]["load"]): AppMocks[string] => ({ kind: "static", note, load });

export const MOCKS: AppMocks = {
  // tour page
  TourStage: s(web, () => import("./tour").then((m) => ({ default: m.TourStage }))),
  TourFilm: s(web, () => import("./tour").then((m) => ({ default: m.TourFilm }))),
  TourIntro: s(web, () => import("./tour").then((m) => ({ default: m.TourIntro }))),
  TourMain: s(web, () => import("./tour").then((m) => ({ default: m.TourMain }))),
  TourMore: s(web, () => import("./tour").then((m) => ({ default: m.TourMore }))),
  TourText: s(web, () => import("./tour").then((m) => ({ default: m.TourText }))),
  // experience page
  ExperienceHero: s(web, () => import("./experience").then((m) => ({ default: m.ExperienceHero }))),
  ExperienceIntro: s(web, () => import("./experience").then((m) => ({ default: m.ExperienceIntro }))),
  ExperienceMain: s(web, () => import("./experience").then((m) => ({ default: m.ExperienceMain }))),
  ExperienceGallery: s(web, () => import("./experience").then((m) => ({ default: m.ExperienceGallery }))),
  ExperienceMore: s(web, () => import("./experience").then((m) => ({ default: m.ExperienceMore }))),
  ExperienceText: s(web, () => import("./experience").then((m) => ({ default: m.ExperienceText }))),
  // phone: discover
  "m-masthead": s(phone, () => import("./phone").then((m) => ({ default: m.MMasthead }))),
  "m-search-row": s(phone, () => import("./phone").then((m) => ({ default: m.MSearchRow }))),
  "m-featured-tour": s(phone, () => import("./phone").then((m) => ({ default: m.MFeaturedTour }))),
  "m-places-shelf": s(phone, () => import("./phone").then((m) => ({ default: m.MPlacesShelf }))),
  "m-experiences-panel": s(phone, () => import("./phone").then((m) => ({ default: m.MExperiencesPanel }))),
  "m-guides": s(phone, () => import("./phone").then((m) => ({ default: m.MGuides }))),
  "m-link-rows": s(phone, () => import("./phone").then((m) => ({ default: m.MLinkRows }))),
  // phone: tours, experiences, people, about
  "m-tour-list": s(phone, () => import("./phone").then((m) => ({ default: m.MTourList }))),
  "m-experience-list": s(phone, () => import("./phone").then((m) => ({ default: m.MExperienceList }))),
  "m-artists-row": s(phone, () => import("./phone").then((m) => ({ default: m.MArtistsRow }))),
  "m-suggest-pill": s(phone, () => import("./phone").then((m) => ({ default: m.MSuggestPill }))),
  "m-people-grid": s(phone, () => import("./phone").then((m) => ({ default: m.MPeopleGrid }))),
  "m-people-slider": s(phone, () => import("./phone").then((m) => ({ default: m.MPeopleSlider }))),
  "m-about-photo": s(phone, () => import("./phone").then((m) => ({ default: m.MAboutPhoto }))),
  "m-prose-sections": s(phone, () => import("./phone").then((m) => ({ default: m.MProseSections }))),
  "m-exp-hero": s(phone, () => import("./phone").then((m) => ({ default: m.MExpHero }))),
  "m-exp-facts": s(phone, () => import("./phone").then((m) => ({ default: m.MExpFacts }))),
  "m-exp-body": s(phone, () => import("./phone").then((m) => ({ default: m.MExpBody }))),
  "m-exp-tours": s(phone, () => import("./phone").then((m) => ({ default: m.MExpTours }))),
  "m-exp-dates": s(phone, () => import("./phone").then((m) => ({ default: m.MExpDates }))),
  "m-exp-private": s(phone, () => import("./phone").then((m) => ({ default: m.MExpPrivate }))),
  // phone: places and feed
  "m-places-catalogue": s(phone, () => import("./phone").then((m) => ({ default: m.MPlacesCatalogue }))),
  "m-feed-list": s(phone, () => import("./phone").then((m) => ({ default: m.MFeedList }))),
  // phone: tour template
  "m-tour-topbar": s(phone, () => import("./phone").then((m) => ({ default: m.MTourTopbar }))),
  "m-tour-hero": s(phone, () => import("./phone").then((m) => ({ default: m.MTourHero }))),
  "m-tour-head": s(phone, () => import("./phone").then((m) => ({ default: m.MTourHead }))),
  "m-tour-blurb": s(phone, () => import("./phone").then((m) => ({ default: m.MTourBlurb }))),
  "m-tour-meet": s(phone, () => import("./phone").then((m) => ({ default: m.MTourMeet }))),
  "m-tour-route": s(phone, () => import("./phone").then((m) => ({ default: m.MTourRoute }))),
  "m-tour-dates": s(phone, () => import("./phone").then((m) => ({ default: m.MTourDates }))),
  "m-page-title": { kind: "real", note: "The real MPageTitle (imported by relative path) in the phone frame, over the app's scoped phone sheets; words from the shared sample world.", load: () => import("./page-title") },
  "m-tour-bookbar": s(phone, () => import("./phone").then((m) => ({ default: m.MTourBookbar }))),
};
