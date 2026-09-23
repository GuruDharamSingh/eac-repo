"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";

export interface ShelfVideo {
  id: string;
  title: string;
}

/**
 * The home page's videos: one player, and a strip of smaller thumbnails under
 * it that scrolls sideways (owner, 2026-09-23: "a smaller grid that can be
 * scrollable"). The strip has large arrow buttons as well as touch scrolling,
 * because a sideways scroll with only a trackpad gesture is easy to miss.
 *
 * The player is not loaded until someone presses play: a YouTube iframe costs
 * about a megabyte of script, and the home page used to pay that twice on
 * load for two videos most visitors never started.
 */
export function VideoShelf({ videos }: { videos: ShelfVideo[] }) {
  const [current, setCurrent] = React.useState(0);
  const [playing, setPlaying] = React.useState(false);
  const stripRef = React.useRef<HTMLUListElement>(null);
  if (videos.length === 0) return null;
  const video = videos[Math.min(current, videos.length - 1)];

  function scroll(direction: 1 | -1) {
    const strip = stripRef.current;
    if (!strip) return;
    strip.scrollBy({ left: direction * strip.clientWidth * 0.8, behavior: "smooth" });
  }

  return (
    <div className="video-shelf">
      <div className="video-shelf__player">
        {playing ? (
          <iframe
            key={video.id}
            src={`https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1&rel=0`}
            title={video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <button type="button" className="video-shelf__poster" onClick={() => setPlaying(true)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`} alt="" />
            <span className="video-shelf__play" aria-hidden>
              <Play />
            </span>
            <span className="video-shelf__caption">
              <span className="sr-only">Play: </span>
              {video.title}
            </span>
          </button>
        )}
      </div>

      {videos.length > 1 && (
        <div className="video-shelf__strip-wrap">
          <button type="button" className="video-shelf__arrow" onClick={() => scroll(-1)} aria-label="Earlier videos">
            <ChevronLeft aria-hidden />
          </button>
          <ul className="video-shelf__strip" ref={stripRef}>
            {videos.map((v, i) => (
              <li key={v.id}>
                <button
                  type="button"
                  className={`video-shelf__thumb${i === current ? " is-current" : ""}`}
                  aria-current={i === current ? "true" : undefined}
                  onClick={() => {
                    setCurrent(i);
                    setPlaying(true);
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`} alt="" loading="lazy" />
                  <span className="video-shelf__thumb-title">{v.title}</span>
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="video-shelf__arrow" onClick={() => scroll(1)} aria-label="More videos">
            <ChevronRight aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}
