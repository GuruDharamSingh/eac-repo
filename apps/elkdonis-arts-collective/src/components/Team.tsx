"use client";

import { useEffect, useRef, useState } from "react";
import { User, ChevronDown } from "lucide-react";

interface TeamMember {
  name: string;
  title: string;
  role: string;
  bio: string;
}

const teamMembers: TeamMember[] = [
  {
    name: "Jason",
    title: "Founder",
    role: "Director of Operations",
    bio: "Artist , Acupuncturist/ medical Qi gong practitioner, Jason Ford has been leading conscious creatives groups, Corporate and church team building safaris and leadership skills training labs since 1990. Jason has been trained in traditional healing and initiations, fourth way practices, visual arts, sculpture arts, performance arts, and paratheatre.He is currently retired from the Foundation for the Study of Objective Art, where he worked in their Galleries Arcturus and City Art.",
  },
  {
    name: "Steph",
    title: "Director of I.T. and Security",
    role: "Technical Infrastructure",
    bio: "From an early age, Steph felt a sense that something was missing. What he now recognizes as a deep longing for the divine. In his teens, he explored cannabis and psychedelics, which opened him up to different possibilities and states of consciousness. Around 20, he discovered Carlos Castaneda’s books and wanted to explore shamanism. However, due to his aphantasia, he shifted focus to Gurdjieff’s Fourth Way teachings. Over the years, he has also studied a variety of other traditions including Tantra, Taoist inner alchemy, and Zen. Recently, he’s been focusing more on Kundalini Yoga and subtle energies. Now, Steph is moving into helping others come to the teachings and practice. With a focus on Kundalini and a bit of basic Inner Alchemy Qigong. He is also offering a Fourth Way group reading of Beelzebub’s Tales to his Grandson.",
  },
  {
    name: "Dana",
    title: "Co-Founder",
    role: "Artist / Writer in Residence",
    bio: "I’m an interdisciplinary artist, designer, and writer whose work opens gateways into the inner and higher dimensions of the Self. Through symbolism and harmonious use of colour, I explore themes of presence, perception, and the human condition, aiming to capture the eternal moment in visual and poetic form. My creative practice is deeply informed by experiential research in energy medicine, meditation, trance mediumship, parapsychology, and both Eastern and Western esoteric traditions. I’m particularly inspired by the legacy work of G.I. Gurdjieff and the possibilities of inner transformation through creative inquiry. At the moment, I am especially interested in folk art and craft movements and related traditions A graduate of OCAD University, I also bring a background in religious studies and social sciences to my work. This interdisciplinary approach helps me integrate the intuitive with the intellectual—bridging the seen and unseen in ways that invite reflection, connection, and a sense of wonder..",
  },
  {
    name: "Guru Dharam",
    title: "Projects Manager",
    role: "Director of Web Development",
    bio: "Guru Dharam Singh is the name given to me by my teacher, along with the challange to actually use it. During my second year at U of T I met my teacher the Sikh Chaplain there and attended his Kundalini Yoga Classes. From an early age I felt witnessed by a Sacred or Divine force, and with subsequent exposure to Western Astrology, and then Yung Drung Bon, I came to realize that I wasnt “crazy” for feeling seen. I’m looking forward to applying organizational skill and consistency to expand the access to this teaching and other practices, particular in the manner of the fourth way.",
  },
  {
    name: "Aeon",
    title: "Executive Producer",
    role: "Music & Video Director, Artist / Writer in Residence",
    bio: "From early on, there has always been this sense that there is a certain kind of information behind normal everyday perceptions – from the firmly imposed boundaries around what the education system discusses to what a human being even is. The mission then became clear – to follow the threads of experience until valuable insights are uncovered. Conscience, self-honesty, and curiosity led the way to the depths of the poetic and musical states which uncover the underbelly of human experience… In tandem to the artistic endeavors, there was a calling toward deeper spiritual work, something that peers through the human condition and confronts the soul without compromise. After years of self-study, I became introduced to some of the members of the Elkdonis Arts Collective and joined forces.",
  },
  {
    name: "Sarah",
    title: "Director of Public Relations",
    role: "Community Outreach",
    bio: "I was involved in the 90s indie punk scene in Toronto and then spent fourteen years working in shelters and drop-in centres in Toronto and the surrounding area. Writing has appeared in Exclaim!, IASPM Automusicologies, and Bunch Family.  I am comfortable interacting with people from all walks of life. I have taken college-level courses in public relations, marketing, advertising, copywriting and SEO. I also work as a supply Educational Assistant and Administrative Assistant for the Waterloo Catholic and Public School Boards.  I hold a BA in social and developmental psychology and an additional BA in Fine Arts Cultural Studies. I worked in frontline social services and then, during the pandemic, I became a music reviewer for Exclaim! This led me to my current role as an organizing member of the new online music journal New Feeling. My main role in New Feeling is as a member of the editorial committee where I generate and review pitches and provide both structural and copy edits. We partner with The Grind to provide their music coverage as well. Since New Feeling is a small collective, I also participate in events and membership drives to broaden our organization’s reach and scope. One connecting thread between all the different types of work that I have done is that community is at the forefront. I am honoured and excited to be involved in building a community where we all achieve spiritual development. Working in creative and social justice pursuits will intertwine with this journey. ",
  },
];

export function Team() {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.1 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section id="team" ref={sectionRef} className="team-section">
      <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "0 1.5rem" }}>

        {/* Section header */}
        <div
          className={`reveal ${isVisible ? "in-view" : ""}`}
          style={{ textAlign: "center", marginBottom: "4rem" }}
        >
          <p className="section-eyebrow">The Collective</p>
          <h2 className="section-heading">Our Members</h2>
          <hr
            className="gold-rule"
            style={{ "--rule-width": "60px" } as React.CSSProperties}
          />
          <p
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "0.9375rem",
              color: "#6b7280",
              lineHeight: 1.7,
              maxWidth: "540px",
              margin: "1.5rem auto 0",
            }}
          >
            We are all students, and teach in the understanding that we are all
            beginners here. Select a member to learn more about their role.
          </p>
        </div>

        {/* 6-card grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 300px), 1fr))",
            gap: "1.25rem",
          }}
        >
          {teamMembers.map((member, index) => (
            <details
              key={member.name}
              className={`member-card ${
                isVisible ? `animate-scale-in delay-${(index + 2) * 100}` : "opacity-0"
              }`}
            >
              <summary>
                {/* Avatar area */}
                <div className="member-avatar-area">
                  <div className="member-avatar" aria-hidden="true">
                    <User size={44} color="#c9a962" strokeWidth={1} />
                  </div>
                  <div className="member-ring member-ring-1" aria-hidden="true" />
                  <div className="member-ring member-ring-2" aria-hidden="true" />
                </div>

                {/* Info */}
                <div className="member-info">
                  <p className="member-name">{member.name}</p>
                  <p className="member-title">{member.title}</p>
                  <p className="member-role">{member.role}</p>
                  <div className="member-chevron" aria-hidden="true">
                    <ChevronDown size={18} />
                  </div>
                </div>
              </summary>

              {/* Bio — max-height animated via CSS */}
              <div className="member-bio-wrap">
                <p>{member.bio}</p>
              </div>
            </details>
          ))}
        </div>

      </div>
    </section>
  );
}
