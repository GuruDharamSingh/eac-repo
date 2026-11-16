// Tracks: site, production, email (2026-11-16, lane rails).
import type { Track } from './types';

export const tracks: Track[] = [
  { id: 'site-theme', area: 'site', label: 'Set the site theme and header/footer variant', steps: ['site-theme-save', 'site-style-save'], requires: ['has_org'], leads_to: ['site-home-hero', 'site-add-page'], status: 'candidate' },
  { id: 'site-home-hero', area: 'site', label: 'Home hero and header in the house editor: banner, headline, layout', steps: ['site-banner-save', 'home-hero-save', 'home-welcome-save', 'site-section-copy-save'], requires: ['has_org'], leads_to: ['site-landing-design'], status: 'candidate' },
  { id: 'site-landing-design', area: 'site', label: 'Design the hero or landing section', steps: ['publish-org-landing-page', { gap: 'an editor for the hero / top landing section design as one control' }], requires: ['has_org'], leads_to: [], status: 'candidate' },
  { id: 'site-add-page', area: 'site', label: 'Add a page (blocks), publish it, put it in the nav', steps: ['site-feed-save', 'page-save', { gap: 'add a page to the site navigation' }], requires: ['has_org'], provides: ['has_site_page'], leads_to: ['site-nav-footer', 'site-house-editor'], status: 'candidate' },
  { id: 'site-nav-footer', area: 'site', label: 'Navigation and footer', steps: [{ gap: 'edit the site navigation' }, { gap: 'edit the site footer' }], requires: ['has_site_page'], leads_to: [], status: 'candidate' },
  { id: 'site-house-editor', area: 'site', label: 'Edit wording on the site in place', steps: ['site-section-copy-save', 'page-edits-save'], requires: ['has_site_page'], leads_to: [], status: 'candidate' },
  { id: 'site-silex', area: 'site', label: 'Design and publish a site in Silex', steps: ['open-silex-editor', 'save-silex-layout', 'publish-silex-site'], requires: ['has_org'], leads_to: [], status: 'candidate' },

  { id: 'production-studio-piece', area: 'production', label: 'A studio piece: create, summary, publish', steps: ['writing-piece-start', 'writing-piece-save', 'start-piece-plan', { gap: 'the piece summary and the publish kinds as dock-readable steps' }], requires: ['has_space'], leads_to: [], status: 'candidate' },
  { id: 'production-video-project', area: 'production', label: 'A video or reel: upload, render, publish', steps: ['create-video-project', 'upload-reel-media', 'save-video-project', 'render-video', 'publish-video'], requires: ['has_space'], provides: ['has_video_project'], leads_to: [], status: 'candidate' },
  { id: 'production-record', area: 'production', label: 'Record or capture and keep it', steps: ['capture-from-phone', 'upload-recording', 'save-booth-recording'], requires: ['has_space'], leads_to: ['production-video-project'], status: 'candidate' },
  { id: 'production-go-live', area: 'production', label: 'Set up relay destinations and go live', steps: ['set-up-relay-destinations', 'go-live-relay', 'stop-relay'], requires: ['is_org_member'], leads_to: [], status: 'candidate' },

  { id: 'email-identity', area: 'email', label: 'Set the sending name and reply address', steps: ['save-org-email-identity'], requires: ['has_org'], provides: ['has_email_identity'], leads_to: ['email-contacts'], status: 'candidate', note: 'registry entry org-email' },
  { id: 'email-contacts', area: 'email', label: 'Build the mailing list (audience)', steps: ['pkg-email-contacts', 'add-email-contacts'], requires: ['has_email_identity'], provides: ['has_email_contacts'], leads_to: ['email-newsletter'], status: 'candidate' },
  { id: 'email-newsletter', area: 'email', label: 'Newsletter: letter, test send, send', steps: ['pkg-newsletter-letter', 'pkg-newsletter-send'], requires: ['has_email_contacts'], leads_to: [], status: 'candidate', note: 'test send (three addresses) is a mode of pkg-newsletter-send' },
];
