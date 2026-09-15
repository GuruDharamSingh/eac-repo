/**
 * The topic space every keyword lives in.
 *
 * The Rosicrucian keyword method is "combine the keyword of the planet with
 * the keyword of the sign / house it is in". The book never says WHICH of a
 * planet's dozen keywords goes with WHICH of a house's five — the worked
 * example just shows the author doing it well: "persistence (Saturn) in
 * investigating the secret forces of nature (Scorpio)", "few (Saturn)
 * children (5th)", "thrift (Saturn) … income from books (5th)". The rule
 * that is implicit there is: a keyword pairs with another keyword when they
 * are ABOUT the same thing.
 *
 * So every keyword is tagged with the domains it is about, and the engine
 * pairs keywords by the overlap of their domain sets, smoothed by the graph
 * below (a "publishing" keyword is a near match for a "writing" one). That
 * is the whole "vector database": each keyword is a sparse vector over these
 * domains, and pairing is a similarity search in that space. It is small
 * enough to be exhaustive and inspectable — there is no learned component,
 * every pairing can be traced back to a tag.
 */

export const DOMAINS = [
  // the person
  "self", "body", "vitality", "health", "emotion", "mind", "reason", "imagination", "judgment", "psychic",
  // doing
  "effort", "work", "skill", "method", "structure", "discipline", "time", "change", "event", "growth", "limitation",
  // speaking, learning, moving
  "speech", "communication", "writing", "literature", "publishing", "learning", "education", "science", "invention", "travel",
  // home and kin
  "home", "family", "mother", "father", "siblings", "children",
  // love and others
  "love", "sex", "marriage", "partnership", "social", "dealings", "friends", "groups", "public", "publicity", "humanity",
  // the world
  "money", "material", "property", "business", "investment", "employment", "service", "career", "position", "honor", "success",
  // power
  "authority", "leadership", "power", "law", "justice", "conflict", "military", "freedom", "tradition",
  // the arts
  "art", "beauty", "music", "pleasure", "sport",
  // the unseen
  "religion", "philosophy", "ideals", "faith", "spirit", "mysticism", "occult", "magic", "healing", "secrets", "death", "destiny", "sorrow", "institutions", "truth", "ambition",
] as const;

export type Domain = (typeof DOMAINS)[number];

/**
 * Neighbouring topics. An edge says "a keyword about X is a fair partner
 * for a keyword about Y". Undirected; the weight is how close (1 = same).
 */
