export type Artwork = {
  filename: string;
  title: string;
};

export type ExternalLink = {
  label: string;
  href: string;
};

export type IFACProfile = {
  slug: string;
  name: string;
  kind: "artist" | "dealer";
  role: string;
  bio: string[];
  portrait: string;
  artworks: Artwork[];
  links: ExternalLink[];
  email?: string;
  website?: string;
};

function imgUrl(kind: "artist" | "dealer", slug: string, filename: string): string {
  return `/ifac/${kind}s/${slug}/${encodeURIComponent(filename)}`;
}

function a(kind: "artist" | "dealer", slug: string) {
  return (filename: string, title: string): Artwork => ({ filename: imgUrl(kind, slug, filename), title });
}

export const artists: IFACProfile[] = [
  {
    slug: "andrepace",
    name: "Andre Pace",
    kind: "artist",
    role: "Artist",
    bio: [
      "The Artist takes a retrospective reinforced by the verbal remains of the image — identifying these elements they are seen afresh with expanded expressions of color and patterns. It's not gender nor identity; the complicated issues still matter, leaving visible traces of contemporary art and mixed media design works.",
    ],
    portrait: imgUrl("artist", "andrepace", "image.jpg"),
    artworks: [
      a("artist", "andrepace")("A Critic Conflict.jpg", "A Critic Conflict"),
      a("artist", "andrepace")("Family Business.jpg", "Family Business"),
      a("artist", "andrepace")("PineApple Black.jpg", "Pineapple Black"),
      a("artist", "andrepace")("yellow Head.jpg", "Yellow Head"),
      a("artist", "andrepace")("You Dont Want Your BooBs.jpg", "You Don't Want Your Boobs Done By A Dentist"),
      a("artist", "andrepace")("COMPOSITION.jpg", "Composition"),
    ],
    links: [{ label: "Artsy profile", href: "https://www.artsy.net/artist/andre-pace/" }],
    email: "andrepace057@gmail.com",
  },
  {
    slug: "carlawoody",
    name: "Carla Woody",
    kind: "artist",
    role: "Artist",
    bio: [
      "Carla is a narrative artist exploring metaphor, the human condition and timeless traditions, especially those threatened.",
      "She is both a painter and sculptor whose intent is to offer a conversation between the sacred and secular.",
      "Her work is influenced by many years' experiences with Indigenous peoples and meditation practice.",
    ],
    portrait: imgUrl("artist", "carlawoody", "carla.jpeg"),
    artworks: [
      a("artist", "carlawoody")("Carla-Ascension_low.jpg", "The Ascension"),
      a("artist", "carlawoody")("Carla_Numinous_Council-low.jpg", "The Council"),
      a("artist", "carlawoody")("Carla-One Mother_The Source_low2.jpg", "The Source"),
      a("artist", "carlawoody")("Carla_One Mother_World Tree-low-2.jpg", "The World Tree"),
      a("artist", "carlawoody")("Carla-Numinous_LeadToTheFire-low.jpg", "How Did You Know"),
      a("artist", "carlawoody")("Carla-Reaching for the Light_low.jpg", "Reaching for the Light"),
    ],
    links: [{ label: "carlawoodyart.com", href: "https://www.carlawoodyart.com/" }],
    email: "cwoody@kenosis.net",
  },
  {
    slug: "cathleenclapper",
    name: "Cathleen Clapper",
    kind: "artist",
    role: "Artist",
    bio: [
      "After a multi-decade career in graphic arts and web design, Cathleen now enjoys fine art projects again, as she did her whole life. Her most recent works utilize watercolor, colored pencils, and pastels. Her foremost love is horses, as you will see — but she sometimes goes off-script!",
    ],
    portrait: imgUrl("artist", "cathleenclapper", "cathleen.jpg"),
    artworks: [
      a("artist", "cathleenclapper")("PalmDesertFinal.jpg", "Palm Desert"),
      a("artist", "cathleenclapper")("slick-watercolorFinal.jpg", "Slick in Pasture"),
      a("artist", "cathleenclapper")("corona-final.jpg", "Corona"),
      a("artist", "cathleenclapper")("show-horse-Final.jpg", "Show Horse"),
      a("artist", "cathleenclapper")("slick-barn-Final.jpg", "Slick by the Barn"),
      a("artist", "cathleenclapper")("ohio-winterFinal.jpg", "Ohio Winter"),
    ],
    links: [{ label: "Equine Spirit Art on Michaels Makerplace", href: "https://www.michaels.com/makerplace/storefront/equine-spirit-art" }],
    email: "clappercathy774@gmail.com",
  },
  {
    slug: "danamccool",
    name: "Dana McCool",
    kind: "artist",
    role: "Artist",
    bio: [
      "As a surrealist, one contemplates the liminal threshold(s) of multidimensional reality. Dana McCool is an interdisciplinary artist, designer, writer and anarchist. Using symbolism, color harmonies and universal archetypes, this artwork opens portals to the innermost, higher dimensions.",
      "Current subject matter of interest includes ongoing experiential research in energy medicine modalities, meditation, parapsychology, trance mediumship, as well as several western and eastern esoteric traditions — including, with emphasis, the legacy Work of G.I. Gurdjieff.",
      "Dana is a graduate of OCAD University in Toronto, Canada, with a background in religious studies, philosophy and sociology.",
    ],
    portrait: imgUrl("artist", "danamccool", "danamccool pic.png"),
    artworks: [
      a("artist", "danamccool")("Dana_McCool_HiddenWork.jpg", "Hidden Work"),
      a("artist", "danamccool")("Dana_McCool_HigherBeingBody.jpg", "Higher Being Body"),
      a("artist", "danamccool")("Dana_McCool_lawofthree.jpg", "Law of Three"),
      a("artist", "danamccool")("InTheGarden_DanaMcCool.jpg", "In The Garden"),
      a("artist", "danamccool")("Medicine Buddha_DanaMcCool.jpg", "Medicine Buddha"),
      a("artist", "danamccool")("SolarAbsolute_DanaMcCool.jpg", "Solar Absolute"),
      a("artist", "danamccool")("UniversalPharmacy_DanaMcCool.jpg", "Universal Pharmacy"),
      a("artist", "danamccool")("WishFulfillmentLargersize_DanaMcCool.jpg", "Jupiter Direct: Wish Fulfillment of an Ego"),
    ],
    links: [{ label: "danamccool.com", href: "https://www.danamccool.com/" }],
    email: "danamccoolart@gmail.com",
  },
  {
    slug: "ejgold",
    name: "E.J. Gold",
    kind: "artist",
    role: "Artist",
    bio: [
      "California artist E.J. Gold is an internationally renowned artist, jazz musician and prolific writer. His art can be seen in museums, galleries and private collections.",
      "E.J. Gold was the official artist for the International Association for Jazz Education (IAJE) from 2003–2008.",
    ],
    portrait: imgUrl("artist", "ejgold", "ejgold-about-250w.png"),
    artworks: [
      a("artist", "ejgold")("Bird.jpg", "Bird"),
      a("artist", "ejgold")("AndItComesOutHere.jpg", "And It Comes Out Here"),
      a("artist", "ejgold")("HerbiesHands.jpg", "Herbie's Hands"),
      a("artist", "ejgold")("HightA.jpg", "High A"),
      a("artist", "ejgold")("JazzHeaven.jpg", "Jazz Heaven"),
      a("artist", "ejgold")("PortraitOfPollock.jpg", "Portrait of Pollock"),
      a("artist", "ejgold")("TheCedarBar.jpg", "The Cedar Bar"),
    ],
    links: [
      { label: "ejgold.com", href: "https://www.ejgold.com/artist/" },
      { label: "Facebook", href: "https://www.facebook.com/gorebagg" },
      { label: "YouTube", href: "https://www.youtube.com/@ejgoldguru" },
      { label: "Pinterest", href: "https://www.pinterest.com/ejgorebagggold/" },
      { label: "Amazon", href: "https://www.amazon.com/stores/author/B000APYN2G" },
      { label: "Etsy (Norton Street Gallery)", href: "https://www.etsy.com/shop/NortonStreetGallery" },
      { label: "eBay", href: "https://www.ebay.com/sch/i.html?_nkw=ej+gold+-+JazzArt&_sacat=0" },
      { label: "Kunstmatrix galleries", href: "https://www.kunstmatrix.com/en/e-j-gold-gallery" },
    ],
  },
  {
    slug: "ericbrummel",
    name: "Eric Brummel",
    kind: "artist",
    role: "Artist / Art Dealer",
    bio: [
      "The crocodile and the frog. Sometimes I'm one and sometimes the other. I trust in the depths of my soul whilst I flit around on the surface.",
      "Perhaps it is from the depths cometh the pursuit in which I find my Self. I find deep connection in what is produced, and it takes some time before I'm ready to send it forth into the world.",
    ],
    portrait: imgUrl("artist", "ericbrummel", "ericbrummel500.jpg"),
    artworks: [
      a("artist", "ericbrummel")("alien goddess citrine.png", "Alien Goddess Citrine Necklace"),
      a("artist", "ericbrummel")("Alien Goddess Jade Necklace.png", "Alien Goddess Jade Necklace"),
      a("artist", "ericbrummel")("Alien Goddess Lapis Lazuli Necklace.png", "Alien Goddess Lapis Lazuli Necklace"),
      a("artist", "ericbrummel")("alien goddess monstone.png", "Alien Goddess Moonstone Necklace"),
      a("artist", "ericbrummel")("Healing Coral Uranium Glass.png", "Healing Coral Uranium Glass Necklace"),
      a("artist", "ericbrummel")("Rave jewelry Black light jewelry.png", "Rave Jewelry, Black Light — Sleeping Beauty Turquoise"),
    ],
    links: [{ label: "Etsy shop (EricBShop)", href: "https://www.etsy.com/shop/EricBShop" }],
    email: "edbbde@gmail.com",
  },
  {
    slug: "geraldporter",
    name: "Gerald Porter",
    kind: "artist",
    role: "Artist",
    bio: [
      "As an artist, as a painter, I suggest what you as an observer might notice as you unwittingly create your reality. I can help shape that reality to be more engaging and exciting. But since you as the observer are creating your own experience, I am ultimately serving as a mirror to reveal you to yourself — a master of ceremonies for a ritual in which you use my art to discover yourself.",
      "Gerald Porter was a professor, a university administrator, a painter, and a poet — a jack-of-all-trades who loved to unravel the mysteries of the universe. He always preferred the path less traveled.",
    ],
    portrait: imgUrl("artist", "geraldporter", "GP photo.png"),
    artworks: [
      a("artist", "geraldporter")("jazz/Ellington with Ray Hodges.jpg", "Ellington with Ray Hodges"),
      a("artist", "geraldporter")("jazz/Rhapsody.jpg", "Rhapsody"),
    ],
    links: [],
    email: "artemisbooks@gmail.com",
  },
  {
    slug: "jaswantbains",
    name: "Jaswant Bains",
    kind: "artist",
    role: "Artist",
    bio: [
      "Jazzy (Jaswant Bains) is a multi-national presently residing in Vancouver, Canada. Having come from a mathematical and computer background, Jazzy works as a mortgage broker — and is now deeply immersed in art and music.",
      "Pencil drawing, painting, sculpture, embossing and watercolour. Guitar, singing, Zen flute, drumming and harmonica.",
    ],
    portrait: imgUrl("artist", "jaswantbains", "jazzy1.png"),
    artworks: [
      a("artist", "jaswantbains")("Algonquin5x7.jpg", "Algonquin"),
      a("artist", "jaswantbains")("Colours6x8.jpg", "Colours"),
      a("artist", "jaswantbains")("Itwasadarkdarkday5x7.jpg", "It Was A Dark Dark Day"),
      a("artist", "jaswantbains")("ArrowinPara5x7.jpg", "Arrow in Para"),
      a("artist", "jaswantbains")("Falling6x8.jpg", "Falling"),
      a("artist", "jaswantbains")("KafMountain5X7.jpg", "Kaf Mountain"),
    ],
    links: [{ label: "Pinterest", href: "https://www.pinterest.com/jaswantohm" }],
    email: "jaswantohm@gmail.com",
  },
  {
    slug: "jimhodgkinson",
    name: "Jim Hodgkinson",
    kind: "artist",
    role: "Artist",
    bio: [
      "Jim has been working in watercolors for the last six years, specializing in landscapes often featuring scenes from the UK — his country of birth — and Canada, his home.",
      "He is the author of Pen Mind, Beginner's Mind, an account of his beginning steps as an artist.",
    ],
    portrait: imgUrl("artist", "jimhodgkinson", "JimHodgkinson.jpg"),
    artworks: [
      a("artist", "jimhodgkinson")("4973.jpg", "Green Valley"),
      a("artist", "jimhodgkinson")("JimH-3880.jpg", "Forest Orange Bushes"),
      a("artist", "jimhodgkinson")("JimH-4906.jpg", "Vertical Coastal"),
      a("artist", "jimhodgkinson")("JimH-4960.jpg", "Hiker"),
      a("artist", "jimhodgkinson")("JimH-4973.jpg", "Walking Bridge"),
      a("artist", "jimhodgkinson")("JimH-4996.jpg", "Stream / River"),
    ],
    links: [{ label: "Pen Mind, Beginner's Mind (book)", href: "https://www.gatewaysbooksandtapes.com/books/bk268.html" }],
  },
  {
    slug: "lavonnepetridis",
    name: "LaVonne Petridis",
    kind: "artist",
    role: "Artist",
    bio: [
      "LaVonne started as an artist as a child and has continued. As she experienced things, she discovered the link for her between art and her essential self.",
      "Now, she delves into the ethers and brings back images to re-share with those who wish to see.",
    ],
    portrait: imgUrl("artist", "lavonnepetridis", "LaVonne Petridis BIO Photo.jpeg"),
    artworks: [
      a("artist", "lavonnepetridis")("Almost Forgotten Temple Series 2.jpeg", "Almost Forgotten Temple Series 2"),
      a("artist", "lavonnepetridis")("Almost Forgotten Temple Series 3.jpeg", "Almost Forgotten Temple Series 3"),
      a("artist", "lavonnepetridis")("Almost Forgotten Temple Series 4.jpeg", "Almost Forgotten Temple Series 4"),
    ],
    links: [{ label: "artbylavonne.wixsite.com", href: "https://artbylavonne.wixsite.com/artbylavonne" }],
    email: "artbylavonne@yahoo.com",
  },
  {
    slug: "micheledeparis",
    name: "Michele DeParis",
    kind: "artist",
    role: "Artist / Consultant",
    bio: [
      "Michele DeParis is an artist from France who has dedicated her life to exploring the creative arts. She has studied art, theater, music, dance, photography, and oriental medicine at the University Louis Pasteur in Strasbourg and the University of Sorbonne in Paris.",
      "She is well-versed in a variety of mediums — from painting on rock and creating miniature pieces to photographing landscapes, trees, flowers and animals. Most recently she has embarked on designing and creating a collection of jewelry infused with her own high aesthetic and love.",
    ],
    portrait: imgUrl("artist", "micheledeparis", "michelemarie.jpg"),
    artworks: [
      a("artist", "micheledeparis")("s-l1600.jpg", "Angel Heart Peace Mandala Fine Art Card"),
      a("artist", "micheledeparis")("s-l1600-1.jpg", "Angel Heart Peace Mandala Fine Art Card 1"),
      a("artist", "micheledeparis")("s-l1600-2.jpg", "Angel Heart Peace Mandala Fine Art Card 2"),
      a("artist", "micheledeparis")("s-l1600-3.jpg", "Angel Heart Peace Mandala Fine Art Card 3"),
      a("artist", "micheledeparis")("s-l1600-4.jpg", "Angel Heart Peace Mandala Fine Art Card 4"),
      a("artist", "micheledeparis")("s-l1600-5.jpg", "Angel Heart Peace Mandala Fine Art Card 5"),
      a("artist", "micheledeparis")("s-l1600-6.jpg", "Angel Heart Peace Mandala Fine Art Card 6"),
      a("artist", "micheledeparis")("s-l1600-7.jpg", "Angel Heart Peace Mandala Fine Art Card 7"),
      a("artist", "micheledeparis")("s-l1600-8.jpg", "Angel Heart Peace Mandala Fine Art Card 8"),
      a("artist", "micheledeparis")("s-l1600-9.jpg", "Angel Heart Peace Mandala Fine Art Card 9"),
    ],
    links: [{ label: "eBay shop", href: "https://www.ebay.com/itm/364164195360" }],
  },
  {
    slug: "nadijaszram",
    name: "Nadija Szram",
    kind: "artist",
    role: "Artist",
    bio: [
      "Nadija Szram transitioned from art shows and sales to creating art. The art that she creates is about having conversations between colors and the way they affect the viewer.",
      "Texture, dimensionality and color shifts that mimic nature, according to different lights of the day, factor into each piece. She paints by intentionally striving to get the mind out of the way and allowing the creative force to take hold — directing the process to where it needs to go.",
      "The final outcome is a peek into a higher aesthetic, reflecting the mystery of the universe that connects us all. Her figurative work is by commission.",
    ],
    portrait: imgUrl("artist", "nadijaszram", "Nadija Szram.jpg"),
    artworks: [
      a("artist", "nadijaszram")("Dreaming In Color.jpg", "Dreaming in Color"),
      a("artist", "nadijaszram")("Finding Your Way.jpg", "Finding Your Way"),
      a("artist", "nadijaszram")("The Goddess Within.jpg", "The Goddess Within"),
      a("artist", "nadijaszram")("Those Sunsets Never Cease To Amaze.jpg", "Those Sunsets Never Cease to Amaze"),
      a("artist", "nadijaszram")("Transformations.jpg", "Transformations"),
      a("artist", "nadijaszram")("West Coast Blues.jpg", "West Coast Blues"),
    ],
    links: [{ label: "Instagram", href: "https://www.instagram.com/nadija.artstudio" }],
    email: "nadija.szram@gmail.com",
  },
  {
    slug: "yaneshgriffith",
    name: "Yanesh Griffith",
    kind: "artist",
    role: "Artist",
    bio: [
      "Since I was a young child I have always been struck by Beauty — the Beauty in another Being, the Beauty in Nature and the Beauty in the gesture of an artistic creation.",
      "Working mainly in sculpture and ceramics, Yanesh also enjoys painting, pastel and charcoal.",
    ],
    portrait: imgUrl("artist", "yaneshgriffith", "yanesh.jpg"),
    artworks: [
      a("artist", "yaneshgriffith")("crazycat.png", "Crazy Cat"),
      a("artist", "yaneshgriffith")("iamone.png", "I Am One"),
      a("artist", "yaneshgriffith")("myangel.png", "My Angel"),
      a("artist", "yaneshgriffith")("pathways.png", "Pathways"),
      a("artist", "yaneshgriffith")("skylight.png", "Skylight"),
      a("artist", "yaneshgriffith")("trees.png", "Trees"),
    ],
    links: [{ label: "Metal prints on Zazzle", href: "https://www.zazzle.com/collections/metal_prints-119050373213039798" }],
  },
];

