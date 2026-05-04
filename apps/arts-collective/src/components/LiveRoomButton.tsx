"use client";

/**
 * LiveRoomButton — Talk room join.
 *
 * Approach B: opens in new tab (no iframe).
 *
 * Note for future — Approach A (inline iframe):
 *   Replace this with <TalkEmbed roomToken={talkToken} /> from
 *   @elkdonis/nextcloud/components. Requires Nextcloud admin panel:
 *   Talk settings → "Allow Talk" embedding + config.php overwrite.cli.url set.
 *   The TalkEmbed component already exists in packages/nextcloud/src/components.
 */

type Props = {
  talkToken: string;
  nextcloudUrl: string;
  isLive: boolean;
  isUserLoggedIn: boolean;
  ssoJoinPath: string; // e.g. /api/talk/join?token=X
  className?: string;
  style?: React.CSSProperties;
  label?: string;
};

export function LiveRoomButton({
  talkToken,
  nextcloudUrl,
  isLive,
  isUserLoggedIn,
  ssoJoinPath,
  className,
  style,
  label,
}: Props) {
  const guestUrl = `${nextcloudUrl.replace(/\/$/, "")}/call/${talkToken}`;
  const defaultLabel = isLive ? "Join live" : "Open room";

  function handleClick() {
    if (isUserLoggedIn) {
      window.open(ssoJoinPath, "_blank", "noopener,noreferrer");
    } else {
      window.open(guestUrl, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={className}
      style={style}
      aria-label={isUserLoggedIn ? "Join as yourself" : "Join as guest"}
    >
      {label ?? defaultLabel}
    </button>
  );
}

export function GuestRoomLink({
  talkToken,
  nextcloudUrl,
  children,
  className,
  style,
}: {
  talkToken: string;
  nextcloudUrl: string;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const guestUrl = `${nextcloudUrl.replace(/\/$/, "")}/call/${talkToken}`;
  return (
    <a
      href={guestUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      style={style}
    >
      {children ?? "Join as guest"}
    </a>
  );
}
