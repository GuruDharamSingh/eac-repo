/**
 * Generated ad copy: the filler between real entries. Tone follows the
 * site decisions (HANDOFF.md): period-true, art/poetic, network-flavoured.
 * Real details stay as placeholders in brackets until the platform supplies
 * them. Nothing here names a real person or organisation.
 */
import type { Rng } from "./rng";
import type { EntryType } from "./catalog";

export interface Ad {
  /** Stable id within the plane, for focus view and echo links. */
  id: string;
  type: EntryType;
  /** Lead words, set in the unit's lead style. */
  lead: string;
  body: string;
  /** A sign-off, name block or code at the foot. */
  foot?: string;
  /** Display units use this as the big line. */
  headline?: string;
  /** A price, for offers. */
  price?: string;
  /** Where the ad came from. */
  origin: "generated" | "archive" | "real";
  /** For real entries: the path on the platform. */
  href?: string;
  /** For real entries: the originating site or org. */
  via?: string;
  /** For real entries: a picture, set as a screened photo in boxes that have room for one. */
  image?: string;
}

/** Lead and body belong together; the generator keeps the pair and, now and then, swaps a lead for a stranger one. */
const CLASSIFIED_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ["NORTH-LIGHT STUDIO,", "third floor, deep sink, freight lift, no fumes after nine. Share with a quiet printmaker who does not whistle."],
  ["BENCH SPACE", "in a working foundry yard. Bring your own gloves and your own patience. Pour days are Thursdays."],
  ["A WALL", "forty feet long, freshly primed, facing the morning. Available to anyone with a good reason. Apply with sketches."],
  ["OLD WOOD TYPE,", "any size, any condition, cases, furniture and quoins. Cash on the spot, no questions about the splinters."],
  ["A GOOD EASEL", "that does not lean to the left. Will trade one that does."],
  ["COMPOSER", "sought for a dance that happens entirely in a stairwell. Must be comfortable with echoes. Small fee, large staircase."],
  ["WRITERS!", "Captions, poems, plays and catalogue notes wanted for a travelling show. Submit two pages and a stamped envelope."],
  ["PUPPETEER", "with steady hands for a winter season. Experience with string preferred, with rod accepted."],
  ["FRAMES MADE", "to measure from reclaimed oak. Gilding, glazing, honest prices. Pick-up and delivery within the river."],
  ["PORTFOLIOS PHOTOGRAPHED", "in daylight only. No filters, no flattery."],
  ["GRANTS WRITTEN", "by someone who has been turned down more times than you."],
  ["LOST:", "one afternoon in late October, last seen near the canal, golden at the edges. Sentimental value only. Reward."],
  ["FOUND:", "a sketchbook full of hands, on the No. 9 tram. Owner may claim by describing the third hand."],
  ["SCENE PAINTER,", "must know a sky from a ceiling. Night work, overtime in tech week. Apply at stage door after 4."],
  ["FLY OPERATOR", "wanted for touring opera. Strong arms, calm nerves, no fear of heights or sopranos."],
  ["DRESSER,", "quick hands, quicker changes. Must be able to sew a hem in under forty seconds."],
  ["ACCOMPANIST", "for Thursday choir. Sight-reading a must, patience a bonus."],
  ["DRUMMER", "for a three-piece who keeps losing drummers. We are nicer now."],
  ["ASSISTANT", "to a sculptor. Lifting, sanding, saying nothing about the size of it. Three days a week."],
  ["STRETCHER", "builder, canvases up to twelve feet. Wood shop access included."],
  ["CERAMICS", "instructor, adult evening class. Kiln experience required, glaze opinions welcome."],
  ["TUTOR", "in perspective drawing, one hour weekly. Student keeps drawing roads that go up."],
  ["INVIGILATOR,", "weekends. Must be able to sit with one painting for eight hours and still like it."],
  ["ART HANDLER,", "white gloves supplied, steady nerves not. Driving licence required."],
  ["YOUNG POET", "will write the verse for your card, shop window or tombstone."],
  ["EVENINGS:", "usher at the old cinema. Free films, sticky floors, good company."],
  ["SATURDAYS:", "help run a print stall at the market. Must know how to roll a poster."],
  ["MORNINGS:", "walk the theatre cat. One cat, many opinions."],
  ["KILN TIME", "Tuesday nights, cone 6, share the firing and the cost. Bring your own pots and a sense of proportion."],
  ["PRESS FOR SALE,", "hand-cranked, bed 18 by 30, one owner, still prints straight. Buyer collects, buyer brings three friends."],
  ["UPRIGHT PIANO", "wanted, secondhand, any make, for a school of eleven children and one goat. Will tune it ourselves."],
  ["VAN & DRIVER", "for a move across town of one very large painting and one very small sofa. Sunday, early."],
  ["LIFE MODEL", "for a class that draws slowly. Tuesdays and Fridays. Paid hourly, robe provided, tea included."],
  ["DARKROOM", "technician, black and white only. Good eyes in red light."],
  ["TO LET,", "to a sober bookbinder, a room with a window and a bench. Will trade repairs for rent."],
  ["WILL TRADE", "twelve tubes of a blue I no longer believe in for anything in yellow."],
  ["SEEKING", "someone who can play the saw for a reading about rivers. One evening, modest fee, applause likely."],
  ["CELLO,", "strings good, case bad, bow missing. Sounds better than it looks."],
  ["LOOM,", "four-shaft, folding, slightly haunted by its previous weaver. Comes with threads already started."],
  ["PIGMENTS,", "ground by hand from stones found on the shore. Small jars, uncertain names, honest colours."],
  ["GOLD LEAF", "for sale by the book, loose leaf or transfer. Also a burnisher that once belonged to a saint."],
  ["A ROOM,", "quiet, warm, with a view of other people's washing. Ideal for someone who writes in the mornings."],
  ["SHARE", "a studio with a printmaker, a potter and a radio that only gets the shipping forecast."],
  ["RISOGRAPH,", "two-colour, drums for blue and fluorescent pink, paper not included, enthusiasm is."],
  ["WANTED TO BUY:", "postcards of other people's holidays, the stranger the better. Will pay by the box."],
  ["TYPEWRITER,", "portable, 1958, types a slightly wobbly e. Perfect for letters you mean."],
  ["SWAP", "a winter coat for a summer painting. Both slightly worn, both warm."],
  ["ETCHING PRESS", "to share, Thursdays. You bring the plates, we bring the blankets."],
  ["WANTED:", "a quiet person to turn pages at the Sunday recital. Must not sneeze."],
  ["FOR SALE:", "four hundred jam jars, washed, labelled by colour. Ideal for a painter or a very organised bee."],
];

