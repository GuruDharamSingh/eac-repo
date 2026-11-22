import styles from "./manifesto.module.css";

export const metadata = {
  title: "Manifesto | Elkdonis Arts Collective",
  description:
    "The foundational philosophy of the Elkdonis Arts Collective — Essentialism, Timelessness, and Space.",
};

export default function ManifestoPage() {
  return (
    <div className={styles.root}>
      {/* Opening void — full bleed title panel */}
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <p className={styles.greekRoot}>
        
          </p>
          <h1 className={styles.heroTitle}>Manifesto</h1>
          <div className={styles.heroDivider} />
          <p className={styles.heroSub}>
            We are Elkdonis Arts Collective.<br />
             Elkdonis Arts is a community organization dedicated to promoting and practicing various art methodologies, education, and cultural exchange for public benefit. We provide accessible educational programs, workshops, lectures, and learning opportunities across diverse disciplines, including visual arts, theatre, philosophy, literature and cultural studies. We support artists, educators, thinkers, and creatives by offering opportunities to present, develop, and share artistic and intellectual work. We aim to engage and support emerging creatives through mentorship and community-based learning. Towards this end, we collaborate with individuals and organizations locally, nationally, and internationally in furtherance of these purposes.
          </p>
        </div>
        <div className={styles.scrollCue}>↓</div>
      </section>

      {/* What is Art For */}
      <section className={styles.questionSection}>
        <div className={styles.questionInner}>
          <h2 className={styles.questionHeading}>What is Art For?</h2>
          <div className={styles.questionBody}>
           
         
            <p>We are interested in the creative process as a method of invocation and inquiry. The artist endeavours to penetrate experience in order to know the self and the world. It is a difficult
and neverending process to find ways of using a medium to interpret something seen and experienced
into a form which can be received. To persevere in this process despite frustration
and failure requires commitment and work, driven in large part by human necessity. </p>
          </div>
        </div>
      </section>

      {/* Three Principles */}
      <section className={styles.principlesSection}>
        <div className={styles.principlesHeader}>
       
          <h2 className={styles.principlesTitle}>
            Three Qualities
          </h2>
          <p className={styles.principlesIntro}>
            Although our collective in practice is broadly inclusive,
            experimental, and evolving, its art is nonetheless characterized
            by three essential qualities:
          </p>
        </div>

        {/* I. Essentialism */}
        <div className={styles.principle} data-index="I">
          <div className={styles.principleNumber}>I</div>
          <div className={styles.principleContent}>
            <h3 className={styles.principleTitle}>Essentialism</h3>
            <p className={styles.principleBody}>
             Our work centers on the soulfulness of presence—what emerges when form is stripped to its most honest state. We use recognisable objects not as literal representations, but as vessels for emotional resonance and existential clarity. In this practice, essence is not merely what is left behind after reduction, but the depth of being that reveals itself when distraction is removed.
        
            We pursue the objectivity of presence: the way a shape, line, or colour exists in its own truth. Objects are distilled to their core not for abstraction’s sake, but to amplify this quality of being. Each element carries weight not because of what it depicts, but because of how it inhabits the space. This is a form of reduction rooted not in minimalism alone, but in reverence.
 The result is an invitation: to pause, to witness, and to encounter the quiet soulfulness that resides in what is essential.

            </p>
           
          </div>
        </div>

        {/* II. Timelessness */}
        <div className={`${styles.principle} ${styles.principleAlt}`} data-index="II">
          <div className={styles.principleNumber}>II</div>
          <div className={styles.principleContent}>
            <h3 className={styles.principleTitle}>Timelessness</h3>
            <p className={styles.principleBody}>
              Our art invites viewers to experience the eternal present. In doing so, we unlock new dimensions of perception and connection.
 Reductionism typically explores another dimension of time, a dimension which is not
sequential or “horizontal” but rather — eternal — or “vertical”. This verticality is the same dimension which contains the creative act itself. 
This has the curious effect of stopping, even for a brief instant, the associative mechanism in a being&apos;s head-brain, so that attention may be freed to participate in the sensation of the whole. Nothing is happening in the usual sense, and therefore time does not pass. The result is an enhanced awareness of posture, positioning of visual elements and their inter-relationships.  Freezing the frame, rendering objects static, also has the effect of freeing other forms of awareness, such as feeling (motion through
emotion).
</p>
          </div>
        </div>

        {/* III. Space */}
        <div className={styles.principle} data-index="III">
          <div className={styles.principleNumber}>III</div>
          <div className={styles.principleContent}>
            <h3 className={styles.principleTitle}>Spaciousness</h3>
            <p className={styles.principleBody}>
             We prioritize the viewer&apos;s experience, crafting scenes that envelop and engage. Our art establishes a sense of spaciousness that transcends physical boundaries, drawing the viewer into a profound relationship with the work.  As the artist strives for communication, scenes are composed for a viewer who is not a voyeur outside the scene but rather a participant who is the reason for the work and necessarily a part of it. Everything in the scene is oriented first and foremost to the viewer, so as to bring the viewer into a relationship with it. Therefore, depth of field is not bounded by the frame: it includes the viewer in a true experience of space. 
              Thus, the art is only completed by viewing.
This sense of space is not something filled or measured, but felt—an open stillness that invites presence. The space in the work becomes shared space—between object and observer, stillness and awareness, inside and outside. In this way, the act of viewing is not passive, but collaborative, where meaning unfolds not in the object alone, but in the open field between the viewer and what is seen.
            </p>
          </div>
        </div>
      </section>

      {/* Three Programs */}
      <section className={styles.programsSection}>
        <div className={styles.programsInner}>
          <h2 className={styles.programsTitle}>Three Commitments</h2>
          <div className={styles.programsGrid}>
            <div className={styles.programCard}>
              <div className={styles.programGlyph}>✦</div>
              <h3>Inquiry Through Making</h3>
              <p>
                Creating art as the medium to inquire into our shared human
                existence. New works are often created in public spaces in
                response to a proposed inquiry.
              </p>
            </div>
            <div className={styles.programCard}>
              <div className={styles.programGlyph}>✦</div>
              <h3>Sanctuary</h3>
              <p>
                Providing a place where beauty and inquiry can meet. Resonant
                works and spaces are included. The collective is committed to
                using art as the means, not the end.
              </p>
            </div>
            <div className={styles.programCard}>
              <div className={styles.programGlyph}>✦</div>
              <h3>Education & Community</h3>
              <p>
                Providing education through demonstrations, workshops, and
                inviting access to our process as it happens. Our works are
                intended to be experienced, not sold.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Closing declaration */}
      <section className={styles.closingSection}>
        <blockquote className={styles.closingQuote}>
          &ldquo;Our works are timeless, essential, reductionist — and often
          violate scale. We typically explore the vertical dimension of time,
          which contains the creative act itself, and by orienting everything
          toward the viewer, bring one into a relationship with it.&rdquo;
        </blockquote>
        <p className={styles.closingCities}>
          Toronto &nbsp;·&nbsp; Los Angeles &nbsp;·&nbsp; Paris
        </p>
      </section>
    </div>
  );
}