const EDGES: Array<[Domain, Domain, number]> = [
  ["writing", "literature", 0.9], ["literature", "publishing", 0.8], ["writing", "publishing", 0.8],
  ["speech", "communication", 0.9], ["writing", "communication", 0.8], ["speech", "public", 0.5],
  ["learning", "education", 0.9], ["learning", "mind", 0.7], ["education", "children", 0.6], ["learning", "science", 0.6],
  ["mind", "reason", 0.9], ["reason", "science", 0.7], ["science", "invention", 0.8], ["mind", "judgment", 0.6],
  ["imagination", "art", 0.6], ["imagination", "psychic", 0.5], ["emotion", "psychic", 0.4],
  ["money", "material", 0.8], ["money", "business", 0.8], ["money", "investment", 0.8], ["money", "property", 0.7],
  ["business", "partnership", 0.6], ["business", "employment", 0.6], ["business", "career", 0.6], ["business", "structure", 0.5],
  ["work", "employment", 0.8], ["work", "service", 0.7], ["work", "effort", 0.8], ["work", "skill", 0.7], ["work", "method", 0.7],
  ["career", "position", 0.9], ["position", "honor", 0.8], ["position", "authority", 0.7], ["career", "success", 0.7], ["honor", "success", 0.6],
  ["authority", "leadership", 0.9], ["authority", "power", 0.8], ["leadership", "power", 0.7], ["ambition", "career", 0.8], ["ambition", "position", 0.8], ["ambition", "effort", 0.6],
  ["law", "justice", 0.9], ["law", "authority", 0.5], ["law", "conflict", 0.4], ["justice", "dealings", 0.6],
  ["religion", "philosophy", 0.8], ["religion", "faith", 0.9], ["philosophy", "ideals", 0.7], ["religion", "spirit", 0.7], ["philosophy", "mind", 0.5], ["religion", "tradition", 0.6],
  ["spirit", "mysticism", 0.9], ["mysticism", "occult", 0.8], ["occult", "psychic", 0.8], ["occult", "magic", 0.8], ["occult", "secrets", 0.7], ["spirit", "psychic", 0.6], ["occult", "science", 0.4],
  ["healing", "health", 0.9], ["health", "body", 0.8], ["healing", "occult", 0.5], ["healing", "service", 0.5], ["vitality", "body", 0.8], ["vitality", "health", 0.7],
  ["sex", "love", 0.7], ["love", "marriage", 0.8], ["marriage", "partnership", 0.9], ["partnership", "dealings", 0.6], ["love", "pleasure", 0.5], ["love", "children", 0.5],
  ["social", "friends", 0.8], ["friends", "groups", 0.8], ["groups", "humanity", 0.6], ["social", "dealings", 0.7], ["social", "public", 0.6], ["public", "publicity", 0.9], ["humanity", "service", 0.6],
  ["home", "family", 0.9], ["home", "emotion", 0.4], ["mother", "emotion", 0.4], ["family", "love", 0.5], ["home", "self", 0.3], ["family", "mother", 0.8], ["family", "father", 0.8], ["family", "siblings", 0.8], ["family", "children", 0.7], ["home", "property", 0.6],
  ["death", "secrets", 0.5], ["death", "occult", 0.6], ["death", "sorrow", 0.7], ["death", "change", 0.6], ["destiny", "limitation", 0.5], ["destiny", "spirit", 0.5],
  ["conflict", "military", 0.9], ["conflict", "power", 0.6], ["conflict", "dealings", 0.5], ["military", "discipline", 0.5],
  ["discipline", "structure", 0.7], ["structure", "method", 0.8], ["discipline", "children", 0.5], ["discipline", "time", 0.5], ["time", "effort", 0.6], ["limitation", "money", 0.4],
  ["change", "event", 0.7], ["change", "travel", 0.5], ["change", "freedom", 0.5], ["growth", "change", 0.6], ["growth", "money", 0.4], ["growth", "success", 0.5],
  ["art", "beauty", 0.9], ["art", "music", 0.8], ["beauty", "pleasure", 0.5], ["pleasure", "sport", 0.6], ["sport", "body", 0.6], ["art", "skill", 0.5],
  ["truth", "dealings", 0.5], ["truth", "reason", 0.4], ["institutions", "service", 0.6], ["institutions", "health", 0.5], ["institutions", "limitation", 0.5],
  ["tradition", "structure", 0.5], ["freedom", "money", 0.3], ["ideals", "spirit", 0.6], ["ideals", "humanity", 0.6], ["faith", "spirit", 0.6],
  ["judgment", "dealings", 0.5], ["emotion", "love", 0.6], ["self", "body", 0.5], ["self", "mind", 0.4], ["self", "honor", 0.4], ["publicity", "publishing", 0.5],
  ["investment", "pleasure", 0.3], ["publishing", "education", 0.4], ["writing", "learning", 0.4], ["literature", "learning", 0.5], ["effort", "publishing", 0.3], ["skill", "invention", 0.5], ["travel", "philosophy", 0.3], ["employment", "service", 0.8], ["method", "healing", 0.4], ["method", "education", 0.5],
];

const NEIGHBOURS: Record<string, Record<string, number>> = {};
for (const [a, b, w] of EDGES) {
  (NEIGHBOURS[a] ??= {})[b] = w;
  (NEIGHBOURS[b] ??= {})[a] = w;
}

/** Closeness of two topics: 1 for the same, the edge weight for neighbours, a little for two-step paths, else 0. */
export function domainCloseness(a: Domain, b: Domain): number {
  if (a === b) return 1;
  const direct = NEIGHBOURS[a]?.[b];
  if (direct !== undefined) return direct;
  let best = 0;
  const na = NEIGHBOURS[a];
  if (na) {
    for (const mid in na) {
      const second = NEIGHBOURS[mid]?.[b];
      if (second !== undefined) best = Math.max(best, na[mid] * second * 0.5);
    }
  }
  return best;
}

