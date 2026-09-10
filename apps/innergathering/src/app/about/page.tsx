import Link from "next/link";
import type { Metadata } from "next";
import { getGuides } from "@/lib/data";
import { getLandingConfig } from "@/lib/landing";
import { toPlainText } from "@/lib/format";

export const metadata: Metadata = {
  title: "About",
  description: "About the Elkdonis Arts Collective — a mutual aid society for objective arts, education and cultural exchange.",
};

/**
 * About: the collective's own words — the mutual aid statement, the history,
 * the manifesto's three qualities and three commitments — then the board,
 * drawn from members' profiles. When the living About document exists in
 * Nextcloud it is linked here too.
 */
export default async function AboutPage() {
  const [members, config] = await Promise.all([getGuides(), getLandingConfig()]);

  return (
    <div className="ig-page">
      <p className="ig-kicker">The Collective</p>
      <h1>About</h1>

      <p className="ig-lead" style={{ marginTop: "1.5rem" }}>
        We are Elkdonis Arts Collective. Elkdonis Arts is a community organization dedicated to promoting and practicing various art methodologies, education, and cultural exchange for public benefit. We provide accessible educational programs, workshops, lectures, and learning opportunities across diverse disciplines, including visual arts, theatre, philosophy, literature and cultural studies. We support artists, educators, thinkers, and creatives by offering opportunities to present, develop, and share artistic and intellectual work. We aim to engage and support emerging creatives through mentorship and community-based learning. Towards this end, we collaborate with individuals and organizations locally, nationally, and internationally in furtherance of these purposes.
      </p>

      {config.aboutDocument?.url && (
        <p style={{ marginTop: "1rem" }}>
          <a className="ig-edit-link" href={config.aboutDocument.url} target="_blank" rel="noreferrer">
            Read the living About document →
          </a>
        </p>
      )}

      <hr className="saffron-divider" />

      <h2 className="ig-h2">What is Art For?</h2>
      <div className="ig-prose">
        <p>
          We are interested in the creative process as a method of invocation and inquiry. The artist endeavours to penetrate experience in order to know the self and the world. It is a difficult and neverending process to find ways of using a medium to interpret something seen and experienced into a form which can be received. To persevere in this process despite frustration and failure requires commitment and work, driven in large part by human necessity.
        </p>
      </div>

      <hr className="saffron-divider" />

      <h2 className="ig-h2">Three Qualities</h2>
      <p className="ig-lead">
        Although our collective in practice is broadly inclusive, experimental, and evolving, its art is nonetheless characterized by three essential qualities:
      </p>

      <div className="ig-quality">
        <span className="ig-quality-num">I</span>
        <div className="ig-prose">
          <h3>Essentialism</h3>
          <p>
            Our work centers on the soulfulness of presence—what emerges when form is stripped to its most honest state. We use recognisable objects not as literal representations, but as vessels for emotional resonance and existential clarity. In this practice, essence is not merely what is left behind after reduction, but the depth of being that reveals itself when distraction is removed.
          </p>
          <p>
            We pursue the objectivity of presence: the way a shape, line, or colour exists in its own truth. Objects are distilled to their core not for abstraction&rsquo;s sake, but to amplify this quality of being. Each element carries weight not because of what it depicts, but because of how it inhabits the space. This is a form of reduction rooted not in minimalism alone, but in reverence. The result is an invitation: to pause, to witness, and to encounter the quiet soulfulness that resides in what is essential.
          </p>
        </div>
      </div>

      <div className="ig-quality">
        <span className="ig-quality-num">II</span>
        <div className="ig-prose">
          <h3>Timelessness</h3>
          <p>
            Our art invites viewers to experience the eternal present. In doing so, we unlock new dimensions of perception and connection. Reductionism typically explores another dimension of time, a dimension which is not sequential or &ldquo;horizontal&rdquo; but rather — eternal — or &ldquo;vertical&rdquo;. This verticality is the same dimension which contains the creative act itself.
          </p>
          <p>
            This has the curious effect of stopping, even for a brief instant, the associative mechanism in a being&rsquo;s head-brain, so that attention may be freed to participate in the sensation of the whole. Nothing is happening in the usual sense, and therefore time does not pass. The result is an enhanced awareness of posture, positioning of visual elements and their inter-relationships. Freezing the frame, rendering objects static, also has the effect of freeing other forms of awareness, such as feeling (motion through emotion).
          </p>
        </div>
      </div>

      <div className="ig-quality">
        <span className="ig-quality-num">III</span>
        <div className="ig-prose">
          <h3>Spaciousness</h3>
          <p>
            We prioritize the viewer&rsquo;s experience, crafting scenes that envelop and engage. Our art establishes a sense of spaciousness that transcends physical boundaries, drawing the viewer into a profound relationship with the work. As the artist strives for communication, scenes are composed for a viewer who is not a voyeur outside the scene but rather a participant who is the reason for the work and necessarily a part of it. Everything in the scene is oriented first and foremost to the viewer, so as to bring the viewer into a relationship with it. Therefore, depth of field is not bounded by the frame: it includes the viewer in a true experience of space. Thus, the art is only completed by viewing.
          </p>
          <p>
            This sense of space is not something filled or measured, but felt—an open stillness that invites presence. The space in the work becomes shared space—between object and observer, stillness and awareness, inside and outside. In this way, the act of viewing is not passive, but collaborative, where meaning unfolds not in the object alone, but in the open field between the viewer and what is seen.
          </p>
        </div>
      </div>

      <hr className="saffron-divider" />

      <h2 className="ig-h2">Three Commitments</h2>
      <div className="ig-commitments">
        <div className="ig-commitment">
          <div className="glyph">✦</div>
          <h3>Inquiry Through Making</h3>
          <p>Creating art as the medium to inquire into our shared human existence. New works are often created in public spaces in response to a proposed inquiry.</p>
        </div>
        <div className="ig-commitment">
          <div className="glyph">✦</div>
          <h3>Sanctuary</h3>
          <p>Providing a place where beauty and inquiry can meet. Resonant works and spaces are included. The collective is committed to using art as the means, not the end.</p>
        </div>
        <div className="ig-commitment">
          <div className="glyph">✦</div>
          <h3>Education &amp; Community</h3>
          <p>Providing education through demonstrations, workshops, and inviting access to our process as it happens. Our works are intended to be experienced, not sold.</p>
        </div>
      </div>

      <hr className="saffron-divider" />

      <h2 className="ig-h2">The Board</h2>
      <p className="ig-lead" style={{ marginBottom: "1.5rem" }}>
        The listed members of the non-profit. Each keeps their own page; they update it themselves, through ArtDirect.
      </p>
      {members.length === 0 ? (
        <p className="text-muted-foreground">No profiles have been published yet.</p>
      ) : (
        <ul className="ig-members">
          {members.map((m) => (
            <li key={m.userId} className="ig-member">
              {m.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="ig-member-photo" src={m.photoUrl} alt="" />
              ) : (
                <span className="ig-member-initials" aria-hidden>{m.displayName.charAt(0)}</span>
              )}
              <p className="ig-member-name"><Link href={`/about/${m.slug}`}>{m.displayName}</Link></p>
              {m.roleTitle && <p className="ig-member-title">{m.roleTitle}</p>}
              {m.bio && <p className="ig-member-bio">{toPlainText(m.bio, 160)}</p>}
            </li>
          ))}
        </ul>
      )}

      <blockquote style={{ margin: "3.5rem auto 0", maxWidth: 700, textAlign: "center", fontFamily: '"Basteleur", serif', fontSize: "1.15rem", lineHeight: 1.9, color: "#063179", border: 0, padding: 0 }}>
        &ldquo;Our works are timeless, essential, reductionist — and often violate scale. We typically explore the vertical dimension of time, which contains the creative act itself, and by orienting everything toward the viewer, bring one into a relationship with it.&rdquo;
        <footer className="ig-kicker" style={{ marginTop: "1.25rem" }}>Toronto · Los Angeles · Paris</footer>
      </blockquote>
    </div>
  );
}