const FOOTS_CLASSIFIED = ["Box A-{n}.", "Box C-{n}.", "Dept. {l}, the Ledger.", "[PHONE].", "Call [PHONE] after six.", "Apply in person.", "ArtDirect file no. {n}.", "Reply c/o this page.", "Write Box {l}-{n}.", "No agents."];

const NOTICE_HEADS = [
  "EXHIBITION POSTPONED", "STUDIO CLOSED", "OPENING TONIGHT", "INVITATION CANCELLED", "MEETING NOTICE", "CHANGE OF NAME",
  "CALL FOR WORK", "IN MEMORIAM", "CARD OF THANKS", "LOST DOG", "ROAD CLOSED", "KILN REPAIRED", "A MARRIAGE", "A BIRTH",
  "RETURNED", "PUBLIC AUCTION", "DEADLINE EXTENDED", "APOLOGY", "CORRECTION", "FOUND, ONE SCARF",
];

const NOTICE_BODIES = [
  "We regret to inform friends and visitors that the opening planned for this Friday is postponed by one week while the paint dries. The private view will now be held the following Friday at 7 p.m. as per schedule otherwise.",
  "The ceramics studio on the second floor will be closed from the first frost until the kiln is repaired. Members may collect fired work on Saturdays between ten and one. Unclaimed pots will be planted with bulbs and given to the street.",
  "You are warmly invited to the first night of an installation of folded maps. Doors at seven, short talk at eight, music after. Free entry, warm coats advised.",
  "Due to the flooding of the lower hall the midsummer dance stands cancelled. The musicians will instead play on the bridge at sunset, and all are welcome to dance there.",
  "The annual meeting will be held at the library on the 12th at 6 p.m. Agenda: the press, the roof, and the question of the press on the roof.",
  "I, the painter formerly known on the platform as [OLD NAME], shall henceforth work and exhibit as [NEW NAME]. All previous work remains mine; all future work may surprise us both.",
  "Open submission for the winter salon. Any medium, any size that fits through a door. Deadline the first Monday of December. Entry free, hanging by lottery.",
  "For the old projector at the Rialto, who showed ten thousand films and never once complained about the endings. Switched off for the last time this spring.",
  "Many thanks to everyone who came to the reading on Thursday, to the stranger who held the umbrella over the microphone, and to the café for not minding the poems.",
  "The committee wishes to correct last week's notice: the life class meets on Tuesdays, not Thursdays, and has done so since 1987. We apologise to the model.",
  "The marriage took place quietly on Saturday between a weaver of this parish and a printer of the next. The couple will live above the shop and argue about kerning.",
  "Announcing the arrival of a daughter to two members of the Thursday choir. Both mother and alto are doing well. Visitors welcome; lullabies in any key.",
  "The road past the studios will be closed for resurfacing from Monday. Access on foot through the orchard. Deliveries may be left with the beekeeper.",
  "A green scarf, hand-knitted, found on the back of a chair after the lecture on colour. The owner may collect it from the office on production of a matching glove.",
  "By order of the executors, the contents of a sculptor's studio: tools, stone, plaster moulds, a kettle. Viewing Friday, sale Saturday at ten. Bring a van and a friend.",
];

