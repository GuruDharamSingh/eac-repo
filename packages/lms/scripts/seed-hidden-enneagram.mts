// ============================================================================
// Seed "Enneagram Foundations" on the `hidden-enneagram` org for Sophia.
//
// SCAFFOLDING for the guide (aeon) to edit in /studio. Text is adapted from
// The Hidden Enneagram site corpus (the PDFs under the app's public folder).
// The course is `unlisted` — reachable by link from the ÆON landing page,
// off the catalogue — until the guide flips it to `public`.
//
// Idempotent: steps are matched by slug; publish only writes a version when
// something changed. Run inside an app container:
//   docker exec eac-sophia sh -c "cd /app/packages/lms && pnpm exec tsx scripts/seed-hidden-enneagram.mts"
// ============================================================================
import { db } from '@elkdonis/db';
import type { LmsViewer } from '../src/index.ts';
import { seedCourse, type SeedModule, type SeedStep } from './seed-lib.mts';

const ORG = 'hidden-enneagram';
const SLUG = 'enneagram-foundations';
const GUIDE_EMAIL = 'aeon.g963@gmail.com'; // org owner (user_organizations, 2026-10-29)

const [guide] = await db<Array<{ id: string }>>`SELECT id FROM users WHERE email = ${GUIDE_EMAIL}`;
if (!guide) throw new Error(`No user ${GUIDE_EMAIL}`);
const viewer: LmsViewer = { userId: guide.id, roles: { [ORG]: 'guide' } };

/* ── Type readings (module: the nine points) ──────────────────────── */

