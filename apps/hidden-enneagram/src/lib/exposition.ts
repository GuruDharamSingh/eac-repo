// Ario's exposition, folded from the old pages (verbatim). Generated 2026-11-07 from live :3012 and app/triads/page.tsx.
export interface ExpoSection {
  /** kebab id, unique, used as an anchor: e.g. "what-is", "gut-center", "core-fixation", "triad-object-relations" */
  id: string;
  /** the old path it came from first: "/introduction" | "/centers" | "/triads" */
  source: string;
  eyebrow: string;   // small kicker text if the page had one, else ""
  heading: string;
  /** HTML using only <p>, <em>, <strong>, <ul>, <li>, <blockquote>, <h3>. No classes, no styles, no links. */
  body: string;
}

export const EXPO_INTRODUCTION: ExpoSection[] = [
  {
    id: "what-is",
    source: "/introduction",
    eyebrow: "Introduction To The System",
    heading: "What is the Enneagram?",
    body:
      `<p>In the sections below, we describe the Enneagram’s main ideas and how the system works.</p><p>The Enneagram is a symbolic map of movement and transformation, rooted in esoteric mathematics, music theory through the law of octaves, the law of three, and the law of seven as taught by G.I. Gurdjieff.</p><p>There are 9 points, each representing a general stage or quality which requires a specific change of quality to transform. Each point sits between two adjacent types — its wings — just as a musical scale moves from one tone to the next.</p><p>Individuals generally utilize one of three centers of intelligence to process their identity and frame their needs and place in the world. Each of the 9 points represents a relationship to the core need of one of these three Centers of Intelligence: Body, Heart, Head.</p><p>Consider it a radar scanner of identity that surfaces the core tensions and struggles you experience — and a guide toward understanding the deeper motivations that shape how you relate, protect, desire, and disconnect.</p>`,
  },
  {
    id: "gut-center",
    source: "/introduction",
    eyebrow: "Energy of the Body",
    heading: "Gut Center",
    body:
      `<p>(Types 8, 9, 1)</p><p><strong>Core Need:</strong> To establish internal stability through sustainable boundaries, congruence between intention and action, psychophysiological freedom, and instinctual alignment with “gut” presence. This center seeks somatic certainty — a grounded sense of “I am,” rooted in orientation to resistance, impact, and bodily knowing.</p><ul><li>Expansion of boundaries and intensified control (8)</li><li>Avoidance of conflict and assimilation of disturbances through dissociation (9)</li><li>Hyper-correction of impulses through systematic adherence to internalized standards (1)</li></ul>`,
  },
  {
    id: "heart-center",
    source: "/introduction",
    eyebrow: "Energy of Image",
    heading: "Heart Center",
    body:
      `<p>(Types 2, 3, 4)</p><p><strong>Core Need:</strong> To establish authentic identity independent of others’ perceptions, balancing relational attunement with genuine self-definition. This center monitors internal experiences and imagery that have value-laden reactions to the impressions of the external and inner world — self-image, preferences, and assessments of others through affect.</p><ul><li>Inflation of self through giving and relational service (2)</li><li>Adaptation of image to continuously match the expectations of the environment (3)</li><li>Intensification of individuality through contrast, longing, and inner depth (4)</li></ul>`,
  },
  {
    id: "head-center",
    source: "/introduction",
    eyebrow: "Energy of Thought",
    heading: "Head Center",
    body:
      `<p>(Types 5, 6, 7)</p><p><strong>Core Need:</strong> To arrive at certainty and inner guidance through the intellect, navigating the gap between thought and trust. Driven by increasing capabilities and curiosity, this center discerns, reformulates, and creates perspectives at will — and by nature can sever itself from direct contact with immediate reality as it prioritizes how things move in time.</p><ul><li>Withdrawal into knowledge as a substitute for direct engagement with the world (5)</li><li>Scanning for threat and building systems of loyalty to navigate doubt and uncertainty (6)</li><li>Forward projection into possibility and plans to outrun present anxiety (7)</li></ul>`,
  },
  {
    id: "core-fixation",
    source: "/introduction",
    eyebrow: "",
    heading: "Core Fixation",
    body:
      `<p>Once a Center has been over-activated in response to the wound, it begins to form a looped response pattern — a psychological structure that attempts to resolve the loss of stability using the same tools that were shaped by the injury itself. This is where the Core Fixation emerges.</p><p>Each Enneagram type follows a distinct internal sequence: a three-part script made up of the Object Relation, the Energy Orientation, and the Harmonic Style. This defines the exact relationship that the individual forms with their center of energy.</p><p>With self-understanding and accurate insight on your type, you can unwind this looping pattern by releasing the responsibility of thinking from one dominant center — and allowing the image, mind, and body to process the information they are each designed to process. This is the starting key to integration.</p><p>The enneagram reveals the story you framed your life around to re-establish a sense of wholeness — and how that reaction shaped the way you relate, protect, desire, and disconnect.</p>`,
  },
];