const NOTICE_SIGNS = ["The Canal Street Gallery", "Riverside Collective", "Folk Dance Circle", "The Printmakers' Guild", "The Thursday Poets", "Remembered by everyone in the back row", "The Committee", "With gratitude, the Tuesday class", "[ORG], [ADDRESS] · [PHONE]", "Secretary: [NAME]"];

const PERSONAL_NAMES = ["JOYCE", "MICHAEL", "GRA-RA TAYLOR", "CAROL", "THE GREEN COAT", "TO MY EDITOR", "DEAR MODEL", "LILLIAN", "DANA", "MR. B.", "THE NIGHT SHIFT", "ROOM 9", "TO THE TENOR", "FOR MY TEACHER"];
const PERSONAL_BODIES = [
  "Being without you has to be the most painful time of my life. But my love for you only grows stronger and stronger.",
  "I love you Bushel and a Peck.",
  "You were right about the corner. I have repainted it.",
  "Thank you for making my life so beautiful. Nine years and all my nights loving you.",
  "After ten years you're still the one I draw first.",
  "You're not a house-painter, it's true, yet I love the little things you do, and our love keeps on building.",
  "Will you be my valentine for the sixth time? Soon to be the seventh.",
  "I get weak when you're next to me, I can't speak when I look in your eyes.",
  "For the one who holds the ladder. Always.",
  "Two hundred and twenty-two days until the show. I am counting them with you.",
  "Meet me by the kiln at midnight. Bring the good gloves.",
  "To whoever left the blue on my palette: it worked.",
];
const PERSONAL_SIGNS = ["Love, Ellen", "LOVE, LISA & BABY", "Always, Mike", "Your little honey", "Gary B.", "XOXO", "Love, Jessica", "Your back row", "— the quiet one", "Love, the Thursday Poets"];

