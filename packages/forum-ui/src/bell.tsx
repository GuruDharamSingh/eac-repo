import * as React from "react";
import type { ForumNotification } from "@elkdonis/services";
import type { ForumHrefs } from "./connectors";
import { NotificationLine } from "./pages";

/**
 * The masthead bell (decision 13): a <details> dropdown of the latest
 * notifications with a mark-all-read form. The host fetches the items —
 * it owns the session — and renders this next to the viewer's name.
 */
export function NotificationsBell({ items, unread, hrefs, actionBase, back }: {
  items: ForumNotification[]; unread: number; hrefs: ForumHrefs; actionBase: string; back: string;
}) {
  const all = `${hrefs.root().replace(/\/$/, "")}/notifications`;
  return (
    <details className="gf-bell">
      <summary aria-label={`Notifications, ${unread} unread`}>
        <span aria-hidden>🔔</span>
        {unread > 0 && <span className="gf-bell-count">{unread > 99 ? "99+" : unread}</span>}
      </summary>
      <div className="gf-bell-menu">
        <div className="gf-bell-head">
          <span>Notifications</span>
          {unread > 0 && (
            <form method="post" action={`${actionBase.replace(/\/$/, "")}/notifications-read`}>
              <input type="hidden" name="back" value={back} />
              <button type="submit" className="gf-tool">Mark all read</button>
            </form>
          )}
        </div>
        {items.length === 0 ? (
          <p className="gf-rail-empty" style={{ padding: "12px" }}>Nothing yet.</p>
        ) : (
          <ol className="gf-notifs">
            {items.map((n) => <li key={n.id} className={`gf-notif${n.readAt ? "" : " is-unread"}`}><NotificationLine n={n} hrefs={hrefs} /></li>)}
          </ol>
        )}
        <div className="gf-bell-foot"><a href={all}>all notifications →</a></div>
      </div>
    </details>
  );
}
