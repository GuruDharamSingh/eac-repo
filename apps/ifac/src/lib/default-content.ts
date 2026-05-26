import { siteConfig } from "@/config/site";
import type { GalleryItem, IfacSiteContent, PublicEvent, SiteLink, VideoEmbed } from "@/lib/types";

function artist(id: string, name: string, href: string, status = "Artist profile"): GalleryItem {
  return {
    id,
    title: name,
    artist: name,
    medium: "Fine art",
    region: "International",
    imageUrl: `https://placehold.co/1200x900/050505/20d7ff?text=${encodeURIComponent(name)}`,
    linkUrl: href,
    status,
  };
}

export const defaultGalleryItems: GalleryItem[] = [
  artist("andre-pace", "Andre Pace", "https://ifacgroup.com/artists/andrepace/", "Featured artist"),
  {
    id: "andre-pace-vote",
    title: "Vote For Andre",
    artist: "Andre Pace",
    medium: "People's Artist campaign",
    region: "United States",
    imageUrl: "https://ifacgroup.com/images/voteandre.png",
    linkUrl: "https://peoplesartist.org/2026/andre-pace/",
    status: "Campaign link",
  },
  artist("carla-woody", "Carla Woody", "https://ifacgroup.com/artists/carlawoody/"),
  artist("cathleen-clapper", "CathleenAclapper", "https://ifacgroup.com/artists/cathleenclapper/"),
  artist("dana-mccool", "Dana McCool", "https://ifacgroup.com/artists/danamccool/"),
  artist("ej-gold", "E.J. Gold", "https://ifacgroup.com/artists/ejgold/"),
  artist("eric-brummel", "Eric Brummel", "https://ifacgroup.com/artists/ericbrummel/", "Artist and dealer"),
  artist("jaswant-bains", "Jaswant Bains", "https://ifacgroup.com/artists/jaswantbains/"),
  artist("jim-hodgkinson", "Jim Hodgkinson", "https://ifacgroup.com/artists/jimhodgkinson/"),
  artist("gerald-porter", "Gerald Porter", "https://ifacgroup.com/artists/geraldporter/"),
  artist("lavonne-petridis", "LaVonne Petridis", "https://ifacgroup.com/artists/lavonnepetridis/"),
  artist("michele-deparis", "Michele DeParis", "https://ifacgroup.com/artists/micheledeparis/"),
  artist("nadija-szram", "Nadija Szram", "https://ifacgroup.com/artists/nadijaszram/"),
  artist("yanesh-griffith", "Yanesh Griffith", "https://ifacgroup.com/artists/yaneshgriffith/"),
];

export const defaultDealerLinks: SiteLink[] = [
  { label: "Berni Laplante", href: "https://ifacgroup.com/dealers/bernilaplante/" },
  { label: "William Albin", href: "https://ifacgroup.com/dealers/billalbin/" },
  { label: "Hans Maack", href: "https://ifacgroup.com/dealers/hansmaack/" },
  { label: "Eric Brummel", href: "https://ifacgroup.com/artists/ericbrummel/" },
  { label: "Kevin Meadows", href: "https://ifacgroup.com/dealers/kevinmeadows/" },
  { label: "Michael McDonnell", href: "https://ifacgroup.com/dealers/mmcdonnell/" },
];

export const defaultSocialLinks: SiteLink[] = [
  { label: "IFAC on Facebook", href: "https://www.facebook.com/groups/ifacgroup" },
  { label: "IFAC on Bluesky", href: "https://bsky.app/profile/ifacgroup.bsky.social" },
  { label: "IFAC on Threads", href: "https://threads.net/ifac_group" },
  { label: "IFAC on X (Twitter)", href: "https://twitter.com/IFAC_Group" },
  { label: "IFAC on Instagram", href: "https://www.instagram.com/ifac_group" },
  { label: "IFAC on YouTube", href: "https://www.youtube.com/@ifacgroup/playlists" },
  { label: "Email IFAC", href: "mailto:info@ifacgroup.com" },
];