const OFFER_HEADS = [
  "X-RAY SKETCHBOOK", "GROW YOUR OWN AUDIENCE", "INSTANT MUSE", "LEARN COLOR BY MAIL", "BE A CARTOONIST!", "STAMMERING PEN?",
  "THE SELF-STRETCHING CANVAS", "PEN PALS WANTED", "TERRORS OF THE BLANK PAGE", "MAKE $100 $200 PER WEEK", "SEA MONKEYS OF THE MIND",
  "ONE HUNDRED FACES", "A PERFECT CIRCLE", "THROW YOUR VOICE", "DYNAMIC DRAWING", "HYPNOTISE YOUR CRITICS", "MAGIC ERASER",
];
const OFFER_BODIES = [
  "See right through your own bad habits! Pages so thin you can trace your heroes. Guaranteed to contain paper.",
  "Just add water and one honest painting. Results in six to eight years.",
  "Tiny living ideas! Hatch them in a glass of water and watch them swim. Each kit holds a hundred possibilities, most of them good.",
  "Twelve lessons, each printed in a different colour. Lesson thirteen is a surprise.",
  "Draw funny people for fun and profit. Includes one pencil and the secret of noses.",
  "Blots, skips, false starts cured at home. Instructive pamphlet in plain wrapper.",
  "Leave it overnight and it pulls itself tight as a drum. No staples, no swearing. Sizes from postcard to barn door.",
  "Painter in a lighthouse seeks letters from anyone, anywhere, about anything. Will reply by lamp.",
  "exposed at last! What the masters never told you about the first mark. Send stamp for details.",
  "part time, lettering shop windows in your spare hours. We show you how. No experience needed, only a ladder.",
  "Sketch any face from memory with our card system. Astonish sitters. Includes one hundred cards and a mirror.",
  "Drawn freehand in one motion by our patented wrist. Fits in a pocket. Money back if it is an oval.",
  "Fifteen minutes a day in the privacy of your own kitchen. Thicker lines! Bolder shadows! Hands that look like hands!",
  "Removes mistakes, regrets and the smell of turpentine. Works on paper, canvas and most memories.",
];
const PRICES = ["25¢", "50¢", "$1.00", "$1.50", "$2.00", "$3.95", "FREE", "10¢ & stamp", "from $3.95"];

const POSTER_TITLES = ["PAPER RIVERS", "SMALL WEATHERS", "THE NIGHT PRESS", "A SHOW ABOUT WAITING", "TEN THOUSAND HANDS", "THE LAST REEL", "ECHO / STAIRWELL", "SALT & SMOKE", "DRAWING FROM LIFE", "OPEN STUDIOS", "THE BLUE ROOM", "WOOD TYPE REVIVAL", "FOLDED MAPS", "LAMP SIGNALS"];
const POSTER_SUBS = ["an installation of folded maps", "paintings made in one afternoon", "letterpress · risograph · binding", "a play set entirely at dusk", "life drawing, all levels", "films from the back row", "a dance in a stairwell", "ceramics from the shore", "a reading about rivers", "the whole building, every door open", "one colour, nine painters", "an evening of fat faces", "collage, cut and pasted", "a night of light from the lighthouse"];
const POSTER_WHEN = ["TONIGHT 7 PM", "FRI · SAT · SUN", "ONE NIGHT ONLY", "OPENS THURSDAY", "LAST 3 DAYS", "DOORS AT 8", "SATURDAY 10 AM", "UNTIL THE FROST", "ALL WEEK", "MATINEE 2.30"];
const VENUES = ["THE OLD MILL", "CANAL STREET GALLERY", "THE RIALTO", "UNIT 4", "THE LIBRARY HALL", "THE BRIDGE", "RIVERSIDE", "THE GUILD ROOM", "THE FOUNDRY YARD", "THE BOAT HOUSE"];

