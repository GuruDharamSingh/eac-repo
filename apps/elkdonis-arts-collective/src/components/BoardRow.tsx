"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

interface Member {
  name: string;
  title: string;
  role: string;
  photo?: string;
  initials: string;
}

const members: Member[] = [
  {
    name: "Jason Ford",
    title: "Founder",
    role: "Director of Operations",
    initials: "JF",
  },
  {
    name: "Steph",
    title: "Director of I.T. & Security",
    role: "Technical Infrastructure",
    photo: "/steph-1.jpg",
    initials: "S",
  },
  {
    name: "Dana McCool",
    title: "Co-Founder",
    role: "Artist / Writer in Residence",
    photo: "/danamccool.jpg",
    initials: "DM",
  },
  {
    name: "Guru Dharam",
    title: "Projects Manager",
    role: "Director of Web Development",
    photo: "/GD-Full-for-Lotus-edited.jpg",
    initials: "GD",
  },
  {
    name: "Aeon",
    title: "Executive Producer",
    role: "Music & Video Director",
    photo: "/fnordbalance-1.jpg",
    initials: "A",
  },
  {
    name: "Sarah",
    title: "Director of Public Relations",
    role: "Community Outreach",
    initials: "S",
  },
];

export function BoardRow() {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setVisible(true); },
      { threshold: 0.08 }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return (
    <section id="board" ref={ref} className="board-section">
      <div className="section-inner">
        <div className={`reveal ${visible ? "in-view" : ""}`} style={{ textAlign: "center", marginBottom: "3rem" }}>
          <p className="section-eyebrow">Board of Directors</p>
          <h2 className="section-heading">The Team</h2>
          <hr className="gold-rule" style={{ "--rule-width": "50px" } as React.CSSProperties} />
        </div>

        <ul
          className={`reveal ${visible ? "in-view" : ""}`}
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "grid",
            gridTemplateColumns: "repeat(6, 1fr)",
            gap: "1rem",
            transitionDelay: "0.1s",
          }}
        >
          {members.map((m, i) => (
            <li
              key={m.name}
              className="board-card"
              style={{ animationDelay: `${i * 0.07}s` }}
            >
              {/* Avatar */}
              <div className="board-avatar">
                {m.photo ? (
                  <Image
                    src={m.photo}
                    alt={m.name}
                    fill
                    sizes="(max-width: 768px) 40vw, 200px"
                    style={{ objectFit: "cover", objectPosition: "top" }}
                  />
                ) : (
                  <span className="board-initials">{m.initials}</span>
                )}
                <div className="board-avatar-overlay" aria-hidden="true" />
              </div>

              {/* Info */}
              <div className="board-info">
                <p className="board-name">{m.name}</p>
                <p className="board-title">{m.title}</p>
                <p className="board-role">{m.role}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
