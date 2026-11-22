"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ArchFrame, CatalogueRow, Chip, ChipRow } from "@/components/mobile";
import type { MobileFeedRow, MobilePlaceRow } from "./types";

// Interactive halves of m-places-catalogue and m-feed-list (G5/G6). The data is locked (resolver); the words are the owner's.

const txt = (v: ReactNode, fallback: string) => (typeof v === "string" && v ? v : fallback);

export function PlacesCatalogueView(p: {
  chipAll?: ReactNode;
  chipFavourites?: ReactNode;
  favouriteText?: ReactNode;
  emptyText?: ReactNode;
  rows?: MobilePlaceRow[] | null;
  tags?: { tag: string; count: number }[] | null;
  favouriteCount?: number | null;
}) {
  const [filter, setFilter] = useState("all");
  const rows = p.rows ?? [];
  const tags = p.tags ?? [];
  const shown = useMemo(
    () => rows.filter((r) => (filter === "all" ? true : filter === "fav" ? r.favourite : r.tags.includes(filter))),
    [rows, filter]
  );
  return (
    <section className="blk blk-mpc">
      <ChipRow>
        <Chip selected={filter === "all"} onClick={() => setFilter("all")}>
          <span className="blk-mpc-chip-all">{p.chipAll}</span>
        </Chip>
        {(p.favouriteCount ?? 0) > 0 && (
          <Chip selected={filter === "fav"} onClick={() => setFilter("fav")}>
            <span className="blk-mpc-chip-fav">{p.chipFavourites}</span>
          </Chip>
        )}
        {tags.map((t) => (
          <Chip key={t.tag} selected={filter === t.tag} onClick={() => setFilter(t.tag)}>
            {t.tag}
          </Chip>
        ))}
      </ChipRow>
      <div className="blk-mpc-list">
        {shown.map((r) => (
          <div key={r.id} className="blk-mpc-row">
            <CatalogueRow
              href={`/places?place=${r.slug}`}
              thumb={<ArchFrame w={52} h={64} bottom={10} src={r.img} />}
              kicker={[r.kind, r.area].filter(Boolean).join(" · ")}
              title={r.name}
              meta={[r.tags.join(" · "), r.favourite ? txt(p.favouriteText, "A guide favourite") : ""].filter(Boolean).join(" · ")}
            />
          </div>
        ))}
        {shown.length === 0 && <p className="blk-mpc-empty">{p.emptyText}</p>}
      </div>
    </section>
  );
}

export function FeedListView(p: {
  postLabel?: ReactNode;
  linkLabel?: ReactNode;
  commentsWord?: ReactNode;
  emptyText?: ReactNode;
  rows?: MobileFeedRow[] | null;
}) {
  const rows = p.rows ?? [];
  return (
    <section className="blk blk-mfl">
      {rows.map((r) => (
        <div key={r.id} className="blk-mfl-row">
          <CatalogueRow
            href={`/feed?post=${r.id}`}
            thumb={
              <ArchFrame w={52} h={60} bottom={10}>
                <span className="blk-mfl-initial">{r.initial}</span>
              </ArchFrame>
            }
            kicker={r.kind === "link" ? `${txt(p.linkLabel, "Link")}${r.host ? ` · ${r.host}` : ""}` : txt(p.postLabel, "Post")}
            title={r.title}
            meta={`${r.author} · ${r.whenLabel}${r.replyCount ? ` · ${r.replyCount} ${txt(p.commentsWord, "comments")}` : ""}`}
          />
        </div>
      ))}
      {rows.length === 0 && <p className="blk-mfl-empty">{p.emptyText}</p>}
    </section>
  );
}
