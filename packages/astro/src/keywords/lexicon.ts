/**
 * Every keyword in "Astrological Keyword System of Analyzing Character and
 * Destiny" (The Rosicrucian Fellowship, by J.D.), verbatim, with what the
 * book leaves to the reader: what part of speech the word plays in a
 * sentence, and what it is about.
 *
 * `text` is the book's word and is never altered. The other forms are how
 * that word is spoken when it is COMBINED — the book's own example turns
 * "Conservatism" into "Conservative (Saturn) in methods of healing" and
 * "Contraction" into "Few (Saturn) children (5th)". Those forms are data here
 * so the composer never has to guess at grammar.
 *
 *   role      what kind of word it is — decides which sentence frames accept it
 *   n         the noun phrase ("generosity", "the secret forces of nature")
 *   adj       the adjective ("generous"), for modifying a person or a domain
 *   in        the phrase after "in" ("investigating the secret forces of nature")
 *   det       a counting word where the keyword is really about quantity ("few")
 *   domains   what it is about — see domains.ts; this is what pairs words
 *   sphere    character (who they are) or circumstance (what happens to them)
 *
 * The book's own rule for WHICH set applies: basic always; positive with a
 * harmonious aspect; negative with an inharmonious one. "Negative" denotes
 * the results of the qualities, not the qualities themselves.
 */

import type { Domain } from "./domains";
import type { BodyKey, SignKey } from "../types";

export type KeywordSet = "basic" | "pos" | "neg";

export type Role =
  /** a trait: generosity, obstinacy — has an adjective */
  | "quality"
  /** a capacity of the person: reason, will, imagination, vitality */
  | "faculty"
  /** a driving principle: dynamic energy, expansion, contraction, attraction */
  | "force"
  /** a field of activity or interest: art, law, healing, publications */
  | "domain"
  /** people: men, women, the public, the mother, children, friends */
  | "person"
  /** objects and assets: lands, legacies, resources, the physical body */
  | "thing"
  /** an outcome or condition: success, sorrow, limitations, ripe destiny */
  | "state"
  /** a happening: beginnings, sudden action, transition, cause of death */
  | "event";

export type Sphere = "character" | "circumstance" | "both";

export interface Keyword {
  id: string;
  text: string;
  factor: "planet" | "sign" | "house";
  owner: string;
  set: KeywordSet;
  role: Role;
  n: string;
  adj?: string;
  in?: string;
  det?: string;
  /** For a house word that names a relationship: the person it points to ("the marriage partner"). */
  who?: string;
  /** The noun phrase is plural ("the emotions are", "the main ambitions are"). */
  pl?: boolean;
  /** Listed in the reference tables but never put into a sentence frame (it has no usable grammatical form). */
  quiet?: boolean;
  domains: Domain[];
  sphere: Sphere;
  /** Position in the book's list; the author put the most characteristic word first. */
  rank: number;
}

interface Opts {
  adj?: string;
  in?: string;
  det?: string;
  n?: string;
  sphere?: Sphere;
  who?: string;
  pl?: boolean;
  quiet?: boolean;
}

type Draft = Omit<Keyword, "id" | "factor" | "owner" | "set" | "rank">;

function k(text: string, role: Role, domains: Domain[], o: Opts = {}): Draft {
  const sphereDefault: Sphere =
    role === "quality" || role === "faculty" || role === "force"
      ? "character"
      : role === "state"
        ? "both"
        : "circumstance";
  return {
    text,
    role,
    n: o.n ?? text.charAt(0).toLowerCase() + text.slice(1),
    adj: o.adj,
    in: o.in,
    det: o.det,
    who: o.who,
    pl: o.pl,
    quiet: o.quiet,
    domains,
    sphere: o.sphere ?? sphereDefault,
  };
}

function build(factor: Keyword["factor"], owner: string, sets: Record<KeywordSet, Draft[]>): Keyword[] {
  const out: Keyword[] = [];
  for (const set of ["basic", "pos", "neg"] as KeywordSet[]) {
    sets[set].forEach((d, rank) => {
      out.push({ ...d, id: `${owner}.${set}.${slug(d.text)}`, factor, owner, set, rank });
    });
  }
  return out;
}

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

// ───────────────────────────── SIGNS ─────────────────────────────

