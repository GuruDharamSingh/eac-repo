/**
 * ÆON Enneagram content: centers, figure modes, stress lines and type dossiers.
 *
 * Source: ~/aeon-enneagram/js/content.js (2026-10-29 draft), ported to typed
 * constants. `keywords` and `description` are not in the ÆON file; they come
 * from the repo's older data (components/enneagram/enneagram-data.ts, removed in
 * round 5; it lives in git history before that).
 *
 * Wording is ÆON's; disagreements with the older site are listed in
 * docs/PATCH_NOTES.md.
 */

export type CenterKey = "gut" | "heart" | "head";
export type ModeKey = "centers" | "object" | "energy" | "attitude";
export type TypeNum = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export interface Center {
  label: string;
  long: string;
}

export interface ModeGroup {
  name: string;
  types: TypeNum[];
  hue: CenterKey;
}

export interface Mode {
  label: string;
  groups: ModeGroup[];
}

export interface TypeDossier {
  name: string;
  script: string;
  center: CenterKey;
  tagline: string;
  epithets: string;
  essence: string[];
  story: string;
  qualities: string[];
  triads: [string, string][];
  wings: [string, string][];
  /** From the repo's older data (enneagram-data.ts), not the ÆON file. */
  keywords: string[];
  /** From the repo's older data (enneagram-data.ts), not the ÆON file. */
  description: string;
}

export const CENTERS: Record<CenterKey, Center> = {
  gut: { label: "Gut", long: "Gut · Energy of the Body" },
  heart: { label: "Heart", long: "Heart · Energy of the Face" },
  head: { label: "Head", long: "Head · Energy of the Mind" },
};

/* Mode groupings for the figure. Each mode colors the nine points by its
   three poles, using the same three hues as role colors. */
export const MODES: Record<ModeKey, Mode> = {
  centers: {
    label: "Centers",
    groups: [
      { name: "Gut 8 · 9 · 1", types: [8, 9, 1], hue: "gut" },
      { name: "Heart 2 · 3 · 4", types: [2, 3, 4], hue: "heart" },
      { name: "Head 5 · 6 · 7", types: [5, 6, 7], hue: "head" },
    ],
  },
  object: {
    label: "Object relation",
    groups: [
      { name: "Frustration (+) 1 · 4 · 7", types: [1, 4, 7], hue: "heart" },
      { name: "Rejection (−) 2 · 5 · 8", types: [2, 5, 8], hue: "head" },
      { name: "Attachment (=) 3 · 6 · 9", types: [3, 6, 9], hue: "gut" },
    ],
  },
  energy: {
    label: "Energy style",
    groups: [
      { name: "Assertive (+) 3 · 7 · 8", types: [3, 7, 8], hue: "heart" },
      { name: "Withdrawn (−) 4 · 5 · 9", types: [4, 5, 9], hue: "head" },
      { name: "Transactional (=) 1 · 2 · 6", types: [1, 2, 6], hue: "gut" },
    ],
  },
  attitude: {
    label: "Attitude style",
    groups: [
      { name: "Positive (+) 2 · 7 · 9", types: [2, 7, 9], hue: "gut" },
      { name: "Reactive (−) 4 · 6 · 8", types: [4, 6, 8], hue: "heart" },
      { name: "Competency (=) 1 · 3 · 5", types: [1, 3, 5], hue: "head" },
    ],
  },
};

/* Lines of movement along the triangle and hexagram:
   stress runs 1→4→2→8→5→7→1 and 9→6→3→9; growth runs the reverse. */
export const STRESS: Record<TypeNum, TypeNum> = { 1: 4, 2: 8, 3: 9, 4: 2, 5: 7, 6: 3, 7: 1, 8: 5, 9: 6 };

