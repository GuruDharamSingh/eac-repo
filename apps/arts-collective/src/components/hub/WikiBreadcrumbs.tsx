import Link from "next/link";
import type { WikiPageRef } from "@elkdonis/services";

export function WikiBreadcrumbs({
  ancestors,
  current,
}: {
  ancestors: WikiPageRef[];
  current: string;
}) {
  return (
    <nav className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
      <Link href="/hub/wiki" className="hover:text-foreground hover:underline">
        Wiki
      </Link>
      {ancestors.map((a) => (
        <span key={a.id} className="flex items-center gap-1">
          <span aria-hidden>/</span>
          <Link
            href={`/hub/wiki/${a.slug}`}
            className="hover:text-foreground hover:underline"
          >
            {a.title}
          </Link>
        </span>
      ))}
      <span aria-hidden>/</span>
      <span className="text-foreground">{current}</span>
    </nav>
  );
}