const SIGN_DRAFTS: Record<SignKey, Record<KeywordSet, Draft[]>> = {
  aries: {
    basic: [
      k("Self-esteem", "quality", ["self", "honor"], { adj: "self-respecting" }),
      k("Initiative", "quality", ["effort", "leadership", "change"], { adj: "full of initiative" }),
      k("Pioneering", "quality", ["invention", "change", "travel", "effort"], { adj: "pioneering", in: "pioneering work" }),
    ],
    pos: [
      k("Ambition", "quality", ["ambition", "career", "position"], { adj: "ambitious" }),
      k("Courage", "quality", ["conflict", "effort", "military"], { adj: "courageous" }),
      k("Enterprise", "quality", ["business", "effort", "invention"], { adj: "enterprising" }),
    ],
    neg: [
      k("Self-will", "quality", ["self", "conflict", "judgment"], { adj: "self-willed" }),
      k("Temper", "quality", ["conflict", "emotion", "dealings"], { adj: "quick-tempered" }),
      k("Brusqueness", "quality", ["speech", "social", "dealings"], { adj: "brusque" }),
      k("Overbearance", "quality", ["authority", "dealings", "power"], { adj: "overbearing" }),
    ],
  },
  taurus: {
    basic: [
      k("Determination", "quality", ["effort", "ambition", "time"], { adj: "determined" }),
      k("Interest in mundane affairs", "domain", ["material", "business", "money", "property"], { n: "an interest in mundane affairs", in: "mundane affairs" }),
    ],
    pos: [
      k("Endurance", "quality", ["effort", "time", "body"], { adj: "enduring" }),
      k("Thoroughness", "quality", ["work", "method", "skill"], { adj: "thorough" }),
      k("Conservatism", "quality", ["tradition", "method", "money", "structure"], { adj: "conservative" }),
      k("Patience", "quality", ["time", "emotion", "children"], { adj: "patient" }),
    ],
    neg: [
      k("Obstinacy", "quality", ["conflict", "judgment", "dealings"], { adj: "obstinate" }),
      k("Argumentativeness", "quality", ["speech", "conflict", "dealings"], { adj: "argumentative" }),
    ],
  },
  gemini: {
    basic: [
      k("Intellectuality", "faculty", ["mind", "learning", "reason"], { adj: "intellectual" }),
      k("Literary affairs", "domain", ["literature", "writing", "publishing"], { pl: true, in: "literary affairs" }),
      k("Work with the hands", "domain", ["work", "skill", "art"], { in: "work with the hands" }),
      k("Dualism", "state", ["change", "mind", "self"], { adj: "dual", n: "a dual nature" }),
    ],
    pos: [
      k("Versatility", "quality", ["skill", "change", "work"], { adj: "versatile" }),
      k("Curiosity", "quality", ["learning", "mind", "science"], { adj: "curious" }),
    ],
    neg: [
      k("Changeability", "quality", ["change", "emotion", "judgment"], { adj: "changeable" }),
      k("Indecision", "quality", ["judgment"], { adj: "indecisive" }),
      k("Superficiality", "quality", ["mind", "learning", "social"], { adj: "superficial" }),
    ],
  },
  cancer: {
    basic: [
      k("Love of home", "quality", ["home", "family"], { adj: "home-loving", n: "love of home" }),
      k("Capacity for home building", "domain", ["home", "property", "family"], { n: "a capacity for home building", in: "home building" }),
      k("Tenacity", "quality", ["effort", "time", "emotion"], { adj: "tenacious" }),
      k("Impressionability", "quality", ["emotion", "psychic", "mind"], { adj: "impressionable" }),
    ],
    pos: [
      k("Sympathy", "quality", ["emotion", "social", "service", "dealings"], { adj: "sympathetic" }),
      k("Sensitiveness", "quality", ["emotion", "psychic", "art"], { adj: "sensitive" }),
      k("Artistry", "quality", ["art", "beauty"], { adj: "artistic" }),
    ],
    neg: [
      k("Clannishness", "quality", ["family", "groups", "social"], { adj: "clannish" }),
      k("Timidity", "quality", ["self", "conflict", "social"], { adj: "timid" }),
      k("Restlessness", "quality", ["change", "travel", "emotion"], { adj: "restless" }),
      k("Indolence", "quality", ["work", "effort"], { adj: "indolent" }),
    ],
  },
  leo: {
    basic: [
      k("Vitality", "faculty", ["vitality", "body", "health"], { adj: "vital" }),
      k("Authority", "faculty", ["authority", "leadership", "position"], { adj: "authoritative" }),
    ],
    pos: [
      k("Affection", "quality", ["love", "children", "family"], { adj: "affectionate" }),
      k("Nobility", "quality", ["honor", "self", "dealings"], { adj: "noble" }),
      k("Generosity", "quality", ["money", "dealings", "children", "social"], { adj: "generous" }),
      k("Loyalty", "quality", ["partnership", "friends", "marriage"], { adj: "loyal" }),
      k("Dignity", "quality", ["honor", "position", "self"], { adj: "dignified" }),
      k("Leadership", "quality", ["leadership", "authority", "groups"], { adj: "commanding" }),
    ],
    neg: [
      k("Arrogance", "quality", ["self", "dealings", "authority"], { adj: "arrogant" }),
      k("Autocracy", "quality", ["authority", "power"], { adj: "autocratic" }),
      k("Cruelty", "quality", ["conflict", "children", "dealings"], { adj: "cruel" }),
      k("Overbearing", "quality", ["authority", "dealings"], { adj: "overbearing", n: "an overbearing manner" }),
      k("Vanity", "quality", ["self", "beauty"], { adj: "vain" }),
      k("Ostentatiousness", "quality", ["money", "beauty", "social"], { adj: "ostentatious" }),
    ],
  },
  virgo: {
    basic: [
      k("Service", "domain", ["service", "work", "health"], { in: "service" }),
      k("Mentality", "faculty", ["mind", "reason"], { adj: "mental" }),
    ],
    pos: [
      k("Discrimination", "quality", ["judgment", "mind"], { adj: "discriminating" }),
      k("Analysis", "quality", ["mind", "science", "reason", "method"], { adj: "analytical" }),
      k("Studiousness", "quality", ["learning", "mind"], { adj: "studious" }),
      k("Hygienics", "domain", ["health", "body", "method"], { in: "hygiene", adj: "hygienic" }),
      k("Purity", "quality", ["body", "health", "spirit"], { adj: "pure" }),
    ],
    neg: [
      k("Criticism", "quality", ["speech", "judgment", "dealings"], { adj: "critical" }),
      k("Cynicism", "quality", ["mind", "faith", "dealings"], { adj: "cynical" }),
      k("Introspection", "quality", ["self", "mind"], { adj: "introspective" }),
      k("Fear of disease", "state", ["health", "emotion"], { n: "a fear of disease", sphere: "character" }),
    ],
  },
  libra: {
    basic: [
      k("Capacity for partnership", "domain", ["partnership", "marriage", "social"], { n: "a capacity for partnership", in: "partnership" }),
      k("Art", "domain", ["art", "beauty"], { in: "art" }),
    ],
    pos: [
      k("Balance", "quality", ["judgment", "emotion", "dealings"], { adj: "balanced" }),
      k("Justice", "quality", ["justice", "law", "dealings"], { adj: "just" }),
      k("Courtesy", "quality", ["social", "dealings"], { adj: "courteous" }),
      k("Artistic ability", "quality", ["art", "beauty", "skill"], { adj: "artistic" }),
    ],
    neg: [
      k("Indecision", "quality", ["judgment"], { adj: "indecisive" }),
      k("Lack of poise", "quality", ["emotion", "social"], { adj: "lacking in poise", n: "a lack of poise" }),
      k("Emotional fluctuation", "quality", ["emotion", "change"], { adj: "emotionally changeable" }),
    ],
  },
  scorpio: {
    basic: [
      k("Secret forces of nature", "domain", ["science", "occult", "secrets"], { pl: true, n: "the secret forces of nature", in: "investigating the secret forces of nature" }),
      k("Sex", "domain", ["sex", "love"], { in: "matters of sex" }),
      k("Healing power", "domain", ["healing", "health"], { in: "methods of healing" }),
      k("Magic", "domain", ["magic", "occult"], { in: "magic" }),
      k("Military affairs", "domain", ["military", "conflict"], { pl: true, in: "military affairs" }),
      k("Surgery", "domain", ["healing", "body"], { in: "surgery" }),
    ],
    pos: [
      k("Regeneration", "quality", ["spirit", "healing", "change"], { adj: "regenerative" }),
      k("Courage", "quality", ["conflict", "effort", "military"], { adj: "courageous" }),
      k("Resourcefulness", "quality", ["work", "business", "effort"], { adj: "resourceful" }),
      k("Ability for secret investigations", "quality", ["secrets", "science", "occult"], { n: "an ability for secret investigations", in: "secret investigations", adj: "able in secret investigations" }),
    ],
    neg: [
      k("Discord", "quality", ["conflict", "partnership", "social"], { adj: "discordant" }),
      k("Misuse of sex", "state", ["sex"], { n: "a misuse of sex", sphere: "character" }),
      k("Passion", "quality", ["emotion", "sex"], { adj: "passionate" }),
      k("Temper", "quality", ["conflict", "emotion"], { adj: "quick-tempered" }),
      k("Jealousy", "quality", ["love", "partnership", "marriage"], { adj: "jealous" }),
      k("Willfulness", "quality", ["self", "conflict"], { adj: "willful" }),
      k("Vindictiveness", "quality", ["conflict", "dealings"], { adj: "vindictive" }),
      k("Inability to let go", "quality", ["emotion", "time", "love"], { n: "an inability to let go", adj: "unable to let go" }),
    ],
  },
  sagittarius: {
    basic: [
      k("Aspiration", "quality", ["ideals", "spirit", "ambition"], { adj: "aspiring" }),
      k("Idealism", "quality", ["ideals", "philosophy"], { adj: "idealistic" }),
      k("Orthodox religion", "domain", ["religion", "tradition", "faith"], { in: "orthodox religion" }),
      k("Law", "domain", ["law", "justice"], { in: "the law" }),
      k("Philosophy", "domain", ["philosophy", "learning"], { in: "philosophy" }),
    ],
    pos: [
      k("Generosity", "quality", ["money", "dealings", "social"], { adj: "generous" }),
      k("Love of outdoor life and athletics", "domain", ["sport", "body"], { n: "a love of outdoor life and athletics", in: "outdoor life and athletics" }),
    ],
    neg: [
      k("Over-confidence", "quality", ["judgment", "self"], { adj: "over-confident" }),
      k("Dogmatism", "quality", ["religion", "philosophy", "speech"], { adj: "dogmatic" }),
      k("Fanaticism", "quality", ["religion", "ideals", "conflict"], { adj: "fanatical" }),
    ],
  },
  capricorn: {
    basic: [
      k("Position", "domain", ["position", "career"], { in: "matters of position" }),
      k("Honors", "domain", ["honor", "position"], { pl: true, in: "honors" }),
      k("Ambition", "quality", ["ambition", "career", "position"], { adj: "ambitious" }),
    ],
    pos: [
      k("Justice", "quality", ["justice", "law", "dealings"], { adj: "just" }),
      k("Organization", "quality", ["structure", "business", "work"], { adj: "organized" }),
      k("Caution", "quality", ["judgment", "money"], { adj: "cautious" }),
      k("Economy", "quality", ["money", "material"], { adj: "economical" }),
      k("Authority", "quality", ["authority", "leadership", "position"], { adj: "authoritative" }),
    ],
    neg: [
      k("Pride", "quality", ["self", "honor"], { adj: "proud" }),
      k("Suspicion", "quality", ["dealings", "secrets"], { adj: "suspicious" }),
      k("Resentfulness", "quality", ["emotion", "dealings"], { adj: "resentful" }),
      k("Pessimism", "quality", ["mind", "emotion"], { adj: "pessimistic" }),
      k("Unforgiveness", "quality", ["dealings", "emotion"], { adj: "unforgiving" }),
      k("Justice without mercy", "quality", ["justice", "dealings"], { adj: "just but merciless" }),
    ],
  },
  aquarius: {
    basic: [
      k("Humanitarianism", "quality", ["humanity", "service", "social"], { adj: "humanitarian" }),
      k("Science", "domain", ["science", "invention"], { in: "science" }),
      k("New systems", "domain", ["invention", "structure", "science"], { pl: true, in: "new systems" }),
      k("Corporations", "domain", ["business", "groups"], { pl: true, in: "corporations" }),
      k("Universality", "quality", ["humanity", "ideals"], { adj: "universal in outlook" }),
      k("Universal friendship", "domain", ["friends", "humanity"], { in: "universal friendship" }),
    ],
    pos: [
      k("Progressiveness", "quality", ["change", "invention", "ideals"], { adj: "progressive" }),
      k("Cooperation", "quality", ["partnership", "groups", "work"], { adj: "cooperative" }),
      k("Diplomacy", "quality", ["dealings", "social"], { adj: "diplomatic" }),
    ],
    neg: [
      k("Impracticality", "quality", ["material", "work", "money"], { adj: "impractical" }),
      k("Undervaluation of personal friendships", "quality", ["friends"], { n: "an undervaluation of personal friendships", adj: "neglectful of personal friendships" }),
      k("Dictatorship", "quality", ["authority", "power"], { adj: "dictatorial" }),
    ],
  },
  pisces: {
    basic: [
      k("Sensitiveness to superphysical influences", "quality", ["psychic", "spirit", "occult"], { n: "sensitiveness to superphysical influences", adj: "sensitive to superphysical influences" }),
      k("Sense of unity with all life", "quality", ["spirit", "humanity", "ideals"], { n: "a sense of unity with all life", adj: "at one with all life" }),
      k("Mysticism", "domain", ["mysticism", "spirit"], { in: "mysticism" }),
      k("Ripe destiny", "state", ["destiny"], { n: "ripe destiny" }),
    ],
    pos: [
      k("Intuitiveness", "quality", ["psychic", "mind"], { adj: "intuitive" }),
      k("Inspiration", "quality", ["spirit", "art", "music"], { adj: "inspired" }),
      k("Compassion", "quality", ["emotion", "service", "humanity"], { adj: "compassionate" }),
      k("Renunciation", "quality", ["spirit", "material"], { adj: "self-renouncing" }),
      k("Sacrifice", "quality", ["service", "spirit"], { adj: "self-sacrificing" }),
    ],
    neg: [
      k("Psychic negativeness", "quality", ["psychic"], { adj: "psychically negative" }),
      k("Introspection", "quality", ["self", "mind"], { adj: "introspective" }),
      k("Lack of confidence", "quality", ["self"], { n: "a lack of confidence", adj: "lacking in confidence" }),
      k("Secretiveness", "quality", ["secrets"], { adj: "secretive" }),
      k("Sorrow", "state", ["emotion", "sorrow"], { adj: "sorrowful" }),
      k("Procrastination", "quality", ["time", "work"], { adj: "procrastinating" }),
    ],
  },
};

