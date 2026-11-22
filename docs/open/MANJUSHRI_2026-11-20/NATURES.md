# Component natures: conversation with Justin

## Turn 1 (to Justin)

Here is what I think you mean. Blocks should not only be things an editor styles from outside. Each block should understand the flow of the page it sits in and behave sensibly without being told, like the course rails but for editing and for how components relate. Each block would have a nature: hot or cold on an active axis, dry or wet on a passive axis. Blocks of different natures pair up, and each answers its neighbours with an opinion. The user interface stays thin; the intelligence lives in the blocks. Correct me where I have it wrong.

Is this the classical scheme: hot and cold as the active pair, dry and wet as the passive pair, with fire as hot and dry, air as hot and wet, water as cold and wet, earth as cold and dry?

My proposal, not yours. Hot or cold is how much a block acts on the visitor and its surroundings. Dry or wet is how much a block keeps its own form versus taking the shape of what is around it.
Fire (hot, dry): the hero banner, the RSVP or checkout block, a call to action. They demand attention and hold their shape.
Air (hot, wet): the forum feed, a live gathering list. They are active but take their content and tone from the record around them.
Water (cold, wet): the block that draws "the record in the address", a gallery that fills with whatever is shown. Quiet and adaptive.
Earth (cold, dry): the facts table, the footer. Still, fixed, a foundation.
It does not fit cleanly for a feature card (it can be warm or cool depending on its picture) or a gallery (dry when curated, wet when filled from a record).

Two scenes. Two fire blocks stacked, a hero then a checkout: each notices the other, and the second cools itself a step (quieter colour, less size) so the visitor is not shouted at twice. Second scene: a page of only earth blocks, a facts table, a footer and a text block. The editor's rail says "this page has no fire: nothing invites anyone to act. Add a hero or an RSVP near the top?"

Temperature variant, as something you would see: the same hero in a hot form (large, saturated, button prominent) and a cool form (small, muted, text-led). Humidity variant: the same card in a dry form (fixed layout, your own picture and words) and a wet form (it takes its colours and wording from the gathering it shows).

My doubt: nature could become one more setting nobody understands. It only earns its place if the editor shows consequences, such as a gentle note on the page, rather than asking owners to tag blocks.

Questions:
1. Is a block's nature fixed by its maker, chosen by the site owner, or worked out from where it sits? Or can a block be born with a nature and drift with its neighbours?
2. Should a block change itself when it senses its neighbours, or only suggest, so the owner decides?
3. Does a page, or a whole site, have a temperature and humidity of its own, as a sum of its blocks, perhaps one you could set as an intention?
4. Do you want other pairs beyond these two, and what are your own definitions of hot, cold, dry and wet? Yours would replace mine.

## Justin, in reply

He answered with a document instead of the four questions: "this was for the presets for posts to show how i made it a bit more anticipatory... show that one to the side agent". Document: "Channel campaigns: the short version", dated Nov 16, 2026.

## Turn 2 (to Justin)

Your campaign design anticipates without ever deciding. Three things do it. Each answer in the step builder sorts the next list (after an ask, answers come first; after a tease, the climb comes first), and nothing is hidden. The role rules give a routine its grammar: every ask is followed by an answer, one peak, joints are places to stop, the close points outward. And the four effect patterns, with feelings resolving forward, give the sorting its logic. Pivots are offered at the close and never taken.

Carried across to pages, as my proposal. The preset is a block type, the step is one block placed on one page, and the routine is the page, or a template of blocks about one anchor such as a gathering. The role is the job a block does there: opener, proof, ask, close. The effect is what it does to the visitor, so hero and call to action sit warm, a facts table sits cool, and the effect line becomes your temperature. Dry and wet fit your "form": how fixed or how filled-from-the-record the block is. The lever is a setting (look, hover, screen size). The "or" is an alternate block for the same job. Guidance notes are notes on a block. Pivot is "next page" or "a related page". Where it forces: pages are read together, not in order, so "climb" and "resolve forward" mean less. Some blocks, like footers, have no effect.

Your two rules. "Everything is chosen by hand, builders suggest and sort" means the editor's rail only sorts and offers, never inserts. "Branding comes last" means the look is applied to a finished page and never decides which blocks appear. But "respond opinionatedly to what is around them" sounds like more than suggesting. Do you mean blocks may adjust themselves, or only speak up?

A gathering page on a study-group site:

| Block | Role | Nature or effect | Why it is here |
| --- | --- | --- | --- |
| Hero | opener | hot, dry (hype) | names the gathering |
| Facts table | proof | cold, dry (report) | date, place, teacher |
| Gathering text | build | cold, wet (continuing) | fills from the record |
| RSVP | ask | hot, dry (invite) | the one ask |
| Forum feed | answer | hot, wet (glad) | where replies land |
| Footer | joint | cold, dry (buffer) | calm end |

The rail would say two things. "The RSVP is an ask with nothing after it: offer the forum feed as its answer." And "A facts table sits between hero and RSVP, so the climb is broken: sort 'move it below the text' first."

My doubt: your effects are about a sequence in time, and a page is seen at once, so the climb may only work as top-to-bottom reading order.

Questions:
1. Should I list blocks as presets, steps and routines, or is that too literal for pages?
2. Do effects and natures stay separate lists (temperature and humidity as an extra layer over your 15), or is temperature simply your effect colour line?
3. Does a block change itself or only suggest?

## PM note: use Justin's vocabulary, not a second one (2026-11-20)

Justin started a "preset-looks" session on his PC (`C:\Users\Justi\Elkdonis Arts Collective\preset-looks\`, session system32-11). It follows his two docs unchanged and will not rename anything in them. Our block-side names line up with those docs:

| His word (Channel) | On a page | Where it lives or will live |
| --- | --- | --- |
| preset (effect + form + guidance + template; base / level / scope) | a block type; an org's or person's own version of one keeps a `base` pointer | `BlockDef`; named looks and patterns (doctrine move 7) |
| lever (a dial inside a form); each option `leans` toward an effect | a setting or a look variant (base, hover, screen size); a variant can carry `leans` | `PropDef`, `morph` (`states`, `at`) |
| step (preset, role, wraps; when, who, carries, or, change, pivot) | one block placed on one page, and why it is there | the block's node in the page document |
| role (opener, build, turn, peak, joint, ask, answer, proof, gather, callback, close, hand-off, probe) | the job a block does on this page | not stored yet |
| routine (3 to 8 steps about an anchor) | a page, or a template of blocks about one record | the page document; route templates |
| effect (15, on a cool-to-warm line) | what a block does to the visitor; candidate for "temperature" | not stored yet |
| guidance, and notes from people who used it | notes on a block or a pattern | not stored yet |
| machine / aid / human (his build map: "make as much machine as possible, put an aid on every human moment that can go wrong, and never fake a human moment") | machine = what a smart block works out from its surroundings (`reads`, contract C5); aid = what the editor helps with (part outlines, rails, sorted suggestions); human = what a person decides (the words, the choice of block, publishing) | C5; the rails are not built |

His two standing rules carry over as written: the builders suggest and sort and never pick; branding (the look) comes last and never decides which blocks appear.

Open with Justin (the side agent's turn 2 questions): whether effects and natures are one list or two; whether a block may change itself or only speak up; whether "preset, step, routine" is too literal for pages.
