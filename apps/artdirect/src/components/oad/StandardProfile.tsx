import type { Profile } from "@elkdonis/services";
import type { StoreShowcase as StoreShowcaseData } from "@elkdonis/commerce/queries";
import { StoreShowcase } from "@elkdonis/commerce/components";
import { ProfileView } from "@elkdonis/cms-ui/profile";
import { ProfileEditorPanel } from "./ProfileEditorPanel";
import { GalleryPanel } from "./GalleryPanel";

/**
 * ArtDirect's adapter over the shared ProfileView.
 *
 * The page itself now lives in @elkdonis/cms-ui so arts-collective can render
 * the same profile once the directory is folded in. Everything app-specific
 * stays here: mapping @elkdonis/services' Profile onto ProfileView's narrow
 * prop shape, and supplying the two interactive panels, which are bound to
 * ArtDirect's own server actions (see lib/profile-editor-actions) and cannot
 * be shared as-is.
 *
 * `isSelf` gates the inline editor. The gallery renders either way —
 * ProfileGallery already degrades to a plain read-only grid — except when a
 * visitor would be shown an empty one, which is just noise.
 */
export function StandardProfile({
  profile,
  isSelf = false,
  store = null,
  hasStore = false,
  storeSectionOn = false,
  marketplaceUrl,
}: {
  profile: Profile;
  isSelf?: boolean;
  /**
   * The person's marketplace store with its listed work — rendered only when
   * they have switched the "store" section on (users.profile_sections). The
   * store is a front for this profile (its name and photo come from here),
   * so the profile is where a visitor learns the work is for sale.
   */
  store?: StoreShowcaseData | null;
  /** Whether they have an active store at all (drives the owner's toggle). */
  hasStore?: boolean;
  storeSectionOn?: boolean;
  marketplaceUrl: string;
}) {
  const key = profile.slug ?? profile.userId;

  const galleryItems = profile.portfolio.map((item, i) => ({
    id: item.id ?? `${key}-${i}`,
    url: item.url,
    title: item.title,
    x: item.x,
    y: item.y,
    w: item.w,
    h: item.h,
  }));

  const showGallery = galleryItems.length > 0 || isSelf;

  return (
    <ProfileView
      person={{
        displayName: profile.displayName,
        headline: profile.headline,
        bio: profile.bio,
        avatarUrl: profile.avatarUrl,
        pronouns: profile.pronouns,
        city: profile.city,
        verified: profile.verified,
        portfolioUrl: profile.portfolioUrl,
        socialLinks: profile.socialLinks,
      }}
      isSelf={isSelf}
      editor={
        <ProfileEditorPanel
          profileUserId={profile.userId}
          slug={key}
          bio={profile.bio ?? ""}
          avatarUrl={profile.avatarUrl ?? ""}
          hasStore={hasStore}
          storeSectionOn={storeSectionOn}
          marketplaceUrl={marketplaceUrl}
        />
      }
      gallery={
        showGallery ? (
          <GalleryPanel
            profileUserId={profile.userId}
            slug={key}
            items={galleryItems}
            editable={isSelf}
          />
        ) : undefined
      }
    >
      {store && (
        <StoreShowcase
          store={store.store}
          artworks={store.artworks}
          marketplaceUrl={marketplaceUrl}
          from="artdirect"
          className="eac-profile-store"
        />
      )}
    </ProfileView>
  );
}
