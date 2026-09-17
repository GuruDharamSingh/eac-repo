import { siteConfig } from "@/config/site";

/**
 * The window dressing: two velvet curtains at the edges of the viewport, each
 * with a slim ornamental column inboard of it.
 *
 * Fixed rather than laid out, so they hang still while the page scrolls past
 * — and so a full-bleed band can simply cover them. Purely decorative, hence
 * aria-hidden: a screen reader gains nothing from the word "curtain".
 *
 * Both pairs are hidden by CSS below 1180px (the slim columns below 1440px).
 * They are always in the DOM so there is no hydration mismatch between a
 * server that cannot know the viewport and a client that can.
 */
export function Curtains() {
  return (
    <div className="curtains" aria-hidden="true">
      <div className="curtain curtain--left" />
      <div className="curtain curtain--right" />
      <div className="slim slim--left">
        <span className="slim__word">{siteConfig.orgName}</span>
      </div>
      <div className="slim slim--right">
        <span className="slim__word">Read aloud · {new Date().getFullYear()}</span>
      </div>
    </div>
  );
}