export const defaultVideoEmbeds: VideoEmbed[] = [
  { title: "What Are You Looking At?", src: "https://www.youtube.com/embed/Oov9eGk7S38?si=NRHR1sH4QZBoXnJU" },
  { title: "Bev K talks trading opportunities for showcasing your Art", src: "https://www.youtube.com/embed/ZLAxVra7wzw?si=1rF2kmPL7Ep4mfff" },
];

export const defaultEvents: PublicEvent[] = [
  {
    id: "ifac-preview-reception",
    title: "Collector preview reception",
    slug: "collector-preview-reception",
    body: "A hosted online preview for collectors, artists and dealers interested in IFAC's next public exhibition surface.",
    location: "Online",
    scheduled_at: null,
    duration_minutes: 75,
    is_online: true,
    meeting_url: null,
    attendee_limit: 80,
    rsvp_count: 0,
  },
];

export const defaultSiteContent: IfacSiteContent = {
  hero: {
    eyebrow: "IFAC",
    title: siteConfig.orgName,
    subtitle: siteConfig.tagline,
    imageUrl: "https://ifacgroup.com/images/img-banner.jpg",
    primaryCta: "Join the collector list",
    secondaryCta: "View gallery",
  },
  about: {
    kicker: "IFAC",
    title: "International Fine Art Collectors",
    body: "International Fine Art Collectors is an online gallery and artist community representing independent fine artists and art dealers from around the world. IFAC showcases original works across painting, mixed media, sculpture and other mediums, connecting collectors with both emerging and established artists.",
    stats: ["Artists", "Art dealers", "Blog, videos and social"],
  },
  signup: {
    title: "Sign up for openings and collector notes",
    body: "Collectors, artists and dealers can join the IFAC list for exhibition announcements, private previews and membership follow-up.",
  },
  rsvp: {
    title: "RSVP for IFAC events",
    body: "Use this live RSVP area for openings, online previews, artist talks and dealer salons.",
  },
  gallery: {
    title: "ARTISTS",
    intro: "Artist links preserved from the current IFAC directory.",
    items: defaultGalleryItems,
  },
  dealers: {
    title: "ART DEALERS",
    links: defaultDealerLinks,
  },
  blog: {
    title: "IFAC BLOG",
    href: "https://ifacgroupteam.blogspot.com/",
    embedUrl: "https://ifacgroupteam.blogspot.com/",
  },
  videos: {
    title: "IFAC VIDEOS",
    playlistUrl: "https://www.youtube.com/@ifacgroup/playlists",
    embeds: defaultVideoEmbeds,
  },
  social: {
    title: "IFAC SOCIAL",
    iconUrl: "https://ifacgroup.com/images/socialicons.png",
    links: defaultSocialLinks,
  },
  embeds: {
    title: "Ready for GrapesJS live slots",
    body: "The IFAC page keeps its simple link-directory shape while exposing signup and RSVP as live EAC slots for future GrapesJS/Silex editing.",
    examples: [
      '<eac-embed data-eac-component="rsvp" data-title="IFAC RSVP"></eac-embed>',
      '<eac-embed data-eac-component="org-feed" data-title="IFAC Updates"></eac-embed>',
      '<eac-embed data-eac-component="resources" data-title="Collector Resources"></eac-embed>',
    ],
  },
  footer: {
    email: "info@ifacgroup.com",
    links: [
      { label: "Home", href: "https://ifacgroup.com/index.html" },
      { label: "About", href: "https://ifacgroup.com/about/" },
      { label: "IFAC Blog", href: "https://ifacgroupteam.blogspot.com/" },
      { label: "IFAC Videos", href: "https://www.youtube.com/@ifacgroup/playlists" },
      ...defaultSocialLinks,
    ],
  },
};
