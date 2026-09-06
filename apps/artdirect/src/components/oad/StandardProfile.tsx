import type { Profile } from "@elkdonis/services";
import { ProfileEditorPanel } from "./ProfileEditorPanel";
import { GalleryPanel } from "./GalleryPanel";

/**
 * The plain alternative to the dossier template.
 *
 * Uses CSS custom properties rather than fixed colours so a person's own
 * palette (users.theme, injected by ThemeStyle) actually reaches it — the
 * dossier template ships its own hard-coded look, which is precisely why some
 * artists will want this instead.
 *
 * `isSelf` gates the inline editor (bio + avatar via ProfileEditorPanel, the
 * portfolio grid via GalleryPanel with editable=true) — mirrors the pattern
 * built for apps/ifac's /artists/[slug]. GalleryPanel/ProfileGallery renders
 * unconditionally either way (editable=false for visitors), since it already
 * degrades to a plain read-only grid with no second code path needed.
 */
export function StandardProfile({ profile, isSelf = false }: { profile: Profile; isSelf?: boolean }) {
  const paragraphs = (profile.bio ?? "")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const galleryItems = profile.portfolio.map((item, i) => ({
    id: item.id ?? `${profile.slug ?? profile.userId}-${i}`,
    url: item.url,
    title: item.title,
    x: item.x,
    y: item.y,
    w: item.w,
    h: item.h,
  }));

  return (
    <article className="oad-standard">
      <header className="oad-standard-head">
        {profile.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="oad-standard-portrait" src={profile.avatarUrl} alt="" />
        ) : (
          <div className="oad-standard-portrait oad-standard-portrait--empty" aria-hidden>
            {profile.displayName.charAt(0).toUpperCase()}
          </div>
        )}

        <div className="oad-standard-id">
          <h1>{profile.displayName}</h1>
          {profile.headline && <p className="oad-standard-headline">{profile.headline}</p>}
          <p className="oad-standard-meta">
            {[profile.pronouns, profile.city].filter(Boolean).join(" · ")}
            {profile.verified && <span className="oad-standard-verified">Verified</span>}
          </p>
        </div>
      </header>

      {isSelf && (
        <ProfileEditorPanel
          profileUserId={profile.userId}
          slug={profile.slug ?? profile.userId}
          bio={profile.bio ?? ""}
          avatarUrl={profile.avatarUrl ?? ""}
        />
      )}

      {(paragraphs.length > 0 || isSelf) && (
        <section className="oad-standard-bio" data-trait="bio">
          {paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </section>
      )}

      {(galleryItems.length > 0 || isSelf) && (
        <section className="oad-standard-work">
          <h2>Work</h2>
          <GalleryPanel
            profileUserId={profile.userId}
            slug={profile.slug ?? profile.userId}
            items={galleryItems}
            editable={isSelf}
          />
        </section>
      )}

      {(profile.socialLinks.length > 0 || profile.portfolioUrl) && (
        <section className="oad-standard-links">
          <h2>Elsewhere</h2>
          <ul>
            {profile.portfolioUrl && (
              <li>
                <a href={profile.portfolioUrl} target="_blank" rel="noreferrer">
                  Portfolio
                </a>
              </li>
            )}
            {profile.socialLinks.map((l) => (
              <li key={l.url}>
                <a href={l.url} target="_blank" rel="noreferrer">
                  {l.label || l.url}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
