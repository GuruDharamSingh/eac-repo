// Gate declarations (2026-11-16, lane rails). Five resolve to read-only functions in src/server/gates.ts; some map to
// an existing check or service read; the rest are todo.
import type { Gate } from './types';

export const GATES: Gate[] = [
  { id: 'has_profile_photo', label: 'The person has a profile photo', resolver: 'gates:hasProfilePhoto' },
  { id: 'payouts_connected', label: 'Payouts are set up with Stripe', resolver: 'gates:payoutsConnected' },
  { id: 'is_org_member', label: 'The person has a role in the organisation', resolver: 'gates:isOrgMember', param: 'org' },
  { id: 'has_published_work', label: 'The person has published a piece of writing or an artwork', resolver: 'gates:hasPublishedWork' },
  { id: 'has_service', label: 'The person has offered a service', resolver: 'gates:hasService' },
  { id: 'has_space', label: 'The person has taken their space (folder and directory place)', resolver: 'services:hasGainedSpace' },
  { id: 'has_org', label: 'The person owns an organisation', resolver: 'status:org' },
  { id: 'has_store', label: 'The person has an open store on the market', resolver: 'status:store' },
  { id: 'has_artwork', label: 'The person has an artwork listed', resolver: 'status:artwork' },
  { id: 'has_connected_social', label: 'A social account is connected', resolver: 'todo' },
  { id: 'has_business_page', label: 'The business has a page or listing', resolver: 'todo' },
  { id: 'has_guide_profile', label: 'The guide has an elktours artist profile', resolver: 'todo' },
  { id: 'has_tour', label: 'The org has a saved tour (elktours)', resolver: 'todo' },
  { id: 'has_tour_stops', label: 'A tour has stops with media', resolver: 'todo' },
  { id: 'has_tour_slot', label: 'A tour has a dated departure', resolver: 'todo' },
  { id: 'has_site_page', label: 'The org site has a page of its own', resolver: 'todo' },
  { id: 'has_email_identity', label: 'The org has a sending name and reply address', resolver: 'todo' },
  { id: 'has_email_contacts', label: 'The org has a mailing list with contacts', resolver: 'todo' },
  { id: 'has_video_project', label: 'The person has a video project', resolver: 'todo' },
];