export const EXPO_CENTERS: ExpoSection[] = [];

export const EXPO_TRIADS: ExpoSection[] = [
  {
    id: "triad-intro",
    source: "/triads",
    eyebrow: "A map of nine fixations",
    heading: "The Enneagram",
    body:
      `<p>Nine ways the psyche contracts around a core wound. Click any point to explore a type. Use the toggles to reveal the geometric relationships between them.</p>`,
  },
  {
    id: "triad-three-centers",
    source: "/triads",
    eyebrow: "Body · Heart · Head",
    heading: "Three Centers",
    body:
      `<h3>Where awareness lives</h3><p>The nine types organize into three centers of intelligence. The <em>Body center</em> — types 1, 8, and 9 — processes experience through instinct, boundary, and physical presence. The <em>Heart center</em> — types 2, 3, and 4 — navigates through feeling, image, and relational meaning. The <em>Head center</em> — types 5, 6, and 7 — makes sense of experience through thinking, planning, and analysis.</p><p>Each center has one type that over-expresses its energy (8, 4, 7), one that under-expresses it (9, 2, 5), and one that swings between the two (1, 3, 6). The center a type belongs to describes its habitual domain of contraction — not necessarily its most developed capacity.</p><ul><li>Body center · 1, 8, 9</li><li>Heart center · 2, 3, 4</li><li>Head center · 5, 6, 7</li></ul>`,
  },
  {
    id: "triad-centers-diagram",
    source: "/triads",
    eyebrow: "",
    heading: "The Three Centers, as drawn",
    body:
      `<ul><li><strong>BODY:</strong> Processes experience through instinct, boundary, and physical presence.</li><li><strong>HEART:</strong> Navigates through feeling, image, and relational meaning.</li><li><strong>HEAD:</strong> Makes sense of experience through thinking, planning, and analysis.</li></ul>`,
  },
  {
    id: "triad-harmony",
    source: "/triads",
    eyebrow: "3 · 6 · 9",
    heading: "The Harmony Triad",
    body:
      `<h3>The inner triangle</h3><p>Types 3, 6, and 9 form the equilateral triangle at the center of the diagram. They are sometimes called the <em>image</em> types or the <em>shock points</em> — each sits at the pivot of one of the three centers and carries the central organizing anxiety of that center in its most fundamental form.</p><p><em>Type 9</em> is the apex: the Peacemaker who forgets the self entirely, falling asleep to their own presence. <em>Type 3</em> inverts this: hyperactive self-construction through image and role. <em>Type 6</em> oscillates — loyal to structures that promise security, but perpetually doubting whether they can be trusted.</p><p>Together they reveal the three faces of a single problem: the relationship between self and world when the self cannot be taken for granted.</p>`,
  },
  {
    id: "triad-frustration",
    source: "/triads",
    eyebrow: "1 · 4 · 7",
    heading: "The Frustration Triad",
    body:
      `<h3>Seeking what is missing</h3><p>Types 1, 4, and 7 share a structural orientation toward <em>something that is not yet here</em>. They are called the frustration triad because each is organized around a gap between what is and what should be — and each manages that gap differently.</p><p><em>Type 1</em> turns toward the outer world and tries to correct it. <em>Type 4</em> turns inward and mourns what is missing in the self. Type <em>7</em> turns toward the future and fills the gap with plans, options, and anticipation.</p><p>The frustration is rarely conscious as frustration. It feels like discernment, depth, or enthusiasm. The work for each type is recognizing that the gap they are organized around is not a problem to be solved but a premise to be examined.</p>`,
  },
  {
    id: "triad-rejection",
    source: "/triads",
    eyebrow: "2 · 5 · 8",
    heading: "The Rejection Triad",
    body:
      `<h3>Navigating need and contact</h3><p>Types 2, 5, and 8 are organized around the experience of having their needs — or their right to have needs — rejected early in life. Each developed a distinct strategy in response.</p><p><em>Type 2</em> learned that their own needs were not welcome, so they moved toward others and became indispensable. <em>Type 5</em> learned that engagement depleted them, and withdrew to manage what little energy they had. <em>Type 8</em> learned that vulnerability invited betrayal, and armored themselves with force.</p><p>Underneath these three very different presentations is the same wound: the conviction that contact with others — real, undefended contact — is unsafe or impossible.</p>`,
  },
  {
    id: "triad-hexagram",
    source: "/triads",
    eyebrow: "1 · 4 · 2 · 8 · 5 · 7",
    heading: "The Inner Hexagram",
    body:
      `<h3>Lines of movement</h3><p>The six remaining types — 1, 2, 4, 5, 7, and 8 — form the inner hexagram through the path <em>1→4→2→8→5→7→1</em>. These lines describe the directions of integration and disintegration: the psychological movement that occurs under stress and under growth.</p><p>In stress, each type moves toward the less healthy expressions of the type it points <em>from</em>. In growth, it moves toward the healthier qualities of the type it points <em>to</em>. These are not destinations but directions — observable patterns in behavior when internal resources contract or expand.</p><p>The hexagram and triangle together form the complete figure: a map not just of nine fixed types but of nine fields of movement, each in relation to every other.</p>`,
  },
  {
    id: "object-relations-frustration",
    source: "/type-1",
    eyebrow: "Object Relations",
    heading: "Frustration (+)",
    body:
      `<p>“Something essential is missing — I should fix, chase, or perfect it.” Ego-identified with continuously increasing charge. Seeking to move beyond the center’s need for something more “right.” Judges and moves away from the center’s need for full perception in favor of what is more ideal, refined, or expansive.</p><ul><li><strong>Body-Frustration (1):</strong> Hyper-correction of the gut’s instinctual impulses through systematic standards — rejecting the fluid quality of being-presence to impose moral and intellectual order.</li><li><strong>Image-Frustration (4):</strong> Amplification of uniqueness and inner depth to mark the gap between self and world — chasing an ideal form of value too abstract to be fully realized externally.</li><li><strong>Mind-Frustration (7):</strong> Forward projection into new possibilities and frames of reference — the head center no longer primarily used as a perceptive tool but as a means of escape from lack of stimulation.</li></ul>`,
  },
  {
    id: "object-relations-attachment",
    source: "/type-1",
    eyebrow: "Object Relations",
    heading: "Attachment (=)",
    body:
      `<p>Avoiding destabilization by limiting friction. Driven by a persistent toggling between over-adaptation and withdrawal, designed to preserve access to the source of the need. This strategy suppresses individuated impulses that might jeopardize relational security — identified with preventing surges in charge and questioning the “why” of the center’s need.</p><ul><li><strong>Body-Attachment (9):</strong> Hyper-awareness of the environment creates a dissociation from immediate bodily impulses — a sensitivity to being perturbed through blurred boundaries between self and world.</li><li><strong>Image-Attachment (3):</strong> Hyper-awareness of standards creates a split between the raw personality and the curated, well-performed self that continuously updates to match.</li><li><strong>Mind-Attachment (6):</strong> Hyper-awareness of the duality between truth and falsity creates hypervigilance toward errors of logic and unreliable information.</li></ul>`,
  },
];