export const dealers: IFACProfile[] = [
  {
    slug: "bernilaplante",
    name: "Berni Laplante",
    kind: "dealer",
    role: "Art Dealer / Blog Writer",
    bio: [
      "Bernardo Birabent worked in architecture and design. He began collecting art in the 1980s. When the 21st century arrived he decided it was time to let go his 'treasures' — and turned into a dealer.",
      "His favorites are works of pop art from the 1960s–70s, mostly from Argentine artists. He has had the privilege of knowing and interacting with many of the artists of those days.",
      "Sales in Argentina only.",
    ],
    portrait: imgUrl("dealer", "bernilaplante", "BERNIS31.jpg"),
    artworks: [
      a("dealer", "bernilaplante")("Bernardo birabent - COGORNO SANTIAGO MUJERES RETOZANDO.jpg", "Women in Paradise"),
      a("dealer", "bernilaplante")("Bernardo birabent - GARCIA URIBURU NICOLAS DELFINES.jpg", "Dolphins"),
      a("dealer", "bernilaplante")("Bernardo birabent - GARCIA URIBURU NICOLAS OMBUES AL VIENTO.jpg", "Windy Ombu"),
      a("dealer", "bernilaplante")("Bernardo birabent - PAEZ VILARO CARLOS MUJERESGATOS.jpg", "Cats"),
      a("dealer", "bernilaplante")("Bernardo birabent - TESTA CLORINDO MUTANTES.jpg", "Untitled"),
    ],
    links: [],
    email: "garagedeco@yahoo.com.ar",
  },
  {
    slug: "billalbin",
    name: "William Albin",
    kind: "dealer",
    role: "Art Dealer / Liaison",
    bio: [
      "William 'Bill' Albin has been involved with the California art community for decades. Bill's clients include established and upcoming artists.",
      "Among the many hats he wears, he is on the IFAC Team.",
    ],
    portrait: imgUrl("dealer", "billalbin", "billalbin500.png"),
    artworks: [],
    links: [],
    email: "wlamgr@gmail.com",
  },
  {
    slug: "hansmaack",
    name: "Hans Maack",
    kind: "dealer",
    role: "Art Dealer / Audio Video",
    bio: [
      "Canadian art dealer Hans Maack has been involved in art for over a decade, representing upcoming and established artists.",
      "Hans is also a professional audio/video technician and multi-instrumentalist. He is on the IFAC Team and produces the videos on the IFAC YouTube channel.",
    ],
    portrait: imgUrl("dealer", "hansmaack", "hans400.jpg"),
    artworks: [],
    links: [],
    email: "bardotown@yahoo.com",
  },
  {
    slug: "kevinmeadows",
    name: "Kevin Meadows",
    kind: "dealer",
    role: "Art Dealer / Audio Video",
    bio: [
      "Kevin Meadows is a versatile and experienced art dealer who specializes in acrylics, watercolors, pastels, charcoals and digital art. He has been in the art business for over 35 years, starting as an artist himself and then expanding into selling and showcasing other artists' work.",
      "Kevin offers a range of services including appraisals, consultations, commissions and online sales.",
    ],
    portrait: imgUrl("dealer", "kevinmeadows", "kevin 500.png"),
    artworks: [
      a("dealer", "kevinmeadows")("woman in red platter.jpg", "Woman in Red"),
      a("dealer", "kevinmeadows")("its not a galaxy.jpg", "It's Not a Galaxy"),
      a("dealer", "kevinmeadows")("dreaming woman plate.jpg", "Dreaming Woman"),
      a("dealer", "kevinmeadows")("ejgold greeting cards.jpg", "E.J. Gold Greeting Cards"),
      a("dealer", "kevinmeadows")("Suspicious Woman.jpg", "Suspicious Woman"),
      a("dealer", "kevinmeadows")("rtrice greeting cards.jpg", "RC Trice Greeting Cards"),
    ],
    links: [{ label: "eBay store (Kroot Alley)", href: "https://www.ebay.com/str/krootalley" }],
    email: "byjoe1@msn.com",
  },
  {
    slug: "mmcdonnell",
    name: "Michael McDonnell",
    kind: "dealer",
    role: "Art Dealer / Financial Consultant",
    bio: [
      "Michael McDonnell is a financial consultant, art collector and art dealer. Mike has collected art since 1986 and has recently begun selling from his collection.",
      "\"I enjoy promoting artists and their work.\"",
    ],
    portrait: imgUrl("dealer", "mmcdonnell", "mikemc.jpg"),
    artworks: [
      a("dealer", "mmcdonnell")("mirrored carousel.jpeg", "The Mirrored Carousel"),
      a("dealer", "mmcdonnell")("they laughed.jpeg", "And They Laughed with Joy"),
      a("dealer", "mmcdonnell")("guide 8.jpeg", "The Guide"),
      a("dealer", "mmcdonnell")("sitting lady.png", "Lady in Blue"),
      a("dealer", "mmcdonnell")("paris nights.jpg", "Paris Nights"),
      a("dealer", "mmcdonnell")("lady.png", "Gentle Reflection"),
      a("dealer", "mmcdonnell")("heather valencia art.jpg", "Street Scene"),
      a("dealer", "mmcdonnell")("birds1.jpg", "The Conference of the Birds"),
      a("dealer", "mmcdonnell")("hourian-art.jpg", "Poet Watching Polo"),
    ],
    links: [],
    email: "kragsurtur@gmail.com",
  },
];

export function getArtistBySlug(slug: string): IFACProfile | undefined {
  return artists.find((p) => p.slug === slug);
}

export function getDealerBySlug(slug: string): IFACProfile | undefined {
  return dealers.find((p) => p.slug === slug);
}
