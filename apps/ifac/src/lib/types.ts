export type SiteLink = {
  label: string;
  href: string;
};

export type GalleryItem = {
  id: string;
  title: string;
  artist: string;
  medium: string;
  region: string;
  imageUrl: string;
  linkUrl?: string;
  status?: string;
};

export type VideoEmbed = {
  title: string;
  src: string;
};

export type IfacSiteContent = {
  hero: {
    eyebrow: string;
    title: string;
    subtitle: string;
    imageUrl: string;
    primaryCta: string;
    secondaryCta: string;
  };
  about: {
    kicker: string;
    title: string;
    body: string;
    stats: string[];
  };
  signup: {
    title: string;
    body: string;
  };
  rsvp: {
    title: string;
    body: string;
  };
  gallery: {
    title: string;
    intro: string;
    items: GalleryItem[];
  };
  dealers: {
    title: string;
    links: SiteLink[];
  };
  blog: {
    title: string;
    href: string;
    embedUrl: string;
  };
  videos: {
    title: string;
    playlistUrl: string;
    embeds: VideoEmbed[];
  };
  social: {
    title: string;
    iconUrl: string;
    links: SiteLink[];
  };
  embeds: {
    title: string;
    body: string;
    examples: string[];
  };
  footer: {
    email: string;
    links: SiteLink[];
  };
};

export type PublicEvent = {
  id: string;
  title: string;
  slug: string;
  body: string | null;
  location: string | null;
  scheduled_at: string | null;
  duration_minutes: number | null;
  is_online: boolean | null;
  meeting_url: string | null;
  attendee_limit: number | null;
  rsvp_count: number;
};

export type IfacContact = {
  id: string;
  email: string;
  name: string | null;
  message: string | null;
  status: "new" | "contacted" | "joined";
  source: string | null;
  created_at: string;
};

export type IfacUser = {
  id: string;
  email: string;
  display_name: string | null;
  is_admin: boolean;
  role: string | null;
  joined_at: string | null;
};