// ───────────────────────────── PLANETS ─────────────────────────────

export type PlanetKey = Exclude<BodyKey, "chiron" | "northNode">;

const PLANET_DRAFTS: Record<PlanetKey, Record<KeywordSet, Draft[]>> = {
  sun: {
    basic: [
      k("Individuality", "faculty", ["self"], { n: "the individuality" }),
      k("What one really is", "faculty", ["self", "truth"], { n: "what one really is", quiet: true }),
      k("Vitality", "faculty", ["vitality", "body", "health"], { adj: "vital" }),
      k("Will", "faculty", ["effort", "self", "ambition"], { n: "the will" }),
      k("Chief ambitions", "faculty", ["ambition", "career", "position"], { pl: true, n: "the main ambitions of the life" }),
      k("Those in authority", "person", ["authority", "dealings", "position"], { pl: true, n: "those in authority", in: "dealings with those in authority" }),
      k("Men", "person", ["dealings", "social"], { pl: true, n: "men", in: "all dealings with men" }),
    ],
    pos: [
      k("Generosity", "quality", ["money", "dealings", "children", "social"], { adj: "generous" }),
      k("Dignity", "quality", ["honor", "position", "self"], { adj: "dignified" }),
    ],
    neg: [
      k("Despotism", "quality", ["authority", "power", "dealings"], { adj: "despotic" }),
      k("Arrogance", "quality", ["self", "dealings"], { adj: "arrogant" }),
      k("Ostentation", "quality", ["money", "social", "beauty"], { adj: "ostentatious" }),
      k("Lack of ambition", "quality", ["ambition", "effort"], { n: "a lack of ambition", adj: "unambitious" }),
      k("Animalistic qualities", "quality", ["body", "sex"], { pl: true, n: "animalistic qualities", adj: "animalistic" }),
    ],
  },
  moon: {
    basic: [
      k("Personality", "faculty", ["self", "social"], { n: "the personality" }),
      k("Imagination", "faculty", ["imagination", "art", "mind"], { n: "the imagination", adj: "imaginative" }),
      k("Instinctual mind", "faculty", ["mind", "emotion"], { n: "the instinctual mind" }),
      k("Emotions", "faculty", ["emotion"], { pl: true, n: "the emotions", adj: "emotional" }),
      k("Change", "force", ["change"], { adj: "changeable", n: "change" }),
      k("Fecundation", "domain", ["children", "sex", "growth"], { adj: "fruitful", in: "fecundation" }),
      k("The public", "person", ["public", "publicity"], { n: "the public", in: "dealings with the public" }),
      k("Women", "person", ["dealings", "social"], { pl: true, n: "women", in: "dealings with women" }),
    ],
    pos: [
      k("Positive psychic qualities", "quality", ["psychic"], { pl: true, n: "positive psychic qualities", adj: "psychically positive" }),
      k("Personal magnetism", "quality", ["social", "public"], { adj: "magnetic" }),
    ],
    neg: [
      k("Negativeness", "quality", ["psychic", "self"], { adj: "negative" }),
      k("Visionariness", "quality", ["imagination", "ideals"], { adj: "visionary" }),
      k("Dreaminess", "quality", ["imagination", "work"], { adj: "dreamy" }),
      k("Indecision", "quality", ["judgment"], { adj: "indecisive" }),
      k("Vacillation", "quality", ["judgment", "change"], { adj: "vacillating" }),
      k("Frivolity", "quality", ["pleasure", "social"], { adj: "frivolous" }),
      k("Fretfulness", "quality", ["emotion"], { adj: "fretful" }),
      k("Procrastination", "quality", ["time", "work"], { adj: "procrastinating" }),
      k("Incorrect impressions", "state", ["mind", "judgment", "psychic"], { pl: true, n: "incorrect impressions", sphere: "character" }),
    ],
  },
  mercury: {
    basic: [
      k("Reason", "faculty", ["reason", "mind"], { n: "the reason" }),
      k("Self-expression of all kinds", "faculty", ["communication", "speech", "art"], { n: "self-expression", in: "self-expression of all kinds" }),
      k("Speaking", "domain", ["speech", "communication"], { in: "speaking" }),
      k("Writing", "domain", ["writing", "literature", "communication"], { in: "writing" }),
      k("Gestures", "domain", ["communication", "body"], { pl: true, in: "gesture" }),
      k("Knowledge through reason", "domain", ["learning", "reason", "science"], { in: "knowledge gained through reason" }),
    ],
    pos: [
      k("Quick-wittedness", "quality", ["mind", "speech"], { adj: "quick-witted" }),
      k("Eloquence", "quality", ["speech", "public"], { adj: "eloquent" }),
      k("Literary ability", "quality", ["literature", "writing", "publishing"], { adj: "literary" }),
      k("Dexterity", "quality", ["skill", "body", "work"], { adj: "dexterous" }),
    ],
    neg: [
      k("Restlessness", "quality", ["change", "travel", "mind"], { adj: "restless" }),
      k("Gossip", "quality", ["speech", "social"], { adj: "gossiping" }),
      k("Profanity", "quality", ["speech"], { adj: "profane" }),
      k("Demagogy", "quality", ["speech", "public", "power"], { adj: "demagogic" }),
      k("Deceit", "quality", ["dealings", "truth"], { adj: "deceitful" }),
      k("Dishonesty", "quality", ["dealings", "money", "truth"], { adj: "dishonest" }),
      k("Nervousness", "quality", ["emotion", "health", "mind"], { adj: "nervous" }),
      k("Worry", "quality", ["emotion", "mind"], { adj: "worrying" }),
      k("Indecision", "quality", ["judgment"], { adj: "indecisive" }),
      k("Forgetfulness", "quality", ["mind"], { adj: "forgetful" }),
      k("Clumsiness", "quality", ["body", "skill"], { adj: "clumsy" }),
    ],
  },
  venus: {
    basic: [
      k("Attraction", "force", ["love", "social", "beauty"], { adj: "attractive" }),
      k("Cohesion", "force", ["partnership", "groups", "marriage"], { adj: "cohesive" }),
      k("Coalition", "domain", ["partnership", "groups", "business"], { in: "coalitions" }),
      k("Personal love", "domain", ["love"], { in: "personal love" }),
      k("Social instincts and activities", "domain", ["social", "pleasure"], { pl: true, n: "the social instincts", in: "social activities" }),
      k("Art", "domain", ["art"], { in: "art" }),
      k("Ornamentation", "domain", ["beauty", "art"], { in: "ornamentation" }),
      k("Beauty", "domain", ["beauty"], { in: "beauty" }),
    ],
    pos: [
      k("Harmony", "quality", ["social", "partnership", "music", "art"], { adj: "harmonious" }),
      k("Artistic ability", "quality", ["art", "beauty", "skill"], { adj: "artistic" }),
      k("Cheerfulness", "quality", ["emotion", "social"], { adj: "cheerful" }),
      k("Suavity", "quality", ["social", "dealings"], { adj: "suave" }),
    ],
    neg: [
      k("Sensuality", "quality", ["sex", "pleasure", "body"], { adj: "sensual" }),
      k("Dissoluteness", "quality", ["pleasure", "sex", "money"], { adj: "dissolute" }),
      k("Vulgarity", "quality", ["social", "beauty", "speech"], { adj: "vulgar" }),
      k("Sloth", "quality", ["work", "effort"], { adj: "slothful" }),
      k("Laziness", "quality", ["work", "effort"], { adj: "lazy" }),
      k("Sentimentality", "quality", ["emotion", "love"], { adj: "sentimental" }),
      k("Vanity", "quality", ["self", "beauty"], { adj: "vain" }),
      k("Inconstancy", "quality", ["love", "partnership", "change"], { adj: "inconstant" }),
    ],
  },
  mars: {
    basic: [k("Dynamic energy", "force", ["effort", "conflict", "body", "work"], { adj: "energetic" })],
    pos: [
      k("Constructiveness", "quality", ["work", "structure", "invention"], { adj: "constructive" }),
      k("Courage", "quality", ["conflict", "effort", "military"], { adj: "courageous" }),
      k("Enterprise", "quality", ["business", "effort"], { adj: "enterprising" }),
      k("Enthusiasm", "quality", ["emotion", "effort", "ideals"], { adj: "enthusiastic" }),
      k("Gallantry", "quality", ["social", "love", "conflict"], { adj: "gallant" }),
    ],
    neg: [
      k("Combativeness", "quality", ["conflict", "military"], { adj: "combative" }),
      k("Friction", "quality", ["conflict", "partnership", "dealings"], { adj: "given to friction" }),
      k("Temper", "quality", ["conflict", "emotion"], { adj: "quick-tempered" }),
      k("Egotism", "quality", ["self"], { adj: "egotistical" }),
      k("Audacity", "quality", ["conflict", "self", "judgment"], { adj: "audacious" }),
      k("Destructiveness", "quality", ["conflict", "death"], { adj: "destructive" }),
      k("Passion", "quality", ["emotion", "sex"], { adj: "passionate" }),
      k("Lustfulness", "quality", ["sex"], { adj: "lustful" }),
      k("Coarseness", "quality", ["social", "speech", "body"], { adj: "coarse" }),
      k("Impulsiveness", "quality", ["judgment", "change"], { adj: "impulsive" }),
    ],
  },
  jupiter: {
    basic: [
      k("Expansion", "force", ["growth", "money", "business"], { adj: "expansive", det: "many" }),
      k("Vision", "faculty", ["ideals", "mind", "imagination"], { adj: "far-seeing" }),
      k("Optimism", "quality", ["emotion", "mind"], { adj: "optimistic" }),
      k("Ideation", "faculty", ["mind", "philosophy"], { n: "ideation" }),
      k("Orthodox religious tendencies", "domain", ["religion", "tradition"], { pl: true, n: "orthodox religious tendencies", in: "orthodox religion" }),
    ],
    pos: [
      k("Benevolence", "quality", ["humanity", "service", "money"], { adj: "benevolent" }),
      k("Broad-mindedness", "quality", ["mind", "philosophy"], { adj: "broad-minded" }),
      k("Executive ability", "quality", ["business", "leadership", "structure"], { n: "executive ability", adj: "capable in executive matters" }),
      k("Legal ability", "quality", ["law"], { n: "legal ability", adj: "able in legal matters" }),
      k("Respect for law", "quality", ["law", "tradition"], { n: "respect for law", adj: "law-abiding" }),
      k("Charity", "quality", ["money", "service", "humanity"], { adj: "charitable" }),
      k("Success", "state", ["career", "money", "success"], { adj: "successful" }),
      k("Reverence", "quality", ["religion", "spirit"], { adj: "reverent" }),
      k("Conservatism", "quality", ["tradition", "method", "money"], { adj: "conservative" }),
      k("Opulence", "state", ["money", "material"], { adj: "opulent", det: "abundant" }),
      k("Popularity", "state", ["public", "social", "publicity"], { adj: "popular" }),
      k("Honor", "state", ["honor"], { adj: "honorable" }),
    ],
    neg: [
      k("Overconfidence", "quality", ["judgment", "self"], { adj: "overconfident" }),
      k("Extravagance", "quality", ["money"], { adj: "extravagant" }),
      k("Indolence", "quality", ["work", "effort"], { adj: "indolent" }),
      k("Prodigality", "quality", ["money"], { adj: "prodigal" }),
      k("Showiness", "quality", ["social", "beauty"], { adj: "showy" }),
      k("Bombast", "quality", ["speech"], { adj: "bombastic" }),
      k("Dissipation", "quality", ["pleasure", "health", "money"], { adj: "dissipated" }),
      k("Sportiness", "quality", ["sport", "pleasure", "investment"], { adj: "sporting" }),
      k("Lawlessness", "quality", ["law"], { adj: "lawless" }),
      k("Procrastination", "quality", ["time", "work"], { adj: "procrastinating" }),
    ],
  },
  saturn: {
    basic: [
      k("Contraction", "force", ["limitation", "money", "structure"], { adj: "contracted", det: "few" }),
      k("Persistence", "quality", ["effort", "time", "work"], { adj: "persistent" }),
      k("Caution", "quality", ["judgment", "money"], { adj: "cautious" }),
    ],
    pos: [
      k("Faithfulness", "quality", ["partnership", "marriage", "dealings"], { adj: "faithful" }),
      k("Stability", "quality", ["structure", "emotion", "career"], { adj: "stable" }),
      k("Concentration", "quality", ["mind", "effort", "learning"], { adj: "concentrated" }),
      k("Analysis", "quality", ["mind", "science", "reason", "method"], { adj: "analytical" }),
      k("System", "quality", ["structure", "method", "work"], { adj: "systematic" }),
      k("Building qualities", "quality", ["structure", "work", "property"], { pl: true, n: "building qualities", adj: "constructive" }),
      k("Tact", "quality", ["dealings", "social"], { adj: "tactful" }),
      k("Diplomacy", "quality", ["dealings", "social", "partnership"], { adj: "diplomatic" }),
      k("Justice", "quality", ["justice", "law", "dealings"], { adj: "just" }),
      k("Thrift", "quality", ["money"], { adj: "thrifty" }),
      k("Economy", "quality", ["money", "material"], { adj: "economical" }),
      k("Deliberation", "quality", ["judgment", "time"], { adj: "deliberate" }),
      k("Conservatism", "quality", ["tradition", "method", "money"], { adj: "conservative" }),
      k("Endurance", "quality", ["effort", "time", "body"], { adj: "enduring" }),
      k("Discipline", "quality", ["discipline", "children", "work"], { adj: "disciplined" }),
    ],
    neg: [
      k("Crystallization", "quality", ["limitation", "tradition", "change"], { adj: "crystallized" }),
      k("Obstruction", "quality", ["limitation", "conflict"], { adj: "obstructive" }),
      k("Selfishness", "quality", ["self", "money", "dealings"], { adj: "selfish" }),
      k("Slowness", "quality", ["time"], { adj: "slow" }),
      k("Fearfulness", "quality", ["emotion", "conflict"], { adj: "fearful" }),
      k("Limitation", "state", ["limitation"], { adj: "limited", det: "few" }),
      k("Materialism", "quality", ["material", "money"], { adj: "materialistic" }),
      k("Melancholy", "quality", ["emotion", "sorrow"], { adj: "melancholy" }),
      k("Pessimism", "quality", ["mind", "emotion"], { adj: "pessimistic" }),
      k("Avarice", "quality", ["money"], { adj: "avaricious" }),
      k("Secretiveness", "quality", ["secrets"], { adj: "secretive" }),
      k("Suspicion", "quality", ["dealings", "secrets"], { adj: "suspicious" }),
      k("Severity", "quality", ["discipline", "children", "dealings"], { adj: "severe" }),
      k("Cynicism", "quality", ["mind", "faith", "dealings"], { adj: "cynical" }),
    ],
  },
  uranus: {
    basic: [
      k("The Awakener", "force", ["change", "spirit"], { n: "the awakening influence", adj: "awakening" }),
      k("Altruism", "quality", ["humanity", "service"], { adj: "altruistic" }),
      k("Inventiveness", "quality", ["invention", "science"], { adj: "inventive" }),
      k("Originality", "quality", ["invention", "art", "mind"], { adj: "original" }),
      k("Sudden action", "event", ["change", "event"], { adj: "sudden", n: "sudden action" }),
      k("Unconventionality", "quality", ["freedom", "tradition", "social"], { adj: "unconventional" }),
    ],
    pos: [
      k("Progressiveness", "quality", ["change", "invention", "ideals"], { adj: "progressive" }),
      k("Universality", "quality", ["humanity", "ideals"], { adj: "universal in outlook" }),
      k("Universal love of humanity", "quality", ["humanity", "love"], { n: "a universal love of humanity", adj: "loving toward all humanity" }),
      k("Impersonality", "quality", ["dealings", "humanity"], { adj: "impersonal" }),
      k("Independence", "quality", ["freedom", "self"], { adj: "independent" }),
      k("Love of liberty", "quality", ["freedom"], { n: "a love of liberty", adj: "liberty-loving" }),
      k("Romance", "domain", ["love", "imagination"], { adj: "romantic", in: "romance" }),
      k("Intuition", "quality", ["psychic", "mind"], { adj: "intuitive" }),
    ],
    neg: [
      k("Eccentricity", "quality", ["social", "self"], { adj: "eccentric" }),
      k("Spasmodic action", "quality", ["change", "work"], { adj: "spasmodic", n: "spasmodic action" }),
      k("Bohemianism", "quality", ["social", "pleasure", "freedom"], { adj: "bohemian" }),
      k("Fanaticism", "quality", ["ideals", "conflict", "religion"], { adj: "fanatical" }),
      k("Irresponsibility", "quality", ["work", "dealings"], { adj: "irresponsible" }),
      k("Licentiousness", "quality", ["sex", "pleasure"], { adj: "licentious" }),
      k("Anarchy", "quality", ["law", "freedom", "power"], { adj: "anarchic" }),
    ],
  },
  neptune: {
    basic: [
      k("Superphysical entities of all degrees", "domain", ["psychic", "spirit", "occult"], { pl: true, n: "superphysical entities and impressions from them", in: "impressions from superphysical entities" }),
      k("Divinity", "domain", ["spirit", "religion"], { in: "the divine" }),
      k("Occultism", "domain", ["occult"], { in: "occultism" }),
      k("Knowledge from sources above reason", "domain", ["psychic", "learning", "spirit"], { in: "knowledge from sources above reason" }),
    ],
    pos: [
      k("Spirituality", "quality", ["spirit"], { adj: "spiritual" }),
      k("Intuition", "quality", ["psychic", "mind"], { adj: "intuitive" }),
      k("Inspiration", "quality", ["spirit", "art", "music"], { adj: "inspired" }),
      k("Clairvoyance", "quality", ["psychic"], { adj: "clairvoyant" }),
      k("Prophecy", "quality", ["psychic", "religion"], { adj: "prophetic" }),
      k("Devotion", "quality", ["religion", "spirit", "love"], { adj: "devoted" }),
      k("Music", "domain", ["music", "art"], { adj: "musical", in: "music" }),
    ],
    neg: [
      k("Delusions", "quality", ["mind", "psychic"], { pl: true, adj: "deluded" }),
      k("Chaotic mental conditions", "state", ["mind", "health"], { pl: true, n: "chaotic mental conditions", sphere: "character" }),
      k("Morbidity", "quality", ["emotion", "health", "death"], { adj: "morbid" }),
      k("Fraud", "quality", ["dealings", "money", "truth"], { adj: "fraudulent" }),
      k("Incoherence", "quality", ["mind", "speech"], { adj: "incoherent" }),
      k("Deception", "quality", ["dealings", "truth"], { adj: "deceptive" }),
      k("Dishonesty", "quality", ["dealings", "money", "truth"], { adj: "dishonest" }),
      k("Mediumship", "state", ["psychic"], { n: "mediumship", sphere: "character" }),
    ],
  },
  pluto: {
    basic: [
      k("Renewing", "force", ["change", "spirit", "growth"], { adj: "renewing", n: "a renewing influence" }),
      k("Enlivening", "force", ["vitality", "change"], { adj: "enlivening", n: "an enlivening influence" }),
      k("Breaking open", "force", ["change", "conflict"], { adj: "breaking open", n: "a breaking open" }),
      k("Germinating", "force", ["growth", "change"], { adj: "germinating", n: "a germinating power" }),
      k("Erupting", "force", ["conflict", "change", "event"], { adj: "erupting", n: "an erupting force" }),
      k("Reorganizing", "force", ["structure", "change", "business"], { adj: "reorganizing", n: "a reorganizing power" }),
      k("Provoking", "force", ["conflict", "change"], { adj: "provoking", n: "a provoking influence" }),
      k("Transition", "event", ["change", "death"], { n: "transition" }),
    ],
    pos: [
      k("Regeneration", "quality", ["spirit", "healing", "change"], { adj: "regenerative" }),
      k("Transmutation", "quality", ["spirit", "change", "occult"], { adj: "transmuting" }),
      k("Positive clairvoyance", "quality", ["psychic"], { adj: "positively clairvoyant" }),
      k("Revivification", "quality", ["vitality", "healing"], { adj: "revivifying" }),
      k("Universal welfare", "domain", ["humanity", "service"], { in: "universal welfare" }),
      k("Motivation to strive for spiritual power", "quality", ["spirit", "power", "ambition"], { n: "a motivation to strive for spiritual power", adj: "driven to strive for spiritual power" }),
    ],
    neg: [
      k("Force", "quality", ["power", "conflict"], { adj: "forceful" }),
      k("Defiance", "quality", ["conflict", "authority"], { adj: "defiant" }),
      k("Death", "state", ["death"], { sphere: "circumstance" }),
      k("Destruction", "quality", ["conflict", "death"], { adj: "destructive" }),
      k("Fanaticism", "quality", ["ideals", "conflict", "religion"], { adj: "fanatical" }),
      k("Struggle", "state", ["conflict", "effort"], { adj: "struggling" }),
      k("Sensuality", "quality", ["sex", "pleasure", "body"], { adj: "sensual" }),
      k("Regimentation", "quality", ["structure", "power", "discipline"], { adj: "regimented" }),
      k("The underworld", "domain", ["secrets", "conflict", "death"], { n: "the underworld", in: "the underworld" }),
      k("Black magic", "domain", ["occult", "magic"], { in: "black magic" }),
      k("Decomposition", "state", ["death", "health"], { sphere: "circumstance" }),
    ],
  },
};