const TYPES: Array<{ n: number; name: string; script: string; epithets: string; body: string[] }> = [
  { n: 1, name: 'The Perfectionist', script: 'Gut-Frustration', epithets: 'The Scientist and Lab Rat · Mind Inside Matter · Hyper-Optimizer of Existence · The Thin Blade', body: [
    'One is fixated on using the mind to analyze and pick at their psycho-physiological experience, finding flaws to change and improve — to ultimately remove the “bad things” and optimize the “good”. Obsessed with creating and exacting standards, One emphasizes a need for control against aspects of existence that cause chaos or create disgust.',
    'Unlike Nine, which identifies selfhood with harmony, or Eight, which identifies selfhood with expansion, One channels the gut’s need for presence and boundaries through creation of — or compliance with — rules, standards and ideals. The core issue is the self-assumed responsibility to “clean” life: to prevent decay and make things predictable and right once and for all. That very act rejects most of what life is, and the rigidity creates the imbalances that storm back in, needing to be optimized again.',
    '<strong>Wings.</strong> 1w9 is personally driven — refining one’s own experience and boundaries; reserved, grounded, softer. 1w2 is more sensitive to the wrongdoing of others, embodying the image of the righteous; more philosophical, expressive, belief-driven.' ] },
  { n: 2, name: 'The Helper', script: 'Image-Rejection', epithets: 'Big Smile · Love and Positivity Salesman · Can’t Do No Evil', body: [
    'The point of fixation with the embodiment of goodness, compassion and generosity. Image-Rejection lets go of the heart center’s need for the complexity of value and image, relating only to what simply communicates the heart’s need for acceptance, validation and love — severing the gray areas of the self to stand as a consistently reliable source of validation for others.',
    'The constant effort to remain “good” leaves the unwanted and chaotic aspects of self without expression, boiling tension in relationships: others are not allowed to access the hidden aspects, yet are desired to do so. Two can be defined as the Heart of the heart center — where the core need of the center is most consistently expressed.',
    '<strong>Wings.</strong> 2w1 doubles down on the specific morality and standards being upheld; more toned-down and verbal. 2w3 doubles down on the intensity and magnitude of their character, seeking recognition; more of a star.' ] },
  { n: 3, name: 'The Achiever', script: 'Image-Attachment', epithets: 'The Chameleon · The Gaze of the Other · Being the Best', body: [
    'The intellectual aspect of the emotional center. Image-Attachment refuses the center’s need to establish inner worth on internal parameters, and instead builds the self toward externally recognizable markers of excellence and value. Always aware of the gaze of the other, Threes micromanage behavior to keep embodying competency — maintaining continuous control of their image.',
    'Threes are susceptible to self-deceit by severing unacceptable aspects, which can break into waves of internal conflict when the object of attachment that proved their worth stops providing it. The contradiction of Three: endless potential of self with no anchor — so an image must be constructed.',
    '<strong>Wings.</strong> 3w2 is the charmer, commanding attention through mass appeal. 3w4 is iconoclastic — wanting to be seen as unique, demonstrating value through separation and complexity.' ] },
  { n: 4, name: 'The Individualist', script: 'Image-Frustration', epithets: 'The Melodrama of the Incessant Critic · Disdainful Lover · Diamond in the Rough · Science of Dignity', body: [
    'The embodiment of what is most valued internally, held as a direct contrast point to everything else — chasing the ideal and living between perpetual dissatisfaction and connection with it. Four withdraws from the heart center’s need to recognize itself in “easy”, externalized markers of worth, in chase of an ideal form of value often too abstract and personal to be interfaced with interpersonally.',
    'Love and worthiness are believed to be tied to the capacity to experience and endure the pain and darkness connected to them. Here lies the core flaw: the belief that they can only love themselves by living through the pain required to prove their worthiness — a vulnerable masochism beneath an otherwise self-assured demeanor.',
    '<strong>Wings.</strong> 4w3, the authentic spark: asserts the sense of self to the world; the personhood is the answer. 4w5 moves away from the heart’s need to be recognized; more self-conflicted — a totem for the inner aspects that are valued.' ] },
  { n: 5, name: 'The Investigator', script: 'Head-Rejection', epithets: 'Brain in a Jar · Useless Savant · Pure Insight and Knowing', body: [
    'Head-Rejection withdraws from the head center’s need to develop and update its frame of reference, in favor of deep understanding of a narrow scope. Dynamic aspects of inner life must pass through conceptualization before they are allowed to be experienced, separating the observer from the experience.',
    'In contrast to Six, which treats truth as something indisputable and discoverable, Five understands reality as fundamentally unpredictable, and focuses on objective knowledge as elemental quality — removing the subjective, performative and interpretive layers until the elemental building blocks stand articulated alone. “With deep understanding, all manifestations become secondary to the core perspective.”',
    '<strong>Wings.</strong> 5w4 moves away from the world into internal observation, dissecting the essence of desires and instincts. 5w6 moves toward the world and larger systems; curiosity leans into sciences and philosophies.' ] },
  { n: 6, name: 'The Loyalist', script: 'Head-Attachment', epithets: 'Tweaker Brain · Fight About Truth · Suspicious Skeptic · Overprocessor', body: [
    'The emotional aspect of the head center: using values and beliefs as a means of navigating truth and gaining clarity — bifurcating reality into internal beliefs and external facts, fighting to find certainty. “What if it’s all a lie?”',
    'The self is organized around a double bind: the need for certainty and the impossibility of certainty. To resolve it, Six runs simulations of reality-checks — hypothesizing outcomes, confronting inconsistencies, scanning for threats. Confidence in self wavers or is bolstered with the stability of the object of attachment. Wavering between doubt and faith.',
    '<strong>Wings.</strong> 6w5 withdraws into detailed analysis of function and knowledge. 6w7 asserts knowledge and expands the application of perspectives to fulfill the needs of the self.' ] },
  { n: 7, name: 'The Enthusiast', script: 'Head-Frustration', epithets: 'The Hyperbrain · Untethered Mind · Fish Out of Water', body: [
    'Head-Frustration judges and moves away from the head center’s need for full perception, orientation and truth, in favor of creating possibilities and new frames of reference. By creating a positively charged goal or pathway, Seven removes the feeling of lack in the present and keeps the psyche actively engaged with progress toward an idealized state.',
    'There is a deep need for liberty and freedom from structure — structures are temporary beliefs, meant to be altered toward something more satisfying. The resolution point: embracing the transformative feelings of pain and powerlessness instead of defaulting to optimistic plans — the eternal gaping mouth of the whale will be satisfied once it truly feels its hunger.',
    '<strong>Wings.</strong> 7w6 deepens awareness of thought patterns; less aggressive, more tactful. 7w8 uses the force of the gut center to amplify the creativity of the head center.' ] },
  { n: 8, name: 'The Challenger', script: 'Gut-Rejection', epithets: 'The Whale · Self-Ordained Autocrat · High in Conflict · Scary Eyes · The Mountain', body: [
    'Eight forms the point of fixation with power and autonomy in its purest form — separating the will of the self from all else and continuously expanding its reach. Eight rejects vulnerability in the essence of their personality, asserting willpower and psychological and physical control.',
    'They form identity through refusing to be overtaken, guarding the softest part of the gut — the permeability of being — by becoming impenetrable. The will to power is the will to live: at the top, I will be able to tend to the vulnerable; until then, time isn’t to be wasted on the give and take of emotion.',
    '<strong>Wings.</strong> 8w9, the immovable object: rests in the body’s immediate response; quietly assertive. 8w7, the unstoppable force: controls the direction of force through future planning; verbally assertive, creative.' ] },
  { n: 9, name: 'The Peacemaker', script: 'Gut-Attachment', epithets: 'The Hypnagogue · The Empath · The Kaleidoscope · The Boundary Between Blindness and Enlightenment', body: [
    'Nine is fixated on identifying the right emotional place for the body and psyche — torn between internal and external energies, constantly weighing which causes more inner disturbance: awareness or dissociation. The Nine paves a path of least resistance that keeps the inner world consistent, minimizing needs too tense to engage directly.',
    'The core issue is dissociation from commitment to existence within their own beliefs and needs: holding back their will to reach harmony conveniently — producing a shadow willfulness that holds grudges or covertly dismantles other people’s wills. Yet their keen perception of nuance gives Nines a great capacity for empathy: they can see themselves in everybody’s self-experience.',
    '<strong>Wings.</strong> 9w8 reactively severs the self from what causes disharmony, like a snapping turtle descending into its shell. 9w1 dissociates to process anger — and the justifications for why they could be wrong — more calculating, philosophical, righteous.' ] },
];

