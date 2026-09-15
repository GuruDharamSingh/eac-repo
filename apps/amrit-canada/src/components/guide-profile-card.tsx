"use client";

import { useState, type CSSProperties } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { toPlainText } from "@/lib/format";
import styles from "./guide-profile-card.module.css";

type Tab = "about" | "experience" | "contact";

export interface GuideMilestone {
  year: string;
  title: string;
  description: string;
}

interface GuideProfileCardProps {
  name: string;
  title?: string | null;
  imageUrl?: string | null;
  bio?: string | null;
  /** Real, dated facts only -- see the caller for why this list is short. */
  milestones?: GuideMilestone[];
  contactHref: string;
  contactLabel: string;
  /** Per-card personalization for the portrait's glass-gradient panel. */
  accentLeft?: string;
  accentRight?: string;
}

const TABS: { key: Tab; label: string }[] = [
  { key: "about", label: "About" },
  { key: "experience", label: "Experience" },
  { key: "contact", label: "Contact" },
];

// Matches .card's own gradient base in guide-profile-card.module.css --
// the gradient panel fades into this so it reads as one continuous surface.
const CARD_BASE_COLOR = "#faf0e6";

/**
 * Ported from the tabbed profile-card design the user supplied. The
 * original's Experience and Contact tabs were placeholder job history and a
 * fake address for a demo persona -- there's no equivalent real data for an
 * actual person, so "Experience" holds only dated facts already published in
 * the guide's real bio, and "Contact" points at where people can actually
 * reach this teacher (his class page) rather than a personal email.
 */
export function GuideProfileCard({
  name,
  title,
  imageUrl,
  bio,
  milestones = [],
  contactHref,
  contactLabel,
  accentLeft = "#f4c430",
  accentRight = "#d16b47",
}: GuideProfileCardProps) {
  const [tab, setTab] = useState<Tab>("about");
  const isAbout = tab === "about";

  return (
    <div className={styles.card}>
      <div className={styles.portrait}>
        <div
          className={styles.glow}
          style={
            {
              "--gp-left": accentLeft,
              "--gp-right": accentRight,
              "--gp-base": CARD_BASE_COLOR,
            } as CSSProperties
          }
        >
          {imageUrl && (
            <div
              className={styles.cover}
              style={{ backgroundImage: `url(${imageUrl})` }}
              aria-hidden
            />
          )}
          <div className={styles.glowGradient} aria-hidden />
          <div className={styles.glowGlass} aria-hidden />
        </div>

        <div className={cn(styles.header, isAbout ? styles.headerLarge : styles.headerCompact)} />

        {imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={name}
            className={cn(styles.avatar, isAbout ? styles.avatarLarge : styles.avatarCompact)}
          />
        )}

        <div className={cn(styles.identity, isAbout ? styles.identityLarge : styles.identityCompact)}>
          <h3 className={styles.fullname}>{name}</h3>
          {title && <p className={styles.jobtitle}>{title}</p>}
        </div>
      </div>

      <div className={styles.content}>
        {tab === "about" && (
          <div key="about" className={styles.section}>
            <div className={styles.subtitle}>About</div>
            <p className={styles.desc}>{bio ? toPlainText(bio, 320) : "No bio yet."}</p>
          </div>
        )}

        {tab === "experience" && (
          <div key="experience" className={styles.section}>
            <div className={styles.subtitle}>Experience</div>
            {milestones.length > 0 ? (
              <div className={styles.timeline}>
                {milestones.map((m) => (
                  <div key={m.year + m.title} className={styles.item}>
                    <div className={styles.itemYear}>{m.year}</div>
                    <div className={styles.itemTitle}>{m.title}</div>
                    <p className={styles.itemDesc}>{m.description}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className={styles.desc}>Nothing on record yet.</p>
            )}
          </div>
        )}

        {tab === "contact" && (
          <div key="contact" className={styles.section}>
            <div className={styles.subtitle}>Contact</div>
            <p className={styles.desc}>
              {name.split(" ")[0]} teaches in person -- the best way to connect is at a session.
            </p>
            <Link href={contactHref} className={styles.cta}>
              {contactLabel}
            </Link>
          </div>
        )}
      </div>

      <div className={styles.tabs}>
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(styles.tab, tab === t.key && styles.tabActive)}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