/** A sparse vector over domains. */
export type DomainVector = Partial<Record<Domain, number>>;

export function vec(domains: readonly Domain[], weight = 1): DomainVector {
  const v: DomainVector = {};
  for (const d of domains) v[d] = Math.max(v[d] ?? 0, weight);
  return v;
}

export function addVec(into: DomainVector, from: DomainVector, scale = 1): DomainVector {
  for (const k in from) into[k as Domain] = (into[k as Domain] ?? 0) + from[k as Domain]! * scale;
  return into;
}

/**
 * Soft overlap of two domain sets: the best closeness each of `a`'s
 * domains finds in `b`, averaged. Asymmetric on purpose — "how much of
 * `a` is answered by `b`" — callers that want symmetry take the mean of both
 * directions (see `affinity`).
 */
export function coverage(a: DomainVector, b: DomainVector): number {
  let total = 0;
  let weight = 0;
  for (const da in a) {
    let best = 0;
    for (const db in b) {
      const c = domainCloseness(da as Domain, db as Domain);
      if (c > best) best = c;
    }
    const w = a[da as Domain]!;
    total += best * w;
    weight += w;
  }
  return weight === 0 ? 0 : total / weight;
}

/** Symmetric topical affinity, 0–1. */
export function affinity(a: DomainVector, b: DomainVector): number {
  return (coverage(a, b) + coverage(b, a)) / 2;
}

/** Score of a keyword vector against a context bias (chart key, question) — how much the context wants this word. */
export function bias(v: DomainVector, context: DomainVector): number {
  let total = 0;
  for (const d in v) {
    for (const c in context) {
      total += v[d as Domain]! * context[c as Domain]! * domainCloseness(d as Domain, c as Domain);
    }
  }
  return total;
}

/**
 * Words a person might use when asking, mapped to the topics they mean.
 * Used by `ask()` to turn a question into a domain vector. Stems, so
 * "marry", "marriage", "married" all land on the same entry.
 */