const p = (...paras: string[]) => paras.map((t) => (t.startsWith('<') ? t : `<p>${t}</p>`)).join('');

const typeSteps: SeedStep[] = TYPES.map((t) => ({
  type: 'reading', slug: `type-${t.n}`, title: `Type ${t.n} — ${t.name}`, required: false,
  summary: `${t.script}. ${t.epithets}.`,
  settings: { minutes: 6 },
  bodyHtml: `<p><em>${t.epithets}</em></p>` + t.body.map((b) => (b.startsWith('<strong') ? `<p>${b}</p>` : `<p>${b}</p>`)).join(''),
}));

/* ── Course outline ───────────────────────────────────────────────── */

const modules: SeedModule[] = [
  { id: 'orientation', title: 'Orientation', summary: 'What the enneagram maps, and where your story begins.', steps: [
    { type: 'reading', slug: 'welcome', title: 'Welcome — how this works', settings: { minutes: 3 },
      summary: 'Short steps, your own pace, private reflections.',
      bodyHtml: p(
        'Each step here is small: something to read, something to try, or one question to answer for yourself. Nothing is graded and nothing counts your days. When you come back, “Continue” takes you to where you were.',
        'The Enneagram is a map of how each individual’s core motivations are unconsciously formulated into a recurring psychological fixation — and how that reaction shaped the way you relate, protect, desire, and disconnect. This course walks the map piece by piece: the three centers, the fixation and its hidden triads, wings, the nine types, and the instincts.',
        'Reflections you write are yours. The default is <em>only you</em> can read them.') },
    { type: 'reading', slug: 'formative-imprints', title: 'Formative developmental imprints', settings: { minutes: 6 },
      summary: 'The wound, the split, and the story built on top of it.',
      bodyHtml: p(
        'The Enneagram explains the exact triggers that create psychological fixations, going back to essential formative events that set the narrative for the creation of one’s identity. In infants we can already see predispositions to personality reactions, prior to any development of a sense of self — attitudes toward the world that appear depending on the child’s biological predispositions, as studied in attachment theory.',
        'We are born attached to our caregiver; as we explore, our biological predispositions form a primary stance toward the world; and lastly, some form of trigger or wound deepens the sense of separation of identity that the personality is crafted upon. In a strange way, one can say humans were born to be wounded, so that they can develop a sense of self with a unique motivational imprint.',
        'The “problem” each of us resolves may only pose as serious to you, and not to another individual. This explains the various ways in which people talk past each other and misunderstand core intentions: our limited scope can only see what is serious to our own self.') },
    { type: 'reflection', slug: 'what-feels-serious', title: 'What has always felt serious?', settings: { minutes: 8,
      prompt: 'What kind of problem has always felt uniquely serious to you — the kind other people seem able to shrug off? Write it down for yourself; decide afterwards whether anyone else reads it.' },
      summary: 'A first look at your own imprint.' },
  ] },
  { id: 'centers', title: 'The Three Centers', summary: 'Gut, Heart and Head — and the one working overtime.', steps: [
    { type: 'reading', slug: 'centers-of-energy', title: 'Centers of energy', settings: { minutes: 7 },
      summary: 'The Gut, the Heart, and the Head.',
      bodyHtml: p(
        'Human awareness organizes itself around three primary areas of awareness: the Gut, the Heart, and the Head. These centers are the foundational systems through which identity processes reality in an attempt to restore inner stability after the original wound — and each individual has one of them working overtime. That center becomes the ground zero of identity construction.',
        '<strong>Gut</strong> (8, 9, 1) — the observation of concrete, literal experience through the senses; boundaries, self-defense, somatic certainty. A grounded sense of “I am”. Its questions: does this feel right? Is this harmonious or dissonant with how things are supposed to be?',
        '<strong>Heart</strong> (2, 3, 4) — the monitoring of internal experience and imagery with value-laden reactions; self-image, preferences, assessments of the inner nature of others. Everything becomes a mirror of internal worth — or its perceived absence.',
        '<strong>Head</strong> (5, 6, 7) — discerning, reformulating and creating perspectives at will; mapping, patterning, anticipation. Life processed as a mental landscape of predictions, calculations and logic maps.') },
    { type: 'practice', slug: 'three-impressions', title: 'Three impressions of one room', settings: { minutes: 5,
      practice: 'Look at the state of the room you are in. First, simply see the items in it (body). Then notice any feeling that rises from what you see — a memory, a comfort, a remorse (image). Then catch the mind planning: how moving the couch may clear space for foot traffic (mind). Take the same room three times, one center at a time.',
      alternative: 'If the room is too familiar, do the same with a window view or a photograph.',
      prompt: 'Which of the three impressions came easiest — and which did you have to force?' },
      summary: 'Separating body, image and mind on purpose.' },
    { type: 'reflection', slug: 'which-center', title: 'Which center works overtime?', settings: { minutes: 8,
      prompt: 'Of the three centers — gut presence, heart image, head mapping — which one does your attention run to first under pressure? What does it promise to fix?' },
      summary: 'Locating your own ground zero.' },
  ] },
  { id: 'fixation', title: 'The Core Fixation', summary: 'The looped response pattern and the hidden triads inside it.', steps: [
    { type: 'reading', slug: 'the-looped-pattern', title: 'The looped response pattern', settings: { minutes: 6 },
      summary: 'Where the core fixation emerges.',
      bodyHtml: p(
        'Once the center has been over-activated in response to the wound, it begins to form a looped response pattern — a psychological structure that attempts to resolve the loss of stability using the same tools that were shaped by the injury itself. This is where the core fixation emerges.',
        'The psyche begins with a specific wound to the center, filters it through its inborn motivation, and generates a strategy to resolve it. With repetition the strategy becomes a well-tested methodology: both a lens for understanding the world and the means of reaffirming the core type’s disconnect. The story becomes self-reinforcing, selecting information that supports its worldview and rejecting what contradicts it.',
        'And like any script, it runs in the background with a mixture of false and accurate beliefs — until it’s brought into conscious view, line by line. With self-understanding and accurate insight on your type, you can unwind the looping pattern: releasing the responsibility of thinking from one dominant center, and allowing heart, head and gut to process what each is supposed to process. This is the starting key to integration.') },
    { type: 'reading', slug: 'the-hidden-triads', title: 'The hidden triads', settings: { minutes: 9 },
      summary: 'Object relations, energy style, attitude style, instinctual triad.',
      bodyHtml: p(
        'Each type is composed of internal points that give rise to its overall quality — think of the notes that make up a chord. Four groupings cross the circle:',
        '<strong>Object relations</strong> — the foundational reaction to the feeling of lack. Frustration (1·4·7): “something essential is missing — I should fix, chase, or perfect it.” Rejection (2·5·8): “this need disrupts clarity — I must reduce, control, or go without it.” Attachment (3·6·9): “I need to preserve connection by bridging sovereignty and adaptation.”',
        '<strong>Energy reaction style</strong> — how the psyche moves to get its needs met. Assertive (3·7·8) moves against the world to take what is valued. Withdrawn (4·5·9) moves away to protect what is valued. Transactional (1·2·6) moves in response to the world, building bonds of give and take.',
        '<strong>Attitude style</strong> — how outcomes are framed when expectations aren’t met. Positive bias (2·7·9) reframes pain to keep momentum. Reactive bias (4·6·8) amplifies emotion to find the unseen truth. Competency bias (1·3·5) suppresses emotional chaos to operate better.',
        '<strong>Instinctual triad</strong> — the orientation of a type’s sphere of influence. Desirability-seeking (9·2·4) curates a feeling state that magnetizes. Autonomy-seeking (5·6·8) becomes a protected pillar of knowledge and resources. Update-seeking (1·3·7) creates an aura of potential and growth direction.') },
    { type: 'reflection', slug: 'the-defense-speaks', title: 'When the fixation defends itself', settings: { minutes: 8,
      prompt: 'Many people, on finding their type, react intensely — reasons upon reasons why they aren’t like this. That is the fixation defending itself. Where have you noticed that reflex in yourself, with this system or any other mirror?' },
      summary: 'Noticing the ego-defense in real time.' },
  ] },
  { id: 'motion', title: 'Wings and Movement', summary: 'The figure in motion: wings, stress and growth.', steps: [
    { type: 'reading', slug: 'wings', title: 'Wings — the enneagram works through motion', settings: { minutes: 6 },
      summary: 'Each fixation orients around regions of the circle.',
      bodyHtml: p(
        'Our internal experience is an ebb and flow rather than a static quality. Each fixation orients itself around certain regions of the enneagram — each representing specific reactions to the needs of the core fixation. Faced with experiences that cause disharmony, a type may direct attention toward the next or the previous point on the circle as a resolution point. This is the role of wings: a deeper layer of motion in personality.',
        'There are many similarities between 1w9 and 9w1, since they share a range of experiences in the same region — but the core fixation, the unstable and emotionally charged aspect of the personality, differs.',
        'The Enneagram is a symbolic map of movement and transformation, rooted in esoteric mathematics and music theory: the law of octaves, the law of three, and the law of seven as taught by G. I. Gurdjieff. Just as a musical scale naturally moves from one tone to the next, each type falls into one of the two adjacent expressions to stabilize or express its core motivation.') },
    { type: 'reading', slug: 'lines-of-movement', title: 'Lines of movement', settings: { minutes: 4 },
      summary: 'The triangle, the hexagram, stress and growth.',
      bodyHtml: p(
        'Types 3, 6 and 9 form the equilateral triangle at the center of the figure; the six remaining types form the inner hexagram through the path 1→4→2→8→5→7→1. These lines describe the directions of integration and disintegration: the psychological movement that occurs under stress and under growth.',
        'These are not destinations but directions — observable patterns in behavior when internal resources contract or expand. The hexagram and triangle together form the complete figure: a map not just of nine fixed types but of nine fields of movement, each in relation to every other.',
        'The interactive figure on the landing page draws each type’s wing region, stress line and growth line — use it alongside this module.') },
  ] },
  { id: 'types', title: 'The Nine Points', summary: 'One reading per fixation. Start with the point that stings.', steps: [
    ...typeSteps,
    { type: 'reflection', slug: 'find-yourself', title: 'Find yourself on the circle', settings: { minutes: 10,
      prompt: 'Which one or two readings produced the strongest reaction — recognition, or protest? What exactly stung? (Protest is data too.)' },
      summary: 'Your strongest reaction is the trailhead.' },
  ] },
  { id: 'instincts', title: 'The Instincts', summary: 'Self-preservation, sexual, social — and the blind spot.', steps: [
    { type: 'reading', slug: 'three-instincts', title: 'Three impulses', settings: { minutes: 7 },
      summary: 'SP, SX, SO — the realities each instinct fixates on.',
      bodyHtml: p(
        'All nine types are further divided by their primary instinct of fixation — the biological primer for how your core identity needs are going to be met. The core type carries the internal aspects; the instinct determines how the fixation is projected into the world. Together they form the 27 types.',
        '<strong>Self-Preservation</strong> — the reality of resources, needs, abilities, psycho-physiological harmony, and steady growth. As primary: an exaggerated need for comfort and feelings of luxury in one’s experience; responsibility, capability, stability, groundedness.',
        '<strong>Sexual</strong> — the reality of desirability, non-verbal attraction and repulsion, intense chemical excitement, mating rituals, fantasies and taboos. As primary: an exaggerated need for effective psychosexual demonstration, seeking ego-annihilation in union with a person or experience.',
        '<strong>Social</strong> — the reality of connection and relations, similarity and difference, and consistent frameworks for types of people, ideologies and perspectives. As primary: an exaggerated need to form bonds, intimate connection, and familiarity — personal intimacy or collective influence.') },
    { type: 'reading', slug: 'instinct-flow', title: 'Instinct flow and the blind spot', settings: { minutes: 4 },
      summary: 'Focal view, peripheral vision, and the area behind you.',
      bodyHtml: p(
        'Your focal view is your dominant instinct; your peripheral vision is your secondary; the area behind you is your blind instinct. Obstacles in the dominant instinct call you to turn your head toward the blind one — and once you turn, you decide the dominant is more important and turn back.',
        'This is the behavior that creates the neglect that builds the void in your blind instinct. The blind instinct is not a separate reality; it is simply always behind you, because you want to look the other way.') },
    { type: 'reflection', slug: 'your-blind-spot', title: 'Your blind spot', settings: { minutes: 8,
      prompt: 'Which of the three realities — maintenance and resources, chemistry and polarity, bonds and belonging — do you most reliably look away from? What has it cost?' },
      summary: 'Naming the instinct behind you.' },
  ] },
  { id: 'going-further', title: 'Going Further', summary: 'The figure, a typing session, and what comes next.', steps: [
    { type: 'resource', slug: 'the-figure', title: 'The interactive figure', required: false, settings: { minutes: 5 },
      summary: 'The ÆON landing page: nine points, four lenses, lines of movement.',
      bodyHtml: p(
        'The landing page carries the full interactive enneagram: select a point to read its fixation bit by bit, switch lenses to see the hidden triads laid over the circle, and follow each type’s wing region, stress line and growth line.') },
    { type: 'reading', slug: 'sit-for-a-typing', title: 'Sit for a typing', required: false, settings: { minutes: 3 },
      summary: 'One-on-one sessions: Complete Typing and Consultation.',
      bodyHtml: p(
        'Reading about the types gets you to the trailhead; a typing session walks it with you. In a <strong>Complete Typing</strong> session ($100, roughly 30–90 minutes) you are asked questions to uncover your core motivation, core wound, and core identity question — with a Q&amp;A at the end and a written document detailing your specific type within a few days. A research discount of $20 is available when you allow the session to be recorded for private empirical research.',
        'A <strong>Consultation Session</strong> ($100, 45 minutes) is open ground: your results, the system itself, future planning, or whatever else is on your mind.') },
    { type: 'reflection', slug: 'what-should-this-become', title: 'What should this course become?', settings: { minutes: 5,
      prompt: 'Having walked the foundations: what would you want the rest of this course to give you?' },
      summary: 'Tell the guide what to build next.' },
  ] },
];

