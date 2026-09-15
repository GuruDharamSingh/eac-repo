# The Rosicrucian keyword system — how words are chosen

`@elkdonis/astro/keywords` reads a chart by the method in *Astrological Keyword
System of Analyzing Character and Destiny* (The Rosicrucian Fellowship, by J.D.,
after Heindel's *Message of the Stars* pp. 405–408). The book supplies the
keywords and eleven steps; it does not say which of a planet's fifteen words
goes with which of a house's five, nor how to say the result. This document is
that missing part: what words work where, and when.

The source transcription lives at `astrologychart2/Keywords/astrokeywords.md`.
The prototype analyzer in that folder took the first word of every list and
dropped it into fixed sentences; it is superseded by this package and left as
reference.

## The pieces

| file | what it holds |
| --- | --- |
| `lexicon.ts` | every keyword in the book, verbatim, with its grammatical forms and topic tags |
| `domains.ts` | the ~90 topics a keyword can be about, the graph of which topics neighbour which, and the words a question uses for them |
| `nature.ts` | step 1: harmonious / inharmonious, the conjunction table, the aspect verbs |
| `select.ts` | the scorer: which word pairs with which |
| `compose.ts` | steps 1–10 for one aspect: the sentence frames |
| `reading.ts` | step 11: the key to the chart, every aspect read under it, the composite |
| `ask.ts` | a question → the sentences of the reading that answer it |
| `corpus.ts` | optional: other authors' delineations, parsed and retrieved beside the reading |

## What a keyword knows about itself

The book's word is kept exactly (`text`). Around it:

- **role** — what kind of word it is, which decides the frames that will take
  it: a *quality* (generosity), a *faculty* (the will, the reason), a *force*
  (dynamic energy, contraction), a *domain* of activity (healing, publications),
  a *person* (men, the mother, children), a *thing* (lands, legacies), a *state*
  (success, sorrow) or an *event* (sudden action, cause of death).
- **forms** — the noun phrase, the adjective, the phrase used after "in", a
  counting word where the keyword is really a quantity. The book's own example
  is the model: *Conservatism* becomes "conservative (Saturn) in methods of
  healing (Scorpio)", *Contraction* becomes "few (Saturn) children (5th)".
- **domains** — what the word is about. *Thrift* is about money; *Discipline*
  about discipline, children and work; *Publications* about publishing and
  writing. This is the whole basis of pairing.
- **sphere** — character (planets in signs, "inner capacities") or circumstance
  (planets in houses, "details of the life"), per the book's General Notes.

Words the book lists but that cannot be put in a sentence (*What one really is*)
are marked `quiet`: they appear in the reference tables and nowhere else.

## Which set applies (the book's rule)

Basic keywords always. Positive qualities with a harmonious aspect; negative
with an inharmonious one. Signs follow the aspect of the planet in them. A
planet with no major aspect is read from its basic words only — the book gives
no other rule.

Sextile and trine are harmonious; square and opposition inharmonious (the
opposition carries the book's note about the affinity of opposite signs).
Conjunctions follow Heindel: Sun, Venus, Jupiter benefic; Mars, Saturn,
Uranus, Neptune adverse; Moon and Mercury take the nature of their companion;
Pluto, absent from Heindel, is treated as adverse from its keywords. A benefic
with a malefic is *mixed*: the inharmonious verbs are used, but the benefic
keeps its positive words. A few pairs Heindel reads outright are listed in
`PAIR_OVERRIDES`. **This table is an approximation of *Simplified Scientific
Astrology* pp. 98–99, which is not in the repo; correct it from the source when
available.**

## Which words work where — the scorer

Every candidate pairing is scored and the best kept:

- **affinity** (the main term) — the two words are about the same thing. Each
  word's domain tags form a sparse vector; affinity is the soft overlap of two
  vectors, smoothed by the topic graph (a *publishing* word is 0.8 of a
  *writing* word, 0.4 of an *education* word). This is what makes *thrift* go
  with *investments* and *discipline* with *children* rather than the reverse.
  It is a similarity search over a small, inspectable vector space — the
  "vector database" is a table you can read.
- **salience** — the book lists the most characteristic word first; ties go
  to the author's ordering.
- **context** — see *when*, below.
- **novelty** — a word already said in the current block is excluded; the
  same word from another factor (*Justice* is both Saturn's and Capricorn's)
  is discouraged; a word said elsewhere in the chart is discouraged; a
  pairing already made elsewhere in the chart is excluded.
- **tautology** — a pair of the same word in two forms (*ambition* /
  *ambitions*) is a repetition, not a combination, and is pushed out.

A frame is only offered words that have the form it needs — an adjective
frame never sees a word without an adjective — so nothing is forced into a
shape it cannot take. If nothing passes the topical bar the step still says
the plainest thing the book allows ("Combative (Mars) in the home (4th)")
rather than nothing.

Two exceptions to affinity, both from the book's example:

- A **counting word** needs no topical match: *contraction* → "few children",
  *expansion* → "many friends". It stands beside, not instead of, a
  describing sentence ("disciplined children").
- A **faculty** lands in whatever the house is about — "the main ambitions of
  the life (Sun) are in connection with partnerships (7th)" — so that frame
  needs little topical match and takes the house's leading field.

## The frames — where words go

**Step 4, planet in sign (character).** *Sign quality* blended with *planet
quality*; *planet adjective* in *sign field*; *planet faculty* for / directed to
*sign field*; *sign quality* in *planet field*.

**Step 5, planet with planet (character, abstract).** *Quality* working
together with / at odds with *quality*; *quality* in *dealings with the other's
people* ("tact (Saturn) in all dealings with men (Sun)"); *adjective* + *faculty*
("an enduring (Saturn) will (Sun)"), or, adverse, *faculty* hampered by
*quality*.

**Step 7, planet in house (circumstance).** *Count* + *countable*; *adjective*
+ *the house's person* ("a generous (Sun) marriage partner (7th)"); *adjective*
in *house affair*; *faculty* in connection with *house field*; *force* in
*house affair*; *planet's people* figure in *house affair*. Things (lands,
mines, legacies) take a quality only on a close match — they are had, not done.

**Steps 8 and 9, the sevenfold combination (circumstance).** One word from
each of the seven factors, chained: through *[source planet quality]* the
native has the capacity to succeed in *[source house affair]* along the lines
of *[source sign field]*; this would *[verb]* *[target house affair]*, *[verb]*
*[target planet's people or field]* and *[verb]* *[target sign field]*. Each
pick is chosen against the last, so the chain stays on one subject. Fields are
preferred to qualities in the sign and target slots (the book: "publicity",
"his position in the world"). Under an inharmonious aspect the target slots
use *basic* words only — "detract from suspicion" would be a double negative.
The two directions are one block: step 9 may not reuse step 8's words, but
both may reuse words from steps 4–7, as the book's own example does.

**Step 10.** The same choices spoken again without attributions: "they" (or a
name), no planet, sign or house named. Character from steps 4–5, circumstances
from 7–9.

**The abbreviated method** (the book's alternate) makes one sentence from one
word per factor, three ways, each dropping the words the last one used.

## When — the key to the chart

The book: any position "may represent any one of a number of possibilities and
the only way to get a reasonable line on which one of these will develop is
first to ascertain the key to the chart as a whole" — a strong group of
planets, or the ruling planet. Its example: a 12th-house group makes a mystical
type, and then 8th-house planets mean occult ability, not legacies.

`chartKey()` finds the tenanted houses (two or more planets, weighted: Sun and
Moon most, the ruler extra, outer planets least), the ruler of the rising sign
and where it sits, the dominant element and modality, and the balance of
harmonious to inharmonious aspects. From these it builds a **context vector**
over the domains — the type-domains of the leading house at full weight, its
other keywords lightly, the ruler's sign and house, the element.

The context reaches every choice in two ways:

1. every pairing gets a small pull toward context-heavy words;
2. **a house's affairs are pre-selected by the key**: of the 8th house's six
   words, an occult chart keeps *the occult*, *regeneration* and one more in
   play and lets *legacies* and *taxes* go. That is the book's rule made
   literal.

A question adds its own topics to the context the same way (`topicContext`).

Aspects are read strongest first (exactness × planet weight). Words a planet
has already used in a stronger aspect are discouraged in the weaker ones, and
an identical pairing is never made twice, so the Sun in three aspects is
described three ways.

## Step 11 — the composite

With no recipe beyond "correlate and balance similarly", `readChart()` does what
a reader does with a page of aspect summaries: the type from the key; the
character words weighted by the strength of the aspects that used them, split
into good-judgment and extremes; words that recur across aspects called out as
the most reliable; the strongest aspect quoted; circumstances as the strongest
sentence for each leading domain; and **tensions** — domains the chart speaks of
both harmoniously and inharmoniously — named as where judgment will be tested.

## Asking

`ask(reading, question)` turns the question into a domain vector with the
`QUESTION_TERMS` word list ("marry", "spouse", "partner" → marriage,
partnership), narrows to any planet, sign or house named, and ranks the
reading's sentences by topical fit × aspect strength, at most two per aspect,
sevenfold sentences favoured. The answer is a retrieval: nothing is generated
at question time, and every line names the aspect it came from. "Who am I"
favours character sentences; an empty question returns the key and the
composite.

## Other authors' texts

`corpus.ts` parses compilations in the format of
`astrologychart2/examples/SUN.txt` ("Natal Sun in Aries", "(Betty Lundsted)",
"Sun trine Moon (Robert Pelletier)") into passages keyed by placement, each
with a domain vector counted from its own words. `passagesFor(corpus, chart,
question)` returns the passages whose placement is actually in the chart,
ranked for the question, one per author per placement. These are shown beside
the keyword reading, attributed, never merged into it. The files are read from
wherever the user keeps them; none ship with the repo.

Texts that would improve the system most: Heindel's *Message of the Stars*
(the planet-in-sign, in-house and in-aspect chapters this method is built on)
and *Simplified Scientific Astrology* pp. 98–99 (the conjunction table).

## Running

```
pnpm --filter @elkdonis/astro test:keywords      # book example, 450 aspect readings, 1440 placements, chart, questions
tsx scripts/corpus-smoke.ts <path to SUN.txt>    # parse a delineation file
```