export const QUESTION_TERMS: Array<[RegExp, Domain[]]> = [
  [/\b(money|financ|wealth|rich|income|earn|salary|cash|debt|afford|poor|budget)/i, ["money", "material"]],
  [/\b(invest|specul|stock|gambl|bet)/i, ["investment", "money"]],
  [/\b(propert|land|house(?!hold)|real estate|estate)/i, ["property", "home"]],
  [/\b(inherit|legac|will\b)/i, ["money", "death"]],
  [/\b(business|compan|enterprise|trade|commerc|startup|venture)/i, ["business", "money"]],
  [/\b(career|job|profession|vocation|occupation|calling|employ|boss|work(?!shop)|working)/i, ["career", "work", "employment"]],
  [/\b(status|reputation|standing|position|promot|recogni|fame|famous|honou?r)/i, ["position", "honor", "publicity"]],
  [/\b(success|achiev|ambiti|goal|succeed)/i, ["success", "ambition"]],
  [/\b(lead|leader|authority|command|manage|power|control|dominat)/i, ["leadership", "authority", "power"]],
  [/\b(love|romance|romantic|lover|dating|date|affection|heart)/i, ["love"]],
  [/\b(sex|sexual|intima|passion|desire)/i, ["sex", "love"]],
  [/\b(marri|spouse|husband|wife|partner|relationship|couple|wedding|divorce)/i, ["marriage", "partnership"]],
  [/\b(friend|social|people|compan(y|ions)|circle|community|network)/i, ["friends", "social", "groups"]],
  [/\b(public|audience|crowd|popular|fans|followers)/i, ["public", "publicity"]],
  [/\b(famil|relative|kin|ancest|roots|parents)/i, ["family", "home"]],
  [/\b(mother|mom|mum|maternal)/i, ["mother", "family"]],
  [/\b(father|dad|paternal)/i, ["father", "family"]],
  [/\b(brother|sister|sibling)/i, ["siblings", "family"]],
  [/\b(child|children|kid|son|daughter|baby|pregnan|fertil|parent(ing|hood))/i, ["children"]],
  [/\b(home|domestic|household|dwelling|living situation|move house|moving)/i, ["home", "family"]],
  [/\b(health|ill|sick|disease|body|physical|fitness|diet|medic|doctor|heal)/i, ["health", "body", "healing"]],
  [/\b(energy|vital|stamina|strength|tired|fatigue)/i, ["vitality", "body"]],
  [/\b(mind|think|thought|mental|intellect|smart|clever|idea)/i, ["mind", "reason"]],
  [/\b(learn|stud|school|universit|college|educat|teach|course|degree|exam)/i, ["learning", "education"]],
  [/\b(writ|author|book|publish|blog|journal|novel|poet)/i, ["writing", "literature", "publishing"]],
  [/\b(speak|speech|talk|communicat|voice|convers|say|language|words)/i, ["speech", "communication"]],
  [/\b(travel|journey|trip|abroad|foreign|overseas|voyage|move (abroad|countries))/i, ["travel"]],
  [/\b(science|scientif|research|technolog|engineer|computer|invent|innovat)/i, ["science", "invention"]],
  [/\b(art|artist|creativ|paint|draw|design|craft|aesthetic|beaut)/i, ["art", "beauty"]],
  [/\b(music|musician|sing|song|instrument|compose)/i, ["music", "art"]],
  [/\b(fun|pleasure|enjoy|hobby|hobbies|leisure|play|entertain|party|parties)/i, ["pleasure"]],
  [/\b(sport|athlet|exercise|gym|outdoor|compet)/i, ["sport", "body"]],
  [/\b(spirit|soul|god|divine|pray|meditat|faith|belie|sacred|higher)/i, ["spirit", "faith", "religion"]],
  [/\b(religio|church|temple|orthodox|doctrine|theolog)/i, ["religion", "tradition"]],
  [/\b(philosoph|meaning|purpose|wisdom|truth|why am i)/i, ["philosophy", "ideals", "truth"]],
  [/\b(mystic|occult|esoteric|magic|astrolog|tarot|hidden|secret|unseen|initiat)/i, ["mysticism", "occult", "secrets"]],
  [/\b(psychic|intuit|clairvoy|dream|vision|medium|premonition|sixth sense)/i, ["psychic", "imagination"]],
  [/\b(death|die|dying|mortal|loss|grief|bereave)/i, ["death", "sorrow"]],
  [/\b(sad|sorrow|depress|melanchol|grief|unhappy|suffer)/i, ["sorrow", "emotion"]],
  [/\b(emotion|feel|feeling|mood|sensitiv|anxious|anxiety|worry|fear)/i, ["emotion"]],
  [/\b(conflict|fight|enemy|enemies|argu|war|battle|aggress|anger|angry|violen|struggle)/i, ["conflict", "military"]],
  [/\b(law|legal|lawsuit|court|justice|contract|rights|fair)/i, ["law", "justice"]],
  [/\b(free|freedom|liberty|independen|rebel|escape)/i, ["freedom"]],
  [/\b(discipline|routine|habit|structure|organi[sz]|schedule|patien|persist|endur|commit)/i, ["discipline", "structure", "effort"]],
  [/\b(change|transform|transition|crisis|rebirth|renew|breakthrough|sudden)/i, ["change", "event"]],
  [/\b(limit|obstacle|block|restrict|delay|karma|destiny|fate)/i, ["limitation", "destiny"]],
  [/\b(serv|help|volunteer|charit|humanit|cause|altruis)/i, ["service", "humanity"]],
  [/\b(hospital|prison|asylum|institution|retreat|monaster)/i, ["institutions"]],
  [/\b(who am i|myself|identity|personality|character|self|ego|nature|what am i like)/i, ["self"]],
  [/\b(judg|decid|decision|choice|choose|wise)/i, ["judgment"]],
  [/\b(tradition|conservative|old|past|heritage)/i, ["tradition"]],
  [/\b(hope|wish|aspir|dream of|long for)/i, ["ideals", "ambition"]],
  [/\b(group|club|organi[sz]ation|team|society|association|corporat)/i, ["groups", "friends"]],
  [/\b(honest|lie|lying|deceit|deceiv|trust|betray|fraud)/i, ["truth", "dealings"]],
];