const { course, defaultRun } = await seedCourse(viewer, {
  orgId: ORG, slug: SLUG, title: 'Enneagram Foundations',
  summary: 'A free walk through the Hidden Enneagram: the three centers, the core fixation and its hidden triads, wings, the nine types, and the instincts — in short steps with private reflections.',
  descriptionHtml: '<p><em>An early outline, seeded from the Hidden Enneagram corpus while the guide shapes the course — expect steps to change.</em></p><p>Everything here is free to read, at your own pace. Reflections are private by default.</p>',
  visibility: 'unlisted',
  modules,
  notes: 'Seeded from the Hidden Enneagram corpus',
});

await db`INSERT INTO lms_course_staff (course_id, user_id) VALUES (${course.id}, ${guide.id}) ON CONFLICT DO NOTHING`;
await db`INSERT INTO lms_run_staff (run_id, user_id, role) VALUES (${defaultRun.id}, ${guide.id}, 'guide') ON CONFLICT DO NOTHING`;
await db`
  INSERT INTO lms_achievements (id, org_id, course_id, name, description)
  SELECT ${'ach_' + course.id}, ${ORG}, ${course.id}, 'Enneagram Foundations', 'Walked every required step of Enneagram Foundations.'
  WHERE NOT EXISTS (SELECT 1 FROM lms_achievements WHERE course_id = ${course.id})
`;

console.log(`Course ${course.slug} (${course.id}) ready; default run ${defaultRun.slug ?? defaultRun.id} (${defaultRun.mode}).`);
process.exit(0);