const LISTING_PLACES = ["Rialto", "Camelot 3", "The Old Mill", "Chris-Town 5", "Riverside Twin", "Library Hall", "Bridge Cinema", "Guild Room", "Foundry Yard", "Boat House", "Unit 4", "Plaza 2"];
const LISTING_ITEMS = ["Paper Rivers", "Small Weathers", "The Last Reel", "Echo / Stairwell", "Salt & Smoke", "Drawing from Life", "The Blue Room", "Folded Maps", "Lamp Signals", "A Show About Waiting", "Wood Type Revival", "Ten Thousand Hands", "Night Press", "Harvest Fair"];

const AGENCY_JOBS = ["Scene Painters", "Gilder", "Ushers", "Archivist", "Set Builders", "Projectionist", "Stretcher Builder", "Dresser", "Sign Writer", "Framer", "Copyist", "Model", "Kiln Hand", "Bookbinder"];
const AGENCY_UNITS = ["day", "hr", "eve", "wk", "piece"];

const PROFILE_OCC = ["painter", "printmaker", "potter", "weaver", "composer", "poet", "sculptor", "photographer", "bookbinder", "sign painter", "puppeteer", "dancer", "filmmaker", "letterpress printer"];
const PROFILE_PLACES = ["by the canal", "above the shop", "in the old mill", "on the hill", "near the bridge", "in the foundry yard", "at the lighthouse", "on the No. 9 tram line"];
const PROFILE_NOTES = ["File open, unclaimed. Anyone who knows the work may add to it.", "Claimed and verified. Vouched for by three members.", "Works shown on request. Studio visits by arrangement.", "Takes commissions in winter only.", "Teaches on Tuesdays. Sells on Saturdays.", "No website. Ask at the market.", "Pending claim. Say if this is you."];

function fill(rng: Rng, s: string): string {
  return s.replace(/\{n\}/g, () => String(rng.int(100, 999))).replace(/\{l\}/g, () => String.fromCharCode(65 + rng.int(0, 25)));
}

/** Build one generated ad of the given type. */
export function generateAd(rng: Rng, type: EntryType, id: string): Ad {
  switch (type) {
    case "classified": {
      const [lead, body] = rng.pick(CLASSIFIED_PAIRS);
      // One in eight keeps the body and borrows a stranger's lead: the Backrooms note.
      const strange = rng.chance(0.125) ? rng.pick(CLASSIFIED_PAIRS)[0] : lead;
      return { id, type, origin: "generated", lead: strange, body, foot: fill(rng, rng.pick(FOOTS_CLASSIFIED)) };
    }
    case "notice":
      return { id, type, origin: "generated", lead: rng.pick(NOTICE_HEADS), headline: rng.pick(NOTICE_HEADS), body: rng.pick(NOTICE_BODIES), foot: rng.pick(NOTICE_SIGNS) };
    case "seasonal":
      return { id, type, origin: "generated", lead: rng.pick(PERSONAL_NAMES), headline: rng.pick(PERSONAL_NAMES), body: rng.pick(PERSONAL_BODIES), foot: rng.pick(PERSONAL_SIGNS) };
    case "mailorder":
      return { id, type, origin: "generated", lead: rng.pick(OFFER_HEADS), headline: rng.pick(OFFER_HEADS), body: rng.pick(OFFER_BODIES), price: rng.pick(PRICES), foot: fill(rng, "Dept. {l}-{n}") };
    case "poster":
      return { id, type, origin: "generated", lead: rng.pick(POSTER_WHEN), headline: rng.pick(POSTER_TITLES), body: rng.pick(POSTER_SUBS), foot: rng.pick(VENUES) };
    case "listing": {
      const place = rng.pick(LISTING_PLACES);
      const n = rng.int(2, 5);
      const lines: string[] = [];
      for (let i = 0; i < n; i++) {
        const h = rng.int(1, 11);
        const m = rng.pick(["00", "15", "30", "45"]);
        lines.push(`${rng.pick(LISTING_ITEMS)} (${rng.pick(["PG", "R", "G", "U", "15"])}) ${h}:${m}, ${h + 2}:${m}`);
      }
      return { id, type, origin: "generated", lead: place.toUpperCase(), headline: place, body: lines.join("\n"), foot: fill(rng, "[PHONE] · all seats {n}¢") };
    }
    case "profile":
      return {
        id, type, origin: "generated",
        lead: `[NAME], ${rng.pick(PROFILE_OCC)}`,
        headline: "[NAME]",
        body: `${rng.pick(PROFILE_OCC)} ${rng.pick(PROFILE_PLACES)}. ${rng.pick(PROFILE_NOTES)}`,
        foot: fill(rng, "ArtDirect file no. {n}"),
      };
    case "editorial":
      return rng.chance(0.3) ? generateWeather(rng, id) : generateArticle(rng, id);
  }
}

