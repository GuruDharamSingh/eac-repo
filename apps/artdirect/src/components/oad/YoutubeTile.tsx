"use client";

import * as React from "react";
import styles from "./SocialSections.module.css";

/**
 * A video on the person's page: the thumbnail until clicked, then the
 * privacy-enhanced embed (youtube-nocookie.com), so nothing is loaded from
 * YouTube's player before a visitor asks for it.
 */
export function YoutubeTile({ id, title, thumbnailUrl }: { id: string; title: string; thumbnailUrl: string }) {
  const [playing, setPlaying] = React.useState(false);
  return (
    <figure className={styles.video}>
      <div className={styles.frame}>
        {playing ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
            title={title}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
          />
        ) : (
          <button type="button" className={styles.play} onClick={() => setPlaying(true)} aria-label={`Play: ${title}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={thumbnailUrl} alt="" loading="lazy" />
            <span className={styles.playMark} aria-hidden>
              ▶
            </span>
          </button>
        )}
      </div>
      <figcaption>
        <a href={`https://www.youtube.com/watch?v=${id}`} target="_blank" rel="noopener noreferrer">
          {title}
        </a>
      </figcaption>
    </figure>
  );
}
