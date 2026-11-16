// Candidate courses (2026-11-16, lane rails): each is an ordered path of tracks, general to specific, so paths share tracks.
// Structure only: no course content. `builds_on` must match what the tracks imply (scripts/check-rails.mts derives it).
import type { CandidateCourse } from './types';

export const courses: CandidateCourse[] = [
  { id: 'profile-setup', area: 'profile', label: 'Set up a profile', tracks: ['profile-basics', 'profile-take-space', 'profile-listing'], builds_on: [] },
  { id: 'profile-in-an-org', area: 'profile', label: 'A profile inside an organisation', tracks: ['profile-in-org'], builds_on: ['profile-setup'] },
  { id: 'profile-keep-current', area: 'profile', label: 'Keep the profile current', tracks: ['profile-basics', 'profile-look', 'profile-pen-name'], builds_on: ['profile-setup'] },

  { id: 'publish-a-post', area: 'publishing', label: 'Publish a post', tracks: ['publish-post'], builds_on: ['profile-setup'] },
  { id: 'publish-a-work', area: 'publishing', label: 'Publish a work', tracks: ['publish-first-work', 'publish-more-sites', 'publish-share-social'], builds_on: ['profile-setup'] },
  { id: 'publish-paid-work', area: 'publishing', label: 'Publish paid work', tracks: ['payouts-connect', 'artwork-first-piece', 'artwork-store-open', 'publish-paid-work'], builds_on: ['profile-setup'] },
  { id: 'publish-an-event', area: 'publishing', label: 'Create an event with RSVP', tracks: ['publish-event'], builds_on: ['profile-setup'] },
  { id: 'publish-a-forum-thread', area: 'publishing', label: 'Start a forum thread with media', tracks: ['publish-forum-thread'], builds_on: ['profile-setup'] },

  { id: 'business-general', area: 'business', label: 'Business general', tracks: ['business-listing', 'payouts-connect'], builds_on: ['profile-setup'] },
  { id: 'business-booking', area: 'business', label: 'Offer a service with booking', tracks: ['service-booking-setup', 'booking-handling'], builds_on: ['business-general'] },
  { id: 'business-orders', area: 'business', label: 'Orders and payouts', tracks: ['orders-and-payouts'], builds_on: ['business-general'] },
  { id: 'business-tour-guide', area: 'business', label: 'Book a tour for a new guide (elktours)', tracks: ['tour-guide-setup', 'tour-guide-assign'], builds_on: ['business-booking', 'tour-content'] },
  { id: 'tour-content', area: 'business', label: 'Create a tour: steps, schedule, media, publish, departures', tracks: ['tour-create', 'tour-stops', 'tour-publish', 'tour-departure'], builds_on: ['organisation-start'] },

  { id: 'organisation-start', area: 'organisation', label: 'Start an organisation', tracks: ['org-start', 'org-offering'], builds_on: ['profile-setup'] },
  { id: 'organisation-people', area: 'organisation', label: 'Invite members and set roles', tracks: ['org-people'], builds_on: ['organisation-start'] },

  { id: 'site-home-hero', area: 'site', label: 'Change the home hero and header', tracks: ['site-home-hero', 'site-landing-design'], builds_on: ['organisation-start'] },
  { id: 'site-look', area: 'site', label: 'Theme and header/footer variant', tracks: ['site-theme'], builds_on: ['organisation-start'] },
  { id: 'site-pages', area: 'site', label: 'Add a page, nav and footer', tracks: ['site-add-page', 'site-nav-footer', 'site-house-editor'], builds_on: ['site-look'] },

  { id: 'production-studio', area: 'production', label: 'A studio piece', tracks: ['production-studio-piece'], builds_on: ['profile-setup'] },
  { id: 'production-video', area: 'production', label: 'A video or reel', tracks: ['production-record', 'production-video-project'], builds_on: ['profile-setup'] },

  { id: 'email-newsletter', area: 'email', label: 'A newsletter', tracks: ['email-identity', 'email-contacts', 'email-newsletter'], builds_on: ['organisation-start'] },
];