/** An agency list: quantity—job—rate lines. */
export function generateAgency(rng: Rng, id: string): Ad {
  const n = rng.int(4, 7);
  const lines: string[] = [];
  for (let i = 0; i < n; i++) lines.push(`${rng.int(1, 5)}—${rng.pick(AGENCY_JOBS)}—[RATE] ${rng.pick(AGENCY_UNITS)}`);
  return { id, type: "listing", origin: "generated", lead: rng.pick(["ARTS HELP", "MANY JOBS", "FEMALE HELP", "MALE HELP", "STAGE HELP", "STUDIO HELP"]), body: lines.join("\n"), foot: "Key Employment · [ADDRESS]" };
}

/** Turn a real ArtDirect dossier into an ad. The home spot links to the file. */
export function profileAd(id: string, p: { slug: string; name: string; occupation: string | null; location: string | null; claimed: boolean }): Ad {
  const occ = p.occupation ? p.occupation : "artist";
  const where = p.location ? `, ${p.location}` : "";
  return {
    id,
    type: "profile",
    origin: "real",
    lead: `${p.name.toUpperCase()},`,
    headline: p.name,
    body: `${occ}${where}. ${p.claimed ? "File claimed by the artist." : "File open; anyone who knows the work may add to it."} On record at ArtDirect.`,
    foot: `directory.arts-collective.com/${p.slug}`,
    href: `/${p.slug}`,
    via: "ArtDirect",
  };
}

