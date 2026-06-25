"use strict";

/**
 * Per-type content for the Hidden Enneagram site.
 * Used by seed-enneagram-site.mjs to inject distinct content into each type page.
 * Indexed 0–8 (Type 1 = index 0).
 */
const TYPE_DATA = [
  {
    ordinal: "One",
    title: "One: Gut-Frustration",
    epithet: "The Scientist and Lab Rat &middot; Mind Inside Matter &middot; Hyper-Optimizer of Existence &middot; The Thin Blade",
    body: `<p>
        Type One is fixated on using the mind to analyze and pick at its psycho-physiological
        experience to find flaws that need to change and improve upon &mdash; to remove
        &ldquo;bad things&rdquo; and optimize the &ldquo;good things.&rdquo;
      </p>
      <p>
        One removes its sense of humanity from the fluid quality of being-presence and
        emphasizes a need for control against aspects of existence that cause chaos or
        create disgust. There is an underlying shame in One that signals the movement
        of the Enneagram into the heart center: it imposes systematic order and moral
        frameworks on instinctive impulse, which is self-rejecting and critical.
      </p>`,
    qualities: [
      "Philosopher of values for sensory experience",
      "The body as a moral temple",
      "Hyper-attunement to flaws, errors, and discontinuities",
      "Seeks control over reality through systematic improvement",
      "Anger is repressed and converted into moral urgency",
      "Self-assumed responsibility to correct, clean, and improve life",
      "Prone to educating others about the harm they cause unintentionally",
    ],
  },
  {
    ordinal: "Two",
    title: "Two: Image-Rejection",
    epithet: "Big Smile &middot; Love and Positivity Salesman &middot; The Heart of the Heart Center",
    body: `<p>
        Two subverts the image center&rsquo;s need for worth by becoming the beacon of
        love and source of validation, severing the need to process the complexities of
        self. This creates a tug of war between the consistent image of goodness and the
        messier needs for validation &mdash; creating a void on the receiving end.
      </p>
      <p>
        The constant seeking to remain consistent and &ldquo;good&rdquo; creates a void
        where all the unwanted and chaotic aspects of self are not allowed expression.
        This can boil tension in relationships as others are not allowed to acknowledge
        the hidden aspects &mdash; but desired to do so.
      </p>`,
    qualities: [
      "Warm, personable, and charismatic",
      "Impenetrable quality of goodness",
      "Responsible for taking care of others or offering positive outlooks",
      "Internalized shame about harboring bad thoughts or feelings, resolved by doing more for others",
      "Love and care as a hidden contract for equal value exchange",
      "Feeling shame if perceived to be gaining something for oneself",
      "Inauthentic in Super-Authenticity",
    ],
  },
  {
    ordinal: "Three",
    title: "Three: Image-Attachment",
    epithet: "The Intellectual of the Emotional Center &middot; The Chameleon &middot; Being the Best",
    body: `<p>
        Three is concerned with analyzing and processing qualities and attributes of
        being to organize and refine their expression according to standards that
        maximize self-worth. Image-Attachment refuses the center&rsquo;s need to
        establish worth based on internal parameters and instead seeks to build the
        self toward externally recognizable aspects that signify excellence.
      </p>
      <p>
        Three is always aware of the gaze of the other and, based on the felt value
        exchange, micromanages behaviors to ensure they are still embodying competency
        in the field of interest &mdash; maintaining continuous control of their image.
      </p>`,
    qualities: [
      "Optimistic in being able to achieve what is needed",
      "Aware of social consequences and effects in actions and speech",
      "Adept chameleon, adjusting appearances and attitudes to perform better",
      "Overconfidence masking hidden shame",
      "Skilled at understanding ranges of human expression and characteristics",
      "Controlled and performative expression",
      "Fear of being outed as a sham",
    ],
  },
  {
    ordinal: "Four",
    title: "Four: Image-Frustration",
    epithet: "The Melodrama of the Incessant Critic &middot; Disdainful Lover &middot; Diamond in the Rough",
    body: `<p>
        Four is fixated on severing aspects of themselves that are incongruent with a
        pure and essential quality they are protecting &mdash; moving from constant
        states of emotional despair into the protection of a venerated value. This type
        withdraws from the heart center&rsquo;s need to recognize itself in
        &ldquo;easy&rdquo; and externalized markers of worth.
      </p>
      <p>
        This creates a severe sense of separation between the internalized sense of
        worth and the external world. Love and worthiness are believed to be tied to
        the capacity to experience and endure pain and darkness &mdash; creating a
        vulnerable masochism under an otherwise self-assured demeanor.
      </p>`,
    qualities: [
      "Deeply individualistic and protective of inner uniqueness",
      "Engulfs themselves in negativity to build a path toward the pure and essential",
      "Believes love can only be reached through equal levels of pain",
      "Loud judgement of aspects of the world perceived as shallow or incongruent with depth",
      "Self-sacrificial orientation toward beauty and meaning",
      "Constant reaching toward an ideal of love that is always just out of reach",
      "Sees the external world as a weak conductor of genuine depth",
    ],
  },
  {
    ordinal: "Five",
    title: "Five: Head-Rejection",
    epithet: "Brain in a Jar &middot; Useless Savant &middot; Pure Insight and Knowing",
    body: `<p>
        Five withdraws from the head center&rsquo;s need to develop or update its
        frame of reference in favor of deep understanding of a narrow scope. Five&rsquo;s
        discomfort with the chaotic depth and complexity of internal desires and emotional
        experiences compels them to use the head center to compartmentalize and deepen
        their understanding of the core source and nature of these aspects.
      </p>
      <p>
        This can result in feeling &ldquo;not alive&rdquo; or &ldquo;not human&rdquo;
        as the dynamic aspects of internal drives and experiences have to pass through
        conceptualization before they are allowed to be experienced &mdash; separating
        the observer from its experience.
      </p>`,
    qualities: [
      "Withdrawn into knowledge as a substitute for direct engagement",
      "Deep expertise in a narrow and self-chosen field of interest",
      "Iconoclastic and subjectively oriented in their deepening of insight",
      "Attracted to the taboo and unmarked aspects of reality",
      "Detached from external frames and conclusions",
      "Obsessed with how a subject of interest moves, transforms, and decays",
      "Competent like an artistic visionary seeking the most direct articulation of experience",
    ],
  },
  {
    ordinal: "Six",
    title: "Six: Head-Attachment",
    epithet: "Tweaker Brain &middot; Fight about Truth &middot; Suspicious Skeptic &middot; Overprocessor",
    body: `<p>
        Six uses values and beliefs as a means of navigating truth and gaining clarity
        &mdash; resulting in the bifurcation of reality into internal beliefs and
        external facts, fighting to find certainty. The core drive is to dissect truth
        from falsity, what can be trusted from what is deceitful.
      </p>
      <p>
        The self is organized around a double-bind: the need for certainty and the
        impossibility of certainty. To resolve this, Six creates simulations of
        reality-checks, hypothesizes outcomes, confronts inconsistencies, and scans
        for threats &mdash; creating reactivity and insecurity when systems or beliefs
        become questionable.
      </p>`,
    qualities: [
      "Primary obsession with reality, truth, and reliability",
      "Hypervigilance toward errors of logic and obfuscation of any kind",
      "Creating systems of loyalty to navigate the space between trust and doubt",
      "Dynamic thinking: sharp awareness of the back-and-forth in information",
      "Reactivity when trusted systems or beliefs are questioned",
      "Scanning for threats and patterns of deceit",
      "Can be both strongly loyal and strongly skeptical simultaneously",
    ],
  },
  {
    ordinal: "Seven",
    title: "Seven: Head-Frustration",
    epithet: "The Hyperbrain &middot; Untethered Mind &middot; Fish Out of Water",
    body: `<p>
        Seven judges and moves away from the head center&rsquo;s need for full
        perception and truth in favor of creating possibilities and new frames of
        reference &mdash; unhindered by reality and pre-established systems. The head
        center is no longer mainly a perceptive tool; it is utilized to proactively
        escape the lack of stimulation for a continuous feeling of change and movement.
      </p>
      <p>
        Seven has a deep need for liberty and freedom from structure, as structures
        are seen as temporary beliefs or emotional states meant to be altered toward
        something more satisfying. Their ability to overcome situations mentally makes
        them believe they are invincible &mdash; creating a void of growing problems.
      </p>`,
    qualities: [
      "Driven and forceful at maintaining hopefulness and optimism toward their own plans",
      "Knowledge and perspectives are tools for effects and outcomes, not just understanding",
      "Deep need for liberty and freedom from constraint",
      "Speeds through new concepts, deriving and outwardly building new directions",
      "Uses the mind to escape transformative weight of emotional experience",
      "Dissatisfaction when progress toward a more idealized state isn't visible",
      "Reframing reality to maintain a state of upward motion and positive charge",
    ],
  },
  {
    ordinal: "Eight",
    title: "Eight: Gut-Rejection",
    epithet: "The Whale &middot; Self-Ordained Autocrat &middot; Scary Eyes &middot; The Mountain",
    body: `<p>
        Eight forms the point of fixation with power and autonomy in its purest form
        &mdash; separating the will of the self from all else and continuously expanding
        its reach. This type rejects the gut center&rsquo;s need for full perception
        by asserting willpower and psychological and physical control.
      </p>
      <p>
        The story of the self is fundamentally believed as a fact and consistently
        acted upon &mdash; all competing stories are seen as offenses or lies. Eight
        rejects the gut&rsquo;s need for tranquil consistency in favor of constant
        movement toward more pressing immediate impulses and protection of core
        boundaries.
      </p>`,
    qualities: [
      "Expanding sense of presence and autonomy",
      "Can be unintentionally physically and psychologically controlling",
      "Reveals hidden conflicts through generating overt conflict",
      "Rejects personal need for protection and vulnerability in favor of psycho-emotional toughness",
      "Values strength and freedom in every decision",
      "Deep belief that what is desired for the self can and will be achieved",
      "Struggle with accepting defeat, usually retaliating to win again",
    ],
  },
  {
    ordinal: "Nine",
    title: "Nine: Gut-Attachment",
    epithet: "The Hypnagogue &middot; The Empath &middot; The Kaleidoscope &middot; The Boundary Between Blindness and Enlightenment",
    body: `<p>
        Nine is fixated on identifying the right emotional place for the body and
        psyche. Boundaries, experiences, and connections are experienced as potential
        places of integration and/or confusion. Nine is fundamentally torn between
        internal and external energies &mdash; constantly weighing which causes more
        inner disturbance: awareness or dissociation.
      </p>
      <p>
        The core issue of Nine is dissociation from commitment to existence within
        their own beliefs and needs. They hold back their will and let others have
        their way to reach harmony more conveniently &mdash; though this causes a
        shadow willfulness that fulfills itself by covertly dismantling other
        people&rsquo;s wills.
      </p>`,
    qualities: [
      "Keen perception of nuanced emotional, energetic, or vibrational readings",
      "Great capacity for empathy — can see themselves in everybody's experience",
      "Prioritizes the maintenance of inner harmony above direct assertion",
      "Bipolar relationship with being noticed and seen",
      "Delays reactions to sustain inner harmony, creating pent-up aggression",
      "Dissociation from commitment to their own beliefs and needs",
      "Minimizes certain needs that would be too tense to engage with directly",
    ],
  },
];

module.exports = { TYPE_DATA };
