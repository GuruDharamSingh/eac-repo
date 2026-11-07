import * as React from "react";
import type { ExperiencePersonView } from "./types";

/** Initials for a person without an avatar. */
function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "?";
}

export function PersonAvatar({ person, size = 28 }: { person: Pick<ExperiencePersonView, "name" | "avatarUrl">; size?: number }) {
  const style = { width: size, height: size };
  if (person.avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={person.avatarUrl} alt="" style={style} className="shrink-0 rounded-full border border-border object-cover" />;
  }
  return (
    <span style={{ ...style, fontSize: Math.max(10, size * 0.38) }} className="inline-flex shrink-0 items-center justify-center rounded-full border border-border bg-muted font-mono text-muted-foreground" aria-hidden>
      {initials(person.name)}
    </span>
  );
}

/**
 * A compact "with <artist>" line for cards: avatars and names only, no links
 * (the whole card is one link; nested anchors are invalid).
 */
export function ArtistChip({ people }: { people: ExperiencePersonView[] }) {
  const artists = people.filter((p) => p.role === "artist");
  const shown = artists.length > 0 ? artists : people.filter((p) => p.role === "host");
  if (shown.length === 0) return null;
  const names = shown.slice(0, 2).map((p) => p.name).join(" & ") + (shown.length > 2 ? ` +${shown.length - 2}` : "");
  return (
    <span className="inline-flex min-w-0 items-center gap-2 text-sm">
      <span className="flex -space-x-2">
        {shown.slice(0, 3).map((p) => <PersonAvatar key={p.userId} person={p} size={24} />)}
      </span>
      <span className="truncate">
        <span className="text-muted-foreground">with </span>
        {names}
      </span>
    </span>
  );
}

/** The full people list for the detail page and popup: artists first, then hosts, each with its profile link. */
export function PeopleList({ people, heading = true }: { people: ExperiencePersonView[]; heading?: boolean }) {
  const groups: { role: ExperiencePersonView["role"]; label: string }[] = [
    { role: "artist", label: people.filter((p) => p.role === "artist").length > 1 ? "Artists" : "Artist" },
    { role: "host", label: people.filter((p) => p.role === "host").length > 1 ? "Hosts" : "Host" },
  ];
  return (
    <div className="space-y-6">
      {groups.map((g) => {
        const list = people.filter((p) => p.role === g.role);
        if (list.length === 0) return null;
        return (
          <section key={g.role}>
            {heading && <h2 className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">{g.label}</h2>}
            <ul className="mt-3 space-y-3">
              {list.map((p) => (
                <li key={`${p.role}-${p.userId}`} className="flex items-center gap-3">
                  <PersonAvatar person={p} size={44} />
                  <div className="min-w-0">
                    <p className="font-serif text-lg leading-tight">{p.name}</p>
                    <p className="flex flex-wrap gap-x-4 text-sm">
                      {p.profileUrl && (
                        <a href={p.profileUrl} target="_blank" rel="noopener" className="underline underline-offset-4">
                          {p.role === "artist" ? "Artist profile" : "Profile"} ↗
                        </a>
                      )}
                      {p.serviceUrl && (
                        <a href={p.serviceUrl} target="_blank" rel="noopener" className="underline underline-offset-4">
                          Their offering on ArtDirect ↗
                        </a>
                      )}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