export const TYPES: Record<TypeNum, TypeDossier> = {
  1: {
    name: "The Perfectionist",
    script: "Gut-Frustration",
    center: "gut",
    tagline: "Integrity through right action",
    epithets: "The Scientist and Lab Rat · Mind Inside Matter · Hyper-Optimizer of Existence · The Thin Blade",
    essence: [
      "One is fixated on using the mind to analyze and pick at their psycho-physiological experience, finding flaws to change and improve — to ultimately remove the “bad things” and optimize the “good”. Obsessed with creating and exacting standards, One emphasizes a need for control against aspects of existence that cause chaos or create disgust, and can become harsh and judgmental — prone to “educating” others about the harm of whatever disgusts them.",
      "Unlike Nine, which identifies selfhood with harmony, or Eight, which identifies selfhood with expansion, One channels the gut’s need for presence and boundaries through creation of — or compliance with — rules, standards and ideals. The gut center becomes hyper-intellectualized, with a baseline unease toward the variety and breadth of experience. This is done to protect and instill “correct values” that prevent destructive experiences.",
      "The core issue of One is the self-assumed responsibility to “clean” life: to prevent decay and make things predictable and right once and for all. That very act rejects most of what life is, narrowing the idea of true living to whatever is not found disgusting or unworthy. Ones carry a sense of duty that keeps them from being swayed by randomness — but the rigidity is the very thing that creates the imbalances that storm back into their life, needing to be optimized again.",
    ],
    story: "Controlled and measured. Detail-oriented and sharp. They tread the line between states of unease and perfect stability, filled with an urge to refine the self and the world toward more precision and purity.",
    qualities: [
      "Optimal existence treated as a necessity; the standard is set high and specifically",
      "Philosopher of values for sensory experience; the body as a moral temple",
      "Uneasiness in the body — rigid, idiosyncratic ways of holding its musculature",
      "Hyper-attunement to flaws, errors and discontinuities in people or systems",
      "Anger repressed and converted into moral urgency or correction",
      "Under stress becomes rigid or brittle, clinging harder to rules",
    ],
    triads: [
      ["Gut (8 · 9 · 1)", "Rejects signals to change course, treating experience as a means to an end — each decision made so the psychophysiological system feels less impure. More emphasized in 1w9."],
      ["Transactional (1 · 2 · 6)", "Feels responsible for the effects of people’s behavior on one another; builds systems held to standards and is sensitive to broken deeds and contracts. Amplified in 1w2."],
      ["Frustration (1 · 4 · 7)", "Seeks to step out of the gut center to finalize the ideal state of being. Easily dissatisfied with how things are; identified with a feeling of lack and the need to overcome it."],
      ["Competency (1 · 3 · 5)", "Sees self and others as systems that can be understood, updated and made effective by removing emotional attachment and prioritizing capacity."],
      ["Update-seeking (1 · 3 · 7)", "Presents the self as a resource for change and refinement; builds identity on movement and ideals about how to exist in the world."],
    ],
    wings: [
      ["1w9", "Personally driven. Focused on refining one’s own experience and boundaries, dropping more easily into the positivity of the body when standards are met. Reserved, grounded, softer."],
      ["1w2", "More sensitive to the wrongdoing of others, doubling down on transactional needs. Leans into value assessments and seeks to embody the image of the righteous. More philosophical, expressive, belief-driven."],
    ],
    keywords: ["reform", "integrity", "criticism", "resentment"],
    description: "Driven by an inner critic that demands perfection and right action. They perceive the world through a constant lens of improvement and feel personally responsible for what is wrong.",
  },
  2: {
    name: "The Helper",
    script: "Image-Rejection",
    center: "heart",
    tagline: "Love through giving",
    epithets: "Big Smile · Love and Positivity Salesman · Can’t Do No Evil",
    essence: [
      "The point of fixation with the embodiment of goodness, compassion and generosity. Image-Rejection lets go of the heart center’s need for the complexity and complication of value and image, relating only to what simply communicates the heart’s need for acceptance, validation and love. The gray areas of the self are severed so the Two can stand as a consistently reliable source of validation for others.",
      "Two subverts the image center’s need for worth by becoming the beacon of love and the source of validation, denying the need to process the complexities of self. This creates a tug of war between the consistent image of goodness and the messier needs for validation — a void on the receiving end. The constant effort to remain “good” leaves the unwanted and chaotic aspects of self without expression, which boils tension in relationships: others are not allowed to access the hidden aspects, yet are desired to do so.",
      "Unlike Three, Two simplifies the heart center’s need for love and becomes a resource for it; unlike Four, which validates an iconoclastic image through judgment and segregation, Two expands the heart’s reach to include all who show a glimmer of light — emphasizing goodness to keep the dark side unprocessed. Two can be defined as the Heart of the heart center, where the core need of the center is most consistently expressed.",
    ],
    story: "Warm, personable, charismatic — an impenetrable quality of goodness. Love and care offered as a hidden contract for the give and take of equal value.",
    qualities: [
      "Warm, personable and charismatic; impenetrable quality of goodness",
      "Responsible for taking care of others or offering positive outlooks",
      "Internalized shame about harboring bad thoughts, resolved by doing more for others",
      "Processing negativity in depth is seen as unnecessary — darkness is only potential for betterment",
      "Feels shame and wrongness if perceived to be gaining something for themself",
      "Inauthentic in super-authenticity",
    ],
    triads: [
      ["Heart (2 · 3 · 4)", "Consistent embodiment of the qualities that interpret the inner self as good-natured beyond reason."],
      ["Transactional (1 · 2 · 6)", "Belief that providing for others and maintaining standards of behavior establishes relationships in which the self is provided for."],
      ["Rejection (2 · 5 · 8)", "Removes the complex, dark and triggering aspects of the psyche from view to double down on generating what the fixation desires — breaking others’ boundaries to provide love while remaining at arm’s length."],
      ["Positive (9 · 2 · 7)", "Belief that perspective alters reality: by affirming silver linings, difficulties can be mitigated. Can become a form of escapism."],
      ["Desirability-seeking (9 · 2 · 4)", "Embodies a boundary-breaking love and intimacy that others get hooked on for warm and intimate feelings — a signature only the Two can provide."],
    ],
    wings: [
      ["2w1", "Doubles down on the specific morality and standards being upheld. More toned-down and verbal."],
      ["2w3", "Doubles down on the intensity and magnitude of their character, seeking recognition for their existence. More of a star."],
    ],
    keywords: ["care", "approval", "pride", "relationships"],
    description: "Move toward others to fulfill needs they cannot acknowledge in themselves. Love becomes a currency — given abundantly, unconsciously expecting return.",
  },
  3: {
    name: "The Achiever",
    script: "Image-Attachment",
    center: "heart",
    tagline: "Worth through success",
    epithets: "The Chameleon · The Gaze of the Other · Being the Best",
    essence: [
      "The intellectual aspect of the emotional center. Three is concerned with analyzing and processing the qualities and attributes of being, organizing and refining their expression according to standards that maximize self-worth. Image-Attachment refuses the center’s need to establish inner worth on internal parameters, and instead builds the self toward externally recognizable markers of excellence and value.",
      "There is a splitting of the self between accepted and unacceptable aspects, measured against existing standards that carry the significance the Three is looking for. As an image type, Three seeks to make something valuable of the self, worthy of admiration, to battle the shame that lives in the unprocessed and unedited version of the self. Always aware of the gaze of the other, Threes micromanage behavior to keep embodying competency in the field of interest — maintaining continuous control of their image.",
      "Threes are susceptible to self-deceit by severing unacceptable aspects, which can break into waves of internal conflict when the object of attachment that proved their worth stops providing it. Unlike Two, which glorifies warmth and kindness as the measure of human value, Three focuses on capacity and achievement as the proof of value; unlike Four, which treats inner experience as the pillar of value, Three studies external metrics and applies them to gain the upper hand.",
    ],
    story: "The contradiction of Three: endless potential of self with no anchor — so an image must be constructed.",
    qualities: [
      "Optimistic about achieving whatever is needed",
      "Adept chameleon — appearances and attitudes adjusted to perform better per situation",
      "Aware of social consequences in actions and manners of speech",
      "Overconfidence over hidden shame; fear of being outed as a sham",
      "Controlled, performative expression; knows how to speak directly to the heart",
      "Skilled at reading ranges of expression and human characteristics",
    ],
    triads: [
      ["Heart (2 · 3 · 4)", "Consistent updating and upkeep of the qualities of character and expression that demonstrate high social value, strength and capacity."],
      ["Assertive (3 · 7 · 8)", "Takes charge to create achievements in projects, ideas and social relations, removing the possibility of unforeseen shame."],
      ["Attachment (9 · 3 · 6)", "Acute awareness of others’ core values and attempts at achievement, with a keen eye on the intersections between self and others; updates the self as contexts change to stay in upward movement."],
      ["Competency (1 · 3 · 5)", "Believes value is a demonstrable skill; critical toward incompetency wherever standards have precedent."],
      ["Update-seeking (1 · 3 · 7)", "Sees their identity as a resource for development and change in the wider sphere of human life — one step ahead of everyone."],
    ],
    wings: [
      ["3w2", "The charmer. Commands attention through mass appeal, doubling down on embodying the appealing aspects of the heart center rather than skills."],
      ["3w4", "Iconoclastic. Wants to be seen as unique; motivated to act to reduce self-criticism, demonstrating value through separation and complexity."],
    ],
    keywords: ["image", "efficiency", "adaptability", "deceit"],
    description: "Shape-shift to match the expectations of others, confusing their performed role with their actual self. Success and admiration become substitutes for being loved.",
  },
  4: {
    name: "The Individualist",
    script: "Image-Frustration",
    center: "heart",
    tagline: "Identity through depth",
    epithets: "The Melodrama of the Incessant Critic · Disdainful Lover · Diamond in the Rough · Beast of Beauty and the Beast · Science of Dignity",
    essence: [
      "The embodiment of what is most valued internally, held as a direct contrast point to everything else — chasing the ideal and living between perpetual dissatisfaction and connection with it. Four is fixated on severing whatever in themselves is incongruent with a pure, essential quality they are protecting, moving from constant emotional despair into the protection of a venerated value.",
      "This type withdraws from the heart center’s need to recognize itself in “easy”, externalized markers of worth, in chase of an ideal form of value often too abstract and personal to be interfaced with interpersonally. The result is a severe separation between the internalized sense of worth and the external world; external qualities are constantly judged, distinguished, and cast out when incongruence is perceived.",
      "Love and worthiness are believed to be tied to the capacity to experience and endure the pain and darkness connected to them. Fours engulf themselves in negativity to build an individualized, symbolic pathway to the pure and essential — visible only to those “worthy” of seeing it through. Here lies the core flaw: the belief that they can only love themselves by living through the pain required to prove their worthiness, a vulnerable masochism beneath an otherwise self-assured demeanor.",
    ],
    story: "The contradiction of Four: an anchored inner image without external congruence — so positivity is withdrawn and the image aggressively protected in reality.",
    qualities: [
      "Highly opinionated; refuses to engage with matters outside their interest",
      "Extreme internalized self-scrutiny with no external markers to support or deny it",
      "Projects self-standards onto others; rejects characters not fundamentally aligned",
      "Consistently obsessed with specific qualities, art forms or characteristics",
      "Sees the path to beauty and love as requiring hardship and the negative realities of the self",
      "Interior is sensitive and vulnerable; exterior is guarded and offensive",
    ],
    triads: [
      ["Heart (2 · 3 · 4)", "Embodiment of the specific aspects of self seen as valuable; rejection of everything that defies or contaminates that perception. Active judgment of values."],
      ["Withdrawn (9 · 4 · 5)", "Protects the part of the self most worthy of love by obfuscating and symbolizing it — visible only through engagement in difficulty. Disdain for externalized value metrics."],
      ["Frustration (1 · 4 · 7)", "Driven by a constant feeling of lack and dissatisfaction with existence; puts the self through difficulties to craft experience and presence. Split between glory and hatred."],
      ["Reactive (4 · 6 · 8)", "Uses negativity and rejection to prove the lack of essential quality in self and world; affirmation through denial. Quick to opine with a polarized perspective."],
      ["Desirability-seeking (9 · 2 · 4)", "Seeks to become a unique place where depth in love and passion can be expressed, rescued and nurtured from inside darkness."],
    ],
    wings: [
      ["4w3", "The authentic spark. Asserts the sense of self to the world; more combative and immediate in judging values and aesthetics. The personhood is the answer."],
      ["4w5", "Moves away from the heart’s need to be recognized; internal values are abstracted from self and reality. More self-conflicted — a totem for the inner aspects that are valued."],
    ],
    keywords: ["authenticity", "longing", "envy", "melancholy"],
    description: "Search for an authentic self through feeling, meaning, and what is missing. Uniquely attuned to beauty and loss, they can romanticize suffering while yearning for the ideal.",
  },
  5: {
    name: "The Investigator",
    script: "Head-Rejection",
    center: "head",
    tagline: "Safety through knowledge",
    epithets: "Brain in a Jar · Useless Savant · Pure Insight and Knowing",
    essence: [
      "Head-Rejection withdraws from the head center’s need to develop and update its frame of reference, in favor of deep understanding of a narrow scope — pulling the head center out of the world to develop understanding without attachment to contextual needs or immediate function.",
      "Five’s discomfort with the chaotic depth of internal desires and emotional experience compels them to compartmentalize: dynamic aspects of inner life must pass through conceptualization before they are allowed to be experienced, separating the observer from the experience — sometimes leaving the Five feeling “not alive” or “not human”. As a rejection type, Five strips away extraneous processing — holistic conclusions, pathfinding, responsibility to norms — and becomes expert in the most granular minutiae of observation: iconoclastic and subjectively oriented in its deepening of insight, yet valuing utmost objectivity in the insight extracted.",
      "In contrast to Six, which treats truth as something indisputable and discoverable, Five understands reality as fundamentally unpredictable, and focuses on objective knowledge as elemental quality — removing the subjective, performative and interpretive layers until the elemental building blocks stand articulated alone, and in relation to each other. Thoughts, emotions and needs are unpredictable and destabilizing; Five reduces them to parts, like gears in a machine, to develop leverage over them.",
    ],
    story: "“With deep understanding, all manifestations become secondary to the core perspective.” A deep desire to be touched by experience, coupled with fear of the chaos that comes with it.",
    qualities: [
      "Allergic to doing most things — yet overworking on specific interests",
      "Focuses on specifics and details; struggles with generalities as “summed up arbitrarily”",
      "Detached and uninvolved with life and their own basic needs",
      "Body disconnection, with marked intensity in the eyes and facial muscles",
      "Assumes others can’t comprehend the complexities of what they are saying",
      "Interested in pure insight without obligation to Truth or communication",
    ],
    triads: [
      ["Head (5 · 6 · 7)", "Obsessed with understanding and uncovering insight, deepening specific areas of knowledge and the human condition."],
      ["Withdrawn (9 · 4 · 5)", "Protects their field of inquiry from other perspectives; personally accountable to the minute details, believing larger systems of thought dilute the directness of insight."],
      ["Rejection (2 · 5 · 8)", "Removes the complexity of competing perspectives and conjecture to deepen into the head center’s need for direct insight; separates from the need for guidance."],
      ["Competency (1 · 3 · 5)", "Seeks to be sharpest at understanding on the most detailed level — with leverage on how things change and transform over time."],
      ["Autonomy-seeking (5 · 6 · 8)", "Identifies with protecting clarity of mind and the maintenance of resources that uphold stability."],
    ],
    wings: [
      ["5w4", "Movement away from the world into internal observation. Dissatisfaction with the material world, with an obsession for dissecting the essence of desires and instincts."],
      ["5w6", "Movement toward the world and larger systems; awareness of methodologies and relationships. Curiosity leans into sciences and philosophies."],
    ],
    keywords: ["insight", "privacy", "detachment", "avarice"],
    description: "Manage scarce inner resources by withdrawing from the world to observe and understand. Knowledge becomes a preparation for engagement — often deferred indefinitely.",
  },
  6: {
    name: "The Loyalist",
    script: "Head-Attachment",
    center: "head",
    tagline: "Security through trust",
    epithets: "Tweaker Brain · Fight About Truth · Suspicious Skeptic · Overprocessor",
    essence: [
      "The emotional aspect of the head center: using values and beliefs as a means of navigating truth and gaining clarity — bifurcating reality into internal beliefs and external facts, fighting to find certainty. Head-Attachment is the primary obsession with reality and truth: the drive to dissect truth from falsity, what can be trusted from what is deceitful. “What if it’s all a lie?”",
      "The self is organized around a double bind: the need for certainty and the impossibility of certainty. To resolve it, Six runs simulations of reality-checks — hypothesizing outcomes, confronting inconsistencies, scanning for threats. This hypervigilance toward truth produces personal reactivity and insecurity whenever the systems, groups or beliefs the Six depends on become questionable.",
      "Unlike Five, which deepens into the direct observation of small focal points, Six prioritizes objective utility, understanding from the systems level up — cutting through false information to expose what is real. Head-Attachment refuses the center’s need for internal guidance by attaching to external systems (including concepts in the head) to establish something firm; confidence in self wavers or is bolstered with the stability of the object of attachment.",
    ],
    story: "Clarity and function, good and bad, mutual understanding and group effort. Sharp, cutting opinions on vast topics — until tested unknowns become filtered. Wavering between doubt and faith.",
    qualities: [
      "Hyper-vigilance; very serious about “reality” and separating what is not real",
      "Sensitive to dualities and inconsistencies; adept at picking up the logic behind what others say",
      "Obligation to truth and rightful action; suspicious and doubtful",
      "Emotionally attached to perspectives; forms bonds of allegiance with the like-minded",
      "Receipt-based mentality in relationships — unreciprocated effort destabilizes",
      "Whistleblower: accountable for exposing lies, misinformation and obfuscation",
    ],
    triads: [
      ["Head (5 · 6 · 7)", "Fixated on processing reality and identifying the truth in every context; most aware of the back-and-forth of information. Dynamic thinking."],
      ["Transactional (1 · 2 · 6)", "Puts effort into validating and stabilizing systems and persons of common belief, sustaining mutual support."],
      ["Attachment (9 · 3 · 6)", "Attached to one’s belief about what is true and dependable — a simultaneous counter-movement between seeking clarity and deepening ideology; vacillating between gratifying beliefs and the obsession with uncovering false ones."],
      ["Reactive (4 · 6 · 8)", "Sensitive to lies, hidden knowledge and all forms of obfuscation, taking accountability for exposing them."],
      ["Autonomy-seeking (5 · 6 · 8)", "Finds stability in acute awareness of truth; lives away from falsities and unreliable systems."],
    ],
    wings: [
      ["6w5", "Withdraws into detailed analysis of function and knowledge, engrossing the self in gaining more and more perspective."],
      ["6w7", "Asserts knowledge and expands the application of perspectives to fulfill the needs of the self."],
    ],
    keywords: ["loyalty", "doubt", "anxiety", "vigilance"],
    description: "Scan continuously for threat while testing the trustworthiness of others. Inner doubt fuels both devoted loyalty and persistent questioning — of systems, authorities, and the self.",
  },
  7: {
    name: "The Enthusiast",
    script: "Head-Frustration",
    center: "head",
    tagline: "Freedom through possibility",
    epithets: "The Hyperbrain · Untethered Mind · Fish Out of Water",
    essence: [
      "Head-Frustration judges and moves away from the head center’s need for full perception, orientation and truth, in favor of creating possibilities and new frames of reference — unhindered by reality and pre-established systems. The head is no longer mainly a perceptive tool; it is used to proactively escape the lack of stimulation, keeping a continuous feeling of change and movement in the current state.",
      "By creating a positively charged goal or pathway, Seven removes the feeling of lack in the present and keeps the psyche actively engaged with progress toward an idealized state. The buzz of acquiring knowledge that every head type chases has become a basic need — speeding through new concepts and derivations, or pushing outward into the world to build a new direction. Dissatisfaction arrives whenever progress toward something more impactful and desired is not visible; the body and reality are rejected on some level to stay off the ground and moving.",
      "There is a deep need for liberty and freedom from structure — structures are temporary beliefs or emotional states, meant to be altered toward something more satisfying. Sevens are driven and forceful at maintaining hopefulness toward their own plans, rejecting dismissals and “reality-checks”. The resolution point: embracing the transformative feelings of pain and powerlessness instead of defaulting to optimistic plans — the eternal gaping mouth of the whale will be satisfied once it truly feels its hunger.",
    ],
    story: "Knowledge, opinions and perspectives exist for effects and outcomes rather than mere understanding. The ability to overcome situations mentally breeds a feeling of invincibility — and a void of growing problems.",
    qualities: [
      "Fast idea generation; wishful, fantastical thinking",
      "Unapologetic about doing and taking what they need",
      "Quick to recontextualize situations to maintain autonomy",
      "The fastest and most restless of the head types; traits of mania",
      "Verbose and good at creating rapport, convincing others of their visions",
      "Sees information as a creative tool; escapes negative outcomes and the feeling of being caged",
    ],
    triads: [
      ["Head (5 · 6 · 7)", "Continuously puzzling and developing ideas to extend range and movement; the whole world mapped as a cascade of possibilities that either serve the path or are altered and ignored."],
      ["Assertive (3 · 7 · 8)", "Pushes and takes charge of setting self-serving narratives, removing the self from the vulnerabilities of stagnancy so it cannot be caught. Forceful with the self-compass."],
      ["Frustration (1 · 4 · 7)", "Driven to affirm idealized experiences and perspectives, shunning the mundane and boring; needs self-generated ideas as the foundation of orientation."],
      ["Positive (9 · 2 · 7)", "Reframes reality toward self-affirming beliefs; every situation can be framed to bypass the fear response toward a gratifying destination."],
      ["Update-seeking (1 · 3 · 7)", "Sees the self as an agent of change and social amplification; satisfaction grows with reach and the potential to create freedom in standardized environments."],
    ],
    wings: [
      ["7w6", "Deepens awareness of thought patterns and the means of manipulating them through the head center. Less aggressive, more tactful in interactions."],
      ["7w8", "Moves away from the need for mental validity, using the force of the gut center to amplify the creativity of the head center."],
    ],
    keywords: ["options", "pleasure", "planning", "gluttony"],
    description: "Keep options perpetually open and maintain positive anticipation as a defense against pain. Reframe limitation as opportunity; move quickly so discomfort cannot catch up.",
  },
  8: {
    name: "The Challenger",
    script: "Gut-Rejection",
    center: "gut",
    tagline: "Control through strength",
    epithets: "The Whale · Self-Ordained Autocrat · High in Conflict · Scary Eyes · The Mountain",
    essence: [
      "Eight forms the point of fixation with power and autonomy in its purest form — separating the will of the self from all else and continuously expanding its reach. Eight rejects vulnerability in the essence of their personality, refusing the gut center’s need for full perception and relationship with all aspects of existence by asserting willpower and psychological and physical control.",
      "The story of the self is fundamentally believed as fact and consistently acted upon; competing stories are offenses or lies to be ignored — or trampled if forced. Where Nine withdraws from the world to protect its sense of presence, Eight has difficulty disconnecting: the sense of self is tied to how one expands and controls boundaries externally. The need for autonomy of will dominates the qualities that would open the person to receiving understanding and care — so others rarely see the depth of intention behind the intensity.",
      "They form identity through refusing to be overtaken, replacing the fear of vulnerability by guarding the softest part of the gut — the permeability of being — by becoming impenetrable. It is the only response they can instinctually command, and it reduces the gut’s breadth of experience and its responsiveness to updates.",
    ],
    story: "The will to power is the will to live. Constant climbing of the mountain: more presence, more real, more intense. At the top, I will be able to tend to the vulnerable — but until then, time isn’t to be wasted on the give and take of emotion.",
    qualities: [
      "Expanding sense of presence and autonomy; a distinct, unquestionable largeness",
      "Reveals hidden conflicts by generating overt conflict",
      "Values strength and freedom in every decision; refuses weakness",
      "Struggles to accept defeat or loss — usually retaliating to win again",
      "Carves out boundaries through force rather than merging",
      "Identifies false integrity in others and the environment",
    ],
    triads: [
      ["Gut (8 · 9 · 1)", "Full engagement and direct response to immediate environmental changes, reaffirming the area of boundary control. Impulsive and no-nonsense; the most assertive physical presence of the assertive triad."],
      ["Assertive (3 · 7 · 8)", "Expands the area of oversight and control by taking positions of power; most at ease when able to take what is wanted. Prone to stripping others of power if needs are not met."],
      ["Rejection (2 · 5 · 8)", "An intense wall separating the vulnerable aspects of the psyche from the world; disregards the need for nurture, becoming a cyclops of willfulness."],
      ["Reactive (4 · 6 · 8)", "Untethered anger toward falsity or attempts at usurping control; pushes others to the point of exposure to satisfy the need for direct authenticity and “true colors”."],
      ["Autonomy-seeking (5 · 6 · 8)", "Consistently develops control and influence over resources and relationships to become self-reliant — and in turn a resource others rely on."],
    ],
    wings: [
      ["8w9", "The immovable object. Rests and trusts in the body’s immediate response; relaxes into the body and moves only when action is necessary. Non-verbal, physically grounded, quietly assertive."],
      ["8w7", "The unstoppable force. Distrusts the gut’s efficacy in immediate conflict and controls the direction of force through future planning. More verbally assertive, creative, exhausting to oppose."],
    ],
    keywords: ["power", "protection", "intensity", "excess"],
    description: "Assert presence and push against limits to ensure they will never be controlled or betrayed. Ferociously protective of those they claim as their own.",
  },
  9: {
    name: "The Peacemaker",
    script: "Gut-Attachment",
    center: "gut",
    tagline: "Peace through harmony",
    epithets: "The Hypnagogue · The Empath · The Kaleidoscope · The Boundary Between Blindness and Enlightenment",
    essence: [
      "Nine is fixated on identifying the right emotional place for the body and psyche. Boundaries, experiences and connections are felt as potential places of integration — or of confusion and decay — and the maintenance of boundaries is prioritized by pulling away from the changes of the world.",
      "Nine is fundamentally torn between internal and external energies, constantly weighing which causes more inner disturbance: awareness or dissociation. From that result, the Nine paves a path of least resistance that keeps the inner world consistent, staying in touch with themselves and the universe on their own terms — minimizing needs too tense to engage directly, and delaying reactions to sustain inner harmony. The self is removed from the action of the gut center in favor of reading quality of experience through vibes, subtleties and unspoken characteristics.",
      "The core issue of Nine is dissociation from commitment to existence within their own beliefs and needs. They hold back their will and let others get their way to reach harmony conveniently — producing a shadow willfulness that holds grudges or discharges itself by covertly dismantling other people’s wills. Yet their keen perception of nuanced emotional readings gives Nines a great capacity for empathy: they can see themselves in everybody’s self-experience and provide space for it.",
    ],
    story: "A dreamer and individualist, split between the relaxed state of undisturbed existence and the shocks of being triggered by the hiccups of reality. Trusting vibes and subtle cues — sometimes dragged into things without checking in with their own motivations.",
    qualities: [
      "Withdraws from the gut center’s need for presence",
      "Integrates conflicting intentions through a reconciling lens",
      "Perceives the subtleties of relationships; sees holistic pictures of emotional weight",
      "Erases the self’s need for boundaries in favor of a holistic perception",
      "Swings between assertion and withdrawal, common to all attachment types",
      "Maintains instinctual desirability by becoming a perfect mirror to partners",
    ],
    triads: [
      ["Gut (8 · 9 · 1)", "The emotional aspect of the gut: seeks to maintain a positive feeling about the self, even by exposing the self to negativity."],
      ["Withdrawn (9 · 4 · 5)", "Removes selfhood and presence from the world to protect the possibility of transformation and harmony from the hard materiality of others. More apparent in 9w8."],
      ["Attachment (9 · 3 · 6)", "Identified with the merging point between people — jumping between hyper-individuation and over-adaptation to the environment. More apparent in 9w1."],
      ["Positive (9 · 2 · 7)", "Sees self and environment in constant change that, with the right mindset, can be propelled toward a total sense of wellbeing."],
      ["Desirability-seeking (9 · 2 · 4)", "Presents the self as a unique resource for understanding and empathy — wanted and desired without trying."],
    ],
    wings: [
      ["9w8", "Rejects the need to alter their basic state; reactively severs the self from what causes disharmony, like a snapping turtle descending into its shell. Non-verbal, unmoved, identified with being in control of their experience."],
      ["9w1", "Dissociates from disharmony to process anger — and the justifications for why they could be wrong — before directing it. More calculating and philosophical; identified with being righteous, with elements of martyrdom."],
    ],
    keywords: ["harmony", "comfort", "merging", "inertia"],
    description: "Maintain inner peace by losing the self in others, routines, or comfortable distractions. Absorb surrounding priorities while forgetting their own, only to wonder why they feel absent.",
  },
};
