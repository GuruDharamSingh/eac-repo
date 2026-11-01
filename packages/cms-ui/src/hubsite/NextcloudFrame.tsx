"use client";

import * as React from "react";

// ============================================================================
// A Nextcloud page (Talk room, Files, a document share) framed on a hub page,
// with a bar under it for signing in.
//
// Framing works only from a host Nextcloud's `eac_embed` app lists in
// `frame_ancestors` (2026-10-08: https://elkdonis-arts.org), and the person is
// themselves inside the frame only when the parent is same-site with the cloud
// (elkdonis-arts.org ↔ cloud.elkdonis-arts.org): Nextcloud's cookies are
// SameSite=Lax. Someone without a Nextcloud session sees Talk as a guest who
// is asked for a name, and Files as a login page.
//
// "Sign in to Nextcloud" opens the network sign-in (sociallogin → this
// network's OIDC provider) in a new tab, where a top-level page can set the
// cookies; when this tab regains focus the frame reloads and picks them up.
// The first sign-in also creates the person's Nextcloud account.
// ============================================================================

export interface NextcloudFrameProps {
  src: string;
  /** The iframe's accessible title. */
  title: string;
  /** Nextcloud's "Log in with Elkdonis" entry. No URL, no sign-in button. */
  signInUrl?: string | null;
  /** The person has a Nextcloud account already (users.nextcloud_user_id). */
  linked?: boolean;
  /** CSS height of the frame. Default 70vh. */
  height?: string;
  /** Extra `allow` features — Talk needs camera and microphone. */
  allow?: string;
  /** Text for the sign-in bar; defaults suit Talk and Files alike. */
  note?: React.ReactNode;
}

export function NextcloudFrame({
  src,
  title,
  signInUrl,
  linked,
  height = "70vh",
  allow,
  note,
}: NextcloudFrameProps) {
  const frame = React.useRef<HTMLIFrameElement>(null);
  const [awaitingSignIn, setAwaitingSignIn] = React.useState(false);

  const reload = React.useCallback(() => {
    const el = frame.current;
    if (!el) return;
    // Reassigning src reloads cross-origin frames; contentWindow.location
    // is not ours to touch.
    el.src = src;
  }, [src]);

  React.useEffect(() => {
    if (!awaitingSignIn) return;
    const onFocus = () => {
      setAwaitingSignIn(false);
      reload();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [awaitingSignIn, reload]);

  return (
    <div className="eac-nc">
      <iframe
        ref={frame}
        className="eac-nc-frame"
        src={src}
        title={title}
        style={{ height }}
        allow={allow}
        allowFullScreen
      />
      <div className="eac-nc-bar">
        <p className="eac-nc-note">
          {note ??
            (linked
              ? "If the frame asks you to log in, sign in to Nextcloud once and it will remember you."
              : "Have a Nextcloud account? Sign in to it and the frame will show you by name. Without one you can still take part as a guest.")}
        </p>
        <div className="eac-nc-actions">
          {signInUrl ? (
            <a
              className="eac-nc-btn eac-nc-btn--primary"
              href={signInUrl}
              target="_blank"
              rel="noopener"
              onClick={() => setAwaitingSignIn(true)}
            >
              Sign in to Nextcloud
            </a>
          ) : null}
          <button type="button" className="eac-nc-btn" onClick={reload}>
            Reload
          </button>
          <a className="eac-nc-btn" href={src} target="_blank" rel="noopener">
            Open in Nextcloud ↗
          </a>
        </div>
      </div>
    </div>
  );
}