export interface TypeChapter {
  n: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
  /** the page's title, e.g. "Four: Image-Frustration" */
  name: string;
  /** the line under the title */
  epithets: string;
  /** the opening paragraph(s) before the first sub-heading, as HTML (<p> only) */
  lead: string;
  /** everything type-specific after that (sub-headings as <h3>, lists as <ul><li>), as HTML */
  body: string;
}

export const TYPE_CHAPTERS: TypeChapter[] = [
  {
    n: 1,
    name: "One: Gut-Frustration",
    epithets: "The Scientist and Lab Rat · Mind Inside Matter · Hyper-Optimizer of Existence · The Thin Blade",
    lead:
      `<p>Type One is fixated on using the mind to analyze and pick at its psycho-physiological experience to find flaws that need to change and improve upon — to remove “bad things” and optimize the “good things.”</p><p>One removes its sense of humanity from the fluid quality of being-presence and emphasizes a need for control against aspects of existence that cause chaos or create disgust. There is an underlying shame in One that signals the movement of the Enneagram into the heart center: it imposes systematic order and moral frameworks on instinctive impulse, which is self-rejecting and critical.</p>`,
    body:
      `<h3>Key Qualities</h3><ul><li>Philosopher of values for sensory experience</li><li>The body as a moral temple</li><li>Hyper-attunement to flaws, errors, and discontinuities</li><li>Seeks control over reality through systematic improvement</li><li>Anger is repressed and converted into moral urgency</li><li>Self-assumed responsibility to correct, clean, and improve life</li><li>Prone to educating others about the harm they cause unintentionally</li></ul>`,
  },
  {
    n: 2,
    name: "Two: Image-Rejection",
    epithets: "Big Smile · Love and Positivity Salesman · The Heart of the Heart Center",
    lead:
      `<p>Two subverts the image center’s need for worth by becoming the beacon of love and source of validation, severing the need to process the complexities of self. This creates a tug of war between the consistent image of goodness and the messier needs for validation — creating a void on the receiving end.</p><p>The constant seeking to remain consistent and “good” creates a void where all the unwanted and chaotic aspects of self are not allowed expression. This can boil tension in relationships as others are not allowed to acknowledge the hidden aspects — but desired to do so.</p>`,
    body:
      `<h3>Key Qualities</h3><ul><li>Warm, personable, and charismatic</li><li>Impenetrable quality of goodness</li><li>Responsible for taking care of others or offering positive outlooks</li><li>Internalized shame about harboring bad thoughts or feelings, resolved by doing more for others</li><li>Love and care as a hidden contract for equal value exchange</li><li>Feeling shame if perceived to be gaining something for oneself</li><li>Inauthentic in Super-Authenticity</li></ul>`,
  },
  {
    n: 3,
    name: "Three: Image-Attachment",
    epithets: "The Intellectual of the Emotional Center · The Chameleon · Being the Best",
    lead:
      `<p>Three is concerned with analyzing and processing qualities and attributes of being to organize and refine their expression according to standards that maximize self-worth. Image-Attachment refuses the center’s need to establish worth based on internal parameters and instead seeks to build the self toward externally recognizable aspects that signify excellence.</p><p>Three is always aware of the gaze of the other and, based on the felt value exchange, micromanages behaviors to ensure they are still embodying competency in the field of interest — maintaining continuous control of their image.</p>`,
    body:
      `<h3>Key Qualities</h3><ul><li>Optimistic in being able to achieve what is needed</li><li>Aware of social consequences and effects in actions and speech</li><li>Adept chameleon, adjusting appearances and attitudes to perform better</li><li>Overconfidence masking hidden shame</li><li>Skilled at understanding ranges of human expression and characteristics</li><li>Controlled and performative expression</li><li>Fear of being outed as a sham</li></ul>`,
  },
  {
    n: 4,
    name: "Four: Image-Frustration",
    epithets: "The Melodrama of the Incessant Critic · Disdainful Lover · Diamond in the Rough",
    lead:
      `<p>Four is fixated on severing aspects of themselves that are incongruent with a pure and essential quality they are protecting — moving from constant states of emotional despair into the protection of a venerated value. This type withdraws from the heart center’s need to recognize itself in “easy” and externalized markers of worth.</p><p>This creates a severe sense of separation between the internalized sense of worth and the external world. Love and worthiness are believed to be tied to the capacity to experience and endure pain and darkness — creating a vulnerable masochism under an otherwise self-assured demeanor.</p>`,
    body:
      `<h3>Key Qualities</h3><ul><li>Deeply individualistic and protective of inner uniqueness</li><li>Engulfs themselves in negativity to build a path toward the pure and essential</li><li>Believes love can only be reached through equal levels of pain</li><li>Loud judgement of aspects of the world perceived as shallow or incongruent with depth</li><li>Self-sacrificial orientation toward beauty and meaning</li><li>Constant reaching toward an ideal of love that is always just out of reach</li><li>Sees the external world as a weak conductor of genuine depth</li></ul>`,
  },
  {
    n: 5,
    name: "Five: Head-Rejection",
    epithets: "Brain in a Jar · Useless Savant · Pure Insight and Knowing",
    lead:
      `<p>Five withdraws from the head center’s need to develop or update its frame of reference in favor of deep understanding of a narrow scope. Five’s discomfort with the chaotic depth and complexity of internal desires and emotional experiences compels them to use the head center to compartmentalize and deepen their understanding of the core source and nature of these aspects.</p><p>This can result in feeling “not alive” or “not human” as the dynamic aspects of internal drives and experiences have to pass through conceptualization before they are allowed to be experienced — separating the observer from its experience.</p>`,
    body:
      `<h3>Key Qualities</h3><ul><li>Withdrawn into knowledge as a substitute for direct engagement</li><li>Deep expertise in a narrow and self-chosen field of interest</li><li>Iconoclastic and subjectively oriented in their deepening of insight</li><li>Attracted to the taboo and unmarked aspects of reality</li><li>Detached from external frames and conclusions</li><li>Obsessed with how a subject of interest moves, transforms, and decays</li><li>Competent like an artistic visionary seeking the most direct articulation of experience</li></ul>`,
  },
  {
    n: 6,
    name: "Six: Head-Attachment",
    epithets: "Tweaker Brain · Fight about Truth · Suspicious Skeptic · Overprocessor",
    lead:
      `<p>Six uses values and beliefs as a means of navigating truth and gaining clarity — resulting in the bifurcation of reality into internal beliefs and external facts, fighting to find certainty. The core drive is to dissect truth from falsity, what can be trusted from what is deceitful.</p><p>The self is organized around a double-bind: the need for certainty and the impossibility of certainty. To resolve this, Six creates simulations of reality-checks, hypothesizes outcomes, confronts inconsistencies, and scans for threats — creating reactivity and insecurity when systems or beliefs become questionable.</p>`,
    body:
      `<h3>Key Qualities</h3><ul><li>Primary obsession with reality, truth, and reliability</li><li>Hypervigilance toward errors of logic and obfuscation of any kind</li><li>Creating systems of loyalty to navigate the space between trust and doubt</li><li>Dynamic thinking: sharp awareness of the back-and-forth in information</li><li>Reactivity when trusted systems or beliefs are questioned</li><li>Scanning for threats and patterns of deceit</li><li>Can be both strongly loyal and strongly skeptical simultaneously</li></ul>`,
  },
  {
    n: 7,
    name: "Seven: Head-Frustration",
    epithets: "The Hyperbrain · Untethered Mind · Fish Out of Water",
    lead:
      `<p>Seven judges and moves away from the head center’s need for full perception and truth in favor of creating possibilities and new frames of reference — unhindered by reality and pre-established systems. The head center is no longer mainly a perceptive tool; it is utilized to proactively escape the lack of stimulation for a continuous feeling of change and movement.</p><p>Seven has a deep need for liberty and freedom from structure, as structures are seen as temporary beliefs or emotional states meant to be altered toward something more satisfying. Their ability to overcome situations mentally makes them believe they are invincible — creating a void of growing problems.</p>`,
    body:
      `<h3>Key Qualities</h3><ul><li>Driven and forceful at maintaining hopefulness and optimism toward their own plans</li><li>Knowledge and perspectives are tools for effects and outcomes, not just understanding</li><li>Deep need for liberty and freedom from constraint</li><li>Speeds through new concepts, deriving and outwardly building new directions</li><li>Uses the mind to escape transformative weight of emotional experience</li><li>Dissatisfaction when progress toward a more idealized state isn't visible</li><li>Reframing reality to maintain a state of upward motion and positive charge</li></ul>`,
  },
  {
    n: 8,
    name: "Eight: Gut-Rejection",
    epithets: "The Whale · Self-Ordained Autocrat · Scary Eyes · The Mountain",
    lead:
      `<p>Eight forms the point of fixation with power and autonomy in its purest form — separating the will of the self from all else and continuously expanding its reach. This type rejects the gut center’s need for full perception by asserting willpower and psychological and physical control.</p><p>The story of the self is fundamentally believed as a fact and consistently acted upon — all competing stories are seen as offenses or lies. Eight rejects the gut’s need for tranquil consistency in favor of constant movement toward more pressing immediate impulses and protection of core boundaries.</p>`,
    body:
      `<h3>Key Qualities</h3><ul><li>Expanding sense of presence and autonomy</li><li>Can be unintentionally physically and psychologically controlling</li><li>Reveals hidden conflicts through generating overt conflict</li><li>Rejects personal need for protection and vulnerability in favor of psycho-emotional toughness</li><li>Values strength and freedom in every decision</li><li>Deep belief that what is desired for the self can and will be achieved</li><li>Struggle with accepting defeat, usually retaliating to win again</li></ul>`,
  },
  {
    n: 9,
    name: "Nine: Gut-Attachment",
    epithets: "The Hypnagogue · The Empath · The Kaleidoscope · The Boundary Between Blindness and Enlightenment",
    lead:
      `<p>Nine is fixated on identifying the right emotional place for the body and psyche. Boundaries, experiences, and connections are experienced as potential places of integration and/or confusion. Nine is fundamentally torn between internal and external energies — constantly weighing which causes more inner disturbance: awareness or dissociation.</p><p>The core issue of Nine is dissociation from commitment to existence within their own beliefs and needs. They hold back their will and let others have their way to reach harmony more conveniently — though this causes a shadow willfulness that fulfills itself by covertly dismantling other people’s wills.</p>`,
    body:
      `<h3>Key Qualities</h3><ul><li>Keen perception of nuanced emotional, energetic, or vibrational readings</li><li>Great capacity for empathy — can see themselves in everybody's experience</li><li>Prioritizes the maintenance of inner harmony above direct assertion</li><li>Bipolar relationship with being noticed and seen</li><li>Delays reactions to sustain inner harmony, creating pent-up aggression</li><li>Dissociation from commitment to their own beliefs and needs</li><li>Minimizes certain needs that would be too tense to engage with directly</li></ul>`,
  },
];