const ARTICLE_HEADS = ["Kiln repaired; pots recovered from the garden", "Council annexes 135 acres of wall", "Rialto projector retires after ten thousand films", "Lower hall floods; dance moves to the bridge", "Printmakers' Guild debates press on the roof", "Forty shopfronts to be lettered before the fair", "Lost afternoon still missing, say police", "Local painter changes name, keeps paintings", "Foundry pour day draws record crowd of three", "Choir gains an alto, loses a drummer", "Harvest fair timetable published, then revised", "Valentine lines close at noon on the 13th"];
const ARTICLE_DECKS = ["Members may collect fired work on Saturdays", "Ordinance passed on third and final reading", "Switched off for the last time this spring", "Musicians to play at sunset; all welcome", "Agenda runs to three items, one of them the roof", "Guild seeks a steady hand and a ladder", "Last seen near the canal, golden at the edges", "All future work may surprise us both", "Gloves were brought; patience was not", "Lullabies in any key, hymns by arrangement", "Stop for dinner, twenty minutes, at Litchfield", "Replies forwarded once a week, as usual"];
const ARTICLE_BODIES = [
  "The ceramics studio on the second floor reopened on the first thaw after a winter in which its kiln stood cold and its members' pots stood in the garden. Of the forty unclaimed pieces planted with bulbs in December, the studio manager said, eleven had been reclaimed by their makers and the rest had flowered.",
  "At a special meeting on Thursday the council passed, on its third and final reading, an ordinance bringing a further forty feet of freshly primed wall within the limits of the studios. The wall faces the morning. Applications from anyone with a good reason will be taken in person, with sketches.",
  "The old projector at the Rialto, which showed ten thousand films and never once complained about the endings, was switched off for the last time on Tuesday. The back row stood. A replacement has been ordered; the back row has not.",
  "The flooding of the lower hall on Saturday forced the midsummer dance of the Folk Dance Circle onto the bridge, where the musicians played at sunset and, by the secretary's count, more people danced than the hall would have held.",
  "The annual meeting of the Printmakers' Guild, held at the library on the 12th, dealt with the press, the roof, and the question of the press on the roof. No decision was reached on the third item. The press remains where it is; so does the roof.",
  "The High Street Guild has advertised for a sign painter to letter forty shopfronts before the spring fair. Gold leaf is described as a plus and ladders as provided. The last time the street was lettered, the Guild's secretary said, was before most of the shops.",
];
const WEATHER_PLACES = ["The Old Mill", "Canal Street", "The Bridge", "Foundry Yard", "The Rialto", "Riverside", "The Lighthouse", "Harvest Field"];
const WEATHER_WORDS = ["fair", "north light", "overcast, good for grey", "rain, fine for indoors", "fog on the canal", "wind, hold your paper", "frost on the kiln", "haze, warm tones", "clear, cold, sharp shadows"];

/**
 * Real news stories. Empty unless a page supplies some (/classifieds/news
 * does, from Metis); while it holds stories the plane sets every box as news
 * (plane.ts tileCore), and /classifieds, with none, draws the same sheet as before.
 */
let NEWS: Ad[] = [];
export function setNewsPool(ads: Ad[]): void {
  NEWS = ads;
}
export function newsPool(): Ad[] {
  return NEWS;
}

/** A short news item for the editorial share of the matrix. */
export function generateArticle(rng: Rng, id: string): Ad {
  const k = rng.int(0, ARTICLE_HEADS.length - 1);
  return { id, type: "editorial", origin: "generated", lead: ARTICLE_DECKS[k], headline: ARTICLE_HEADS[k], body: rng.pick(ARTICLE_BODIES), foot: rng.pick(["By a staff reporter", "From our correspondent", "By [NAME]", "Agencies"]) };
}

/** The weather table: place, sky, high, low. */
export function generateWeather(rng: Rng, id: string): Ad {
  const n = rng.int(4, 7);
  const lines: string[] = [];
  for (let i = 0; i < n; i++) lines.push(`${rng.pick(WEATHER_PLACES)}\t${rng.pick(WEATHER_WORDS)}\t${rng.int(8, 24)}°\t${rng.int(-2, 12)}°`);
  return { id, type: "editorial", origin: "generated", lead: "THE WEATHER", headline: rng.pick(["The Weather", "Sky Today", "Painting Weather", "Light Report"]), body: lines.join("\n"), foot: rng.pick(["Sunrise 6:41 · sunset 7:52 · moon waxing", "Tides at the boat house: 4:10, 16:35", "Forecast by the lighthouse keeper, by lamp"]) };
}

export const HOUSE_LINES = [
  ["PLACE YOUR AD", "on ArtDirect · any hour · any language · entry free"],
  ["DOES ADVERTISING WORK??", "IT JUST DID"],
  ["LOOK AWAY!", "From this ad for a few seconds, and then look at it again. Still here, isn't it?"],
  ["ADVERTISE FREE", "Private artists never receive a bill from us. Your ad runs for four weeks, then echoes."],
  ["ATTN: READERS", "Replies to Box numbers are forwarded once a week. Please do not send originals, money or perishables."],
  ["MORE ADS", "continue in every direction"],
  ["TELL REAL FROM GENERATED", "Click any ad. Real entries carry a file number and link home."],
];