// ───────────────────────────── HOUSES ─────────────────────────────
// Houses have one list in the book (no positive/negative), all circumstance.

const HOUSE_DRAFTS: Record<number, Draft[]> = {
  1: [
    k("Beginnings", "event", ["event", "self", "change"], { in: "beginnings" }),
    k("Early environment", "domain", ["home", "family", "self"], { n: "the early environment", in: "the early environment" }),
    k("Personality", "domain", ["self", "social"], { n: "the personality", in: "the personality" }),
    k("Physical body", "thing", ["body", "health"], { n: "the physical body", in: "the physical body" }),
  ],
  2: [
    k("Finance", "domain", ["money"], { in: "financial matters" }),
    k("Freedom given by money", "state", ["money", "freedom"], { n: "the freedom given by money", in: "the freedom that money gives" }),
    k("Resources", "thing", ["money", "material"], { pl: true, in: "the use of resources" }),
  ],
  3: [
    k("Lower mind", "domain", ["mind", "reason"], { n: "the concrete mind", in: "the concrete mind" }),
    k("Writing and speaking", "domain", ["writing", "speech", "communication"], { in: "writing and speaking" }),
    k("Short journeys", "domain", ["travel"], { in: "short journeys" }),
    k("Brothers and sisters", "person", ["siblings", "family"], { pl: true, in: "relations with brothers and sisters" }),
  ],
  4: [
    k("The home", "domain", ["home", "family"], { n: "the home", in: "the home" }),
    k("The mother", "person", ["mother", "family"], { n: "the mother", in: "relations with the mother" }),
    k("Conditions at the end of life", "state", ["time", "destiny", "home"], { n: "the conditions at the end of life", in: "the conditions at the end of life" }),
    k("Lands", "thing", ["property"], { pl: true, in: "lands" }),
    k("Mines", "thing", ["property", "business"], { pl: true, in: "mines" }),
    k("Hotels", "thing", ["property", "business"], { pl: true, in: "hotels" }),
  ],
  5: [
    k("Pleasure", "domain", ["pleasure"], { pl: true, in: "pleasures", n: "pleasures" }),
    k("Education", "domain", ["education", "learning", "children"], { in: "educational methods" }),
    k("Children", "person", ["children"], { pl: true, in: "the raising of children" }),
    k("Publications", "domain", ["publishing", "writing"], { pl: true, in: "publishing matters" }),
    k("Speculation", "domain", ["investment", "money"], { in: "investments" }),
  ],
  6: [
    k("Service", "domain", ["service", "work"], { in: "service" }),
    k("Relations with employers and employees", "domain", ["employment", "work", "dealings"], { n: "relations with employers and employees", in: "relations with employers and employees", pl: true, who: "employers and employees" }),
    k("Health and sickness", "domain", ["health", "body"], { n: "health", in: "matters of health" }),
  ],
  7: [
    k("Partnership", "domain", ["partnership", "business"], { in: "partnerships", n: "partnerships", pl: true, who: "partners" }),
    k("Marriage", "domain", ["marriage", "love"], { in: "marriage", who: "marriage partner" }),
    k("The public", "person", ["public", "publicity"], { n: "the public", in: "dealings with the public" }),
    k("Lawsuits", "domain", ["law", "conflict"], { in: "lawsuits" }),
  ],
  8: [
    k("Legacies", "thing", ["money", "death"], { pl: true, in: "legacies" }),
    k("Cause of death", "event", ["death"], { n: "the cause of death", in: "the manner of death" }),
    k("Occult", "domain", ["occult", "mysticism"], { n: "the occult", in: "the occult" }),
    k("Tragedy", "state", ["sorrow", "death", "event"], { in: "tragedy" }),
    k("Regeneration", "domain", ["spirit", "healing", "change"], { in: "regeneration" }),
    k("Taxes", "thing", ["money", "law"], { pl: true, in: "taxes" }),
  ],
  9: [
    k("Higher mind", "domain", ["mind", "philosophy", "spirit"], { n: "the higher mind", in: "the higher mind" }),
    k("Religion", "domain", ["religion"], { in: "religion" }),
    k("Law", "domain", ["law", "justice"], { in: "the law" }),
    k("Long journeys", "domain", ["travel"], { in: "long journeys" }),
  ],
  10: [
    k("Profession", "domain", ["career", "work"], { n: "the profession", in: "the profession" }),
    k("Standing in community", "state", ["position", "honor", "public"], { n: "standing in the community", in: "standing in the community" }),
    k("The father", "person", ["father", "family"], { n: "the father", in: "relations with the father" }),
  ],
  11: [
    k("Friends", "person", ["friends", "social"], { pl: true, in: "friendships" }),
    k("Hopes", "domain", ["ideals", "ambition"], { pl: true, in: "hopes" }),
    k("Wishes", "domain", ["ideals"], { pl: true, in: "wishes" }),
  ],
  12: [
    k("Paying debts of destiny", "state", ["destiny", "limitation"], { n: "the paying of debts of destiny", in: "paying the debts of destiny" }),
    k("Mysticism", "domain", ["mysticism"], { in: "mysticism" }),
    k("Limitations", "state", ["limitation"], { pl: true, in: "limitations" }),
    k("Secrecy", "domain", ["secrets"], { in: "secret matters" }),
    k("Institutions for care of unfortunates", "domain", ["institutions", "service", "health"], { n: "institutions for the care of the unfortunate", in: "institutions for the care of the unfortunate" }),
  ],
};

