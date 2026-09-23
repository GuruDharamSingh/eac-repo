import Link from "next/link";
import { cn } from "@/lib/utils";
import { toPlainText } from "@/lib/format";

export interface ProfileCardLink {
  label: string;
  url: string;
  /** Renders in the accent treatment rather than the quiet one. */
  emphasis?: boolean;
}

interface ProfileCardProps {
  name: string;
  title?: string | null;
  imageUrl?: string | null;
  bio?: string | null;
  href?: string | null;
  linkLabel?: string;
  /**
   * Where else he is, shown in the SAME row as "Read more".
   *
   * These had their own "Elsewhere" card under this one until 2026-09-19. A
   * second bordered box holding two buttons was more frame than content, and
   * it separated his links from him — they belong beside the other thing you
   * can do with his profile, not in a container of their own.
   */
  links?: ProfileCardLink[];
  className?: string;
}

/**
 * The profile card: a photograph across the top, the words underneath.
 *
 * Replaces the vendored `guide-profile-card`, which came from amrit-canada and
 * put the portrait in a 50%-radius circle with a tabbed About/Experience/
 * Contact strip. Two things were wrong with it here: the owner asked for the
 * full image rather than a crop in a circle, and two of the three tabs had
 * nothing to show — an "Experience" tab that is permanently empty is a
 * promise the page cannot keep.
 *
 * The image is `aspect-[4/3] object-cover`, NOT a fixed pixel height: the
 * photograph is arbitrary (his rock-balancing shots are portrait, a banner
 * might be landscape) and a fixed height would letterbox one or crop the head
 * off the other. A ratio box crops consistently from the centre and keeps the
 * card the same shape whatever it is given.
 *
 * Square, like everything else on this site.
 */
export function ProfileCard({
  name,
  title,
  imageUrl,
  bio,
  href,
  linkLabel = "Read more",
  links = [],
  className,
}: ProfileCardProps) {
  // The bio may arrive as rich text from the composer; the card wants a
  // paragraph, not markup.
  const text = bio ? toPlainText(bio) : null;

  return (
    <article className={cn("card-natural overflow-hidden", className)}>
      {imageUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={imageUrl}
          alt={name}
          className="block aspect-[4/3] w-full object-cover"
          loading="lazy"
        />
      ) : (
        <div
          className="flex aspect-[4/3] w-full items-center justify-center bg-muted text-sm text-muted-foreground"
          aria-hidden
        >
          No photograph yet
        </div>
      )}

      <div className="p-6">
        <h3 className="font-serif text-xl font-semibold leading-tight">{name}</h3>
        {title && (
          <p className="mt-1 text-xs font-medium uppercase tracking-[0.14em] text-[hsl(var(--rust))]">
            {title}
          </p>
        )}
        {text && <p className="mt-4 leading-relaxed text-muted-foreground">{text}</p>}
        {(href || links.length > 0) && (
          <div className="mt-5 flex flex-wrap items-center gap-2">
            {href && (
              <Link
                href={href}
                className="border border-[hsl(var(--primary))]/50 bg-[hsl(var(--primary))]/10 px-4 py-2 text-sm font-medium text-[hsl(var(--primary))] transition-colors hover:bg-[hsl(var(--primary))]/20"
              >
                {linkLabel}
              </Link>
            )}
            {links.map((l) => (
              <a
                key={l.url}
                href={l.url}
                target="_blank"
                // `rel="me"` only on his OWN accounts — it is an identity
                // claim, and the collective is not one of his profiles.
                rel={l.emphasis ? "noreferrer" : "me noreferrer"}
                className={
                  l.emphasis
                    ? "border border-[hsl(var(--primary))]/50 bg-[hsl(var(--primary))]/10 px-4 py-2 text-sm font-medium text-[hsl(var(--primary))] transition-colors hover:bg-[hsl(var(--primary))]/20"
                    : "border border-border bg-background px-4 py-2 text-sm text-foreground transition-colors hover:border-[hsl(var(--primary))] hover:text-[hsl(var(--primary))]"
                }
              >
                {l.label}
              </a>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
