"use client";

import { useEffect, useMemo, useRef, useState } from "react";

interface FeaturedEvent {
  id: string;
  kind: string;
  title: string;
  authorName: string | null;
  avatarUrl: string | null;
  dateTime: string | null;
  href: string;
}

function initials(name: string | null) {
  if (!name) return "EA";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "EA";
}

function formatDate(value: string | null) {
  if (!value) return "Date TBA";
  return new Intl.DateTimeFormat("en-CA", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function FeaturedEventsTable() {
  const [events, setEvents] = useState<FeaturedEvent[]>([]);
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    fetch("/api/featured-events")
      .then((res) => res.json())
      .then((data) => setEvents(Array.isArray(data.events) ? data.events : []))
      .catch(() => setEvents([]));
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.1 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  const rows = useMemo(() => events, [events]);

  if (rows.length === 0) return null;

  return (
    <section id="featured-events" ref={ref} className="featured-events-section">
      <div className={`section-inner reveal ${visible ? "in-view" : ""}`}>
        <div className="featured-events-header">
          <p className="section-eyebrow">Featured Gatherings</p>
          <h2 className="section-heading">Upcoming Threads</h2>
          <hr className="gold-rule" style={{ "--rule-width": "50px", margin: "1.5rem 0" } as React.CSSProperties} />
        </div>

        <div className="featured-events-table" role="table" aria-label="Featured Inner Gathering meetings and threads">
          <div className="featured-events-row featured-events-head" role="row">
            <span role="columnheader">Profile</span>
            <span role="columnheader">Meeting</span>
            <span role="columnheader">Date + Time</span>
            <span role="columnheader">Link</span>
          </div>

          <div className="featured-events-scroll">
            {rows.map((event) => (
              <a key={event.id} className="featured-events-row featured-events-item" href={event.href} role="row">
                <span className="featured-events-avatar" role="cell" aria-label={event.authorName ?? "Elkdonis Arts"}>
                  {event.avatarUrl ? (
                    <img src={event.avatarUrl} alt="" />
                  ) : (
                    <span>{initials(event.authorName)}</span>
                  )}
                </span>
                <span className="featured-events-title" role="cell">
                  {event.title}
                  <small>{event.kind}</small>
                </span>
                <strong className="featured-events-date" role="cell">{formatDate(event.dateTime)}</strong>
                <span className="featured-events-link" role="cell">View</span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}