// ───────────────────────────── ASSEMBLED ─────────────────────────────

export const SIGN_KEYWORDS: Record<SignKey, Keyword[]> = Object.fromEntries(
  (Object.keys(SIGN_DRAFTS) as SignKey[]).map((s) => [s, build("sign", s, SIGN_DRAFTS[s])]),
) as Record<SignKey, Keyword[]>;

export const PLANET_KEYWORDS: Record<PlanetKey, Keyword[]> = Object.fromEntries(
  (Object.keys(PLANET_DRAFTS) as PlanetKey[]).map((p) => [p, build("planet", p, PLANET_DRAFTS[p])]),
) as Record<PlanetKey, Keyword[]>;

export const HOUSE_KEYWORDS: Record<number, Keyword[]> = Object.fromEntries(
  Object.keys(HOUSE_DRAFTS).map((h) => [h, build("house", `h${h}`, { basic: HOUSE_DRAFTS[Number(h)], pos: [], neg: [] })]),
);

export const ALL_KEYWORDS: Keyword[] = [
  ...Object.values(PLANET_KEYWORDS).flat(),
  ...Object.values(SIGN_KEYWORDS).flat(),
  ...Object.values(HOUSE_KEYWORDS).flat(),
];

export const PLANET_KEYS = Object.keys(PLANET_DRAFTS) as PlanetKey[];
export const isPlanet = (k: string): k is PlanetKey => k in PLANET_DRAFTS;

/** The book's one-line nature of the sign groups ("NATURE OF THE SIGNS"). */
export const SIGN_NATURE = {
  modality: {
    cardinal: "initiative, activity, action",
    fixed: "stability, persistence",
    mutable: "flexibility, adaptability",
  },
  element: {
    fire: "spiritual power, impulse",
    earth: "materialism, practicality",
    air: "intellectuality, sociability",
    water: "spiritual and psychic qualities, emotion",
  },
} as const;
