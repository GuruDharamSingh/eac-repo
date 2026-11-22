/** A cover's framing: focal point in percent and a zoom (the cms-ui CoverFrame convention). */
export type CoverFrameData = { fx: number; fy: number; zoom: number };

/** What the m-tour-list resolver fills in (read per request, never stored). Pure: client and server both import it. */
export interface MobileTourRow {
  id: string;
  slug: string;
  title: string;
  /** One of TOUR_TYPE_KEYS. Tours have no type field yet, so it is derived from the title and excerpt (lib/puck/mobile-data.ts). */
  typeKey: string;
  typeLabel: string;
  duration: string | null;
  guide: string | null;
  nextLabel: string;
  priceLabel: string;
  img: string | null;
  /** The cover's framing (focal point and zoom); null = centred. */
  imgFrame?: CoverFrameData | null;
}

/** The chips after "All". Their labels are the owner's words (props); these keys are what filters. */
export const TOUR_TYPE_KEYS = ["walk", "atelier", "museum", "food", "private"] as const;

// ---- Discover (screen 01), read by lib/puck/mobile-discover.ts -------------------------------------------------

export interface MobileFeatured { slug: string; title: string; typeLabel: string; duration: string | null; guide: string | null; nextLabel: string; placesLabel: string | null; img: string | null; /** Poster of the fly-over film, shown whole when there is no cover picture. Never cropped into the arch. */ filmPoster?: string | null;
  /** The cover's framing. */ imgFrame?: CoverFrameData | null;
  /** Without a cover photo the card plays the 3D route (developer, 2026-11-17); filled by the resolver for the chosen tour only. */ map?: MobileTourDetail["hero"]["map"] }
export interface MobilePlace { id: string; slug: string; name: string; kind: string; area: string | null; img: string | null }
export interface MobileExperience { id: string; slug: string; title: string; artist: string | null; craft: string | null; where: string; img: string | null; /** Short description, read only for the panel's Description mode. */ pitch?: string | null }
export interface MobileGuide { id: string; slug: string; name: string; craft: string | null; bio: string | null; initial: string; photo: string | null; tours: { slug: string; title: string; sub: string }[] }
export interface MobileFeedLead { count: number; title: string; excerpt: string | null; by: string; initial: string; href: string }
export interface MobileDiscover {
  /** The next departing tour (else the first published), and every tour by slug so a block can bind one. */
  featuredDefault: MobileFeatured | null;
  featuredBySlug: Record<string, MobileFeatured>;
  places: MobilePlace[];
  placesCount: number;
  experiences: MobileExperience[];
  guides: MobileGuide[];
  feed: MobileFeedLead | null;
  /** The signed-in visitor (first name, or null when unknown), else null. Read per request, never stored. */
  viewer?: { name: string | null; office?: boolean } | null;
}

// ---- Tour detail (screen 03), read from the tour record -----------------------------------------------------------

export interface MobileStop { id: string; name: string; when: string | null; note: string | null; still: string | null; placeId: string | null; experience: { slug: string; title: string; artist: string | null } | null;
  /** Where the live Street View opens when the stop is expanded; null when the stop is not placed or its Street View is switched off. */
  pose?: { lat: number; lng: number; heading: number | null; pitch: number | null; fov: number | null } | null }
export interface MobileSlotChip { slotId: string; day: string; left: string }
export interface MobileTourDetail {
  slug: string;
  /** Google Maps key for the live Street View in an opened stop; null shows the still instead. */
  mapsKey?: string | null;
  /** "Walk", "Atelier" ... for the top bar. */
  typeLabel?: string;
  title: string;
  guide: { name: string; craft: string | null; photo: string | null; languages: string | null } | null;
  /** Sanitised HTML. */
  bodyHtml: string | null;
  facts: { label: string; value: string }[];
  meetAt: string | null;
  priceLabel: string;
  priced: boolean;
  slots: MobileSlotChip[];
  stops: MobileStop[];
  hero: {
    lead: "film" | "map3d" | "photos" | null;
    film: { url: string; url720: string | null; poster: string | null; seconds?: number | null } | null;
    photos: { url: string; alt: string | null; frame?: CoverFrameData | null }[];
    map: null | { /** Minutes of the whole tour, for the stop arrival offsets. */ durationMinutes?: number | null; /** Public experience at a stop, by stop id (rings its pin verdigris). */ experiences?: Record<string, { title: string; artist: string | null }>; stops: unknown[]; meetingPoint: { lat: number; lng: number; label?: string | null } | null; route: unknown; googleMapsKey: string | null; cover: string | null };
    stopCount: number;
    title: string;
  };
}

// ---- Experiences, people, About (screens 06 to 12), G4 --------------------------------------------------------------

export interface MobileExpCard { id: string; slug: string; title: string; meta: string; artist: string | null; craft: string | null; pitch: string | null; where: string; img: string | null }
export interface MobileArtist { slug: string; name: string; craft: string | null; status: string | null; initial: string; photo: string | null }
export interface MobilePerson { slug: string; name: string; kind: "guide" | "artist"; craft: string | null; area: string | null; status: string | null; initial: string; photo: string | null }
export interface MobileContent { experiences: MobileExpCard[]; artists: MobileArtist[]; people: MobilePerson[] }
export interface MobileExpDetail {
  id: string;
  slug: string;
  title: string;
  pitch: string | null;
  img: string | null;
  people: { name: string; slug: string | null; photo: string | null }[];
  facts: { label: string; value: string }[];
  bodyHtml: string | null;
  tours: { slug: string; title: string }[];
  /** Accepted dates only (listAcceptedDates); empty until the commissions migration. */
  dates: { id: string; label: string; tour: { slug: string; title: string } }[];
  viewerEmail: string | null;
}

// ---- Places catalogue and Feed (screens 12 and 15), G5/G6 ----------------------------------------------------------

export interface MobilePlaceRow { id: string; slug: string; name: string; kind: string; area: string | null; tags: string[]; favourite: boolean; img: string | null }
export interface MobilePlaces { rows: MobilePlaceRow[]; tags: { tag: string; count: number }[]; favouriteCount: number }
export interface MobileFeedRow { id: string; title: string; kind: "post" | "link"; host: string | null; author: string; initial: string; whenLabel: string; replyCount: number }
export interface MobileFeedData { rows: MobileFeedRow[] }

/** What the place sheet shows (one place, read when the sheet opens). */
export interface PlaceSheetData {
  id: string;
  slug: string;
  name: string;
  img: string | null;
  kind: string;
  blurb: string | null;
  tags: string[];
  favouriteBy: string[];
  address: string | null;
  hours: string | null;
  website: string | null;
  mapsUrl: string | null;
  tours: { slug: string; title: string; stop: number | null }[];
  hasBusiness: boolean;
}

/** What the post sheet shows. `bodyHtml` and reply `html` are sanitised by Jay's feed and forum modules. */
export interface PostSheetData {
  id: string;
  slug: string;
  title: string;
  bodyHtml: string | null;
  author: string;
  initial: string;
  whenLabel: string;
  link: { url: string; host: string; title: string; description: string | null; imageUrl: string | null } | null;
  forumHref: string;
  replyCount: number;
  replies: { id: string; author: string; initial: string; whenLabel: string; html: string }[];
  canComment: boolean;
  signedIn: boolean;
}
