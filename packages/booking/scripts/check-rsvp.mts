// Checks of the RSVP rules in @elkdonis/booking/core (pure: no database, no mail).
// Run inside a container:
//   cd packages/booking && <tsx> scripts/check-rsvp.mts
import {
  GUEST_PER_EMAIL_PER_HOUR,
  GUEST_PER_IP_PER_HOUR,
  attendedAllowed,
  cleanGuestInput,
  decideRsvp,
  followDecision,
  guestRateLimited,
  guestRsvpCounts,
  guestRsvpState,
  memberRule,
  pickPromotions,
  refundOnCancel,
  seatsFree,
  type RsvpStatusValue,
} from "../src/core/index.ts";

let pass = 0;
let fail = 0;
function eq(name: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  if (g === w) pass++;
  else {
    fail++;
    console.log(`FAIL ${name}\n  got  ${g}\n  want ${w}`);
  }
}

const now = new Date("2026-11-16T12:00:00Z");
const open = { isRsvpEnabled: true, deadline: null, attendeeLimit: null, priceMinor: 0 };

// Member rule: participants read, RSVP, comment, post; only member+ publish as the org.
eq("signed-out", memberRule(false, null), { read: false, rsvp: false, comment: false, forumPost: false, publishAsOrg: false, sharesInfoWithHost: false });
eq("no role", memberRule(true, null).rsvp && memberRule(true, null).forumPost && memberRule(true, null).comment, true);
eq("no role cannot publish", memberRule(true, null).publishAsOrg, false);
eq("viewer cannot publish", memberRule(true, "viewer").publishAsOrg, false);
eq("member publishes", memberRule(true, "member").publishAsOrg, true);
eq("rsvp shares member info", memberRule(true, "viewer").sharesInfoWithHost, true);

// Seat decision
eq("free open", decideRsvp({ thread: open, now, seatsTaken: 3, previous: null, paid: "refuse" }), { action: "confirm", status: "yes" });
eq("not enabled", decideRsvp({ thread: { ...open, isRsvpEnabled: false }, now, seatsTaken: 0, previous: null, paid: "refuse" }).action, "refuse");
eq("deadline passed", decideRsvp({ thread: { ...open, deadline: "2026-11-01T00:00:00Z" }, now, seatsTaken: 0, previous: null, paid: "refuse" }).action, "refuse");
eq("full goes to waitlist", decideRsvp({ thread: { ...open, attendeeLimit: 2 }, now, seatsTaken: 2, previous: null, paid: "refuse" }), { action: "waitlist", status: "waitlist" });
eq("full, waitlist off", decideRsvp({ thread: { ...open, attendeeLimit: 2 }, now, seatsTaken: 2, previous: null, paid: "refuse", waitlist: false }).action, "refuse");
eq("one seat left", decideRsvp({ thread: { ...open, attendeeLimit: 2 }, now, seatsTaken: 1, previous: null, paid: "refuse" }).action, "confirm");
eq("already waitlisted stays", decideRsvp({ thread: { ...open, attendeeLimit: 2 }, now, seatsTaken: 2, previous: "waitlist", paid: "refuse" }), { action: "already", status: "waitlist" });
eq("priced refused 402", decideRsvp({ thread: { ...open, priceMinor: 2000 }, now, seatsTaken: 0, previous: null, paid: "refuse" }), {
  action: "refuse",
  httpStatus: 402,
  error: "This one is paid, and joining it by RSVP is not available here.",
});
eq("priced goes to checkout", decideRsvp({ thread: { ...open, priceMinor: 2000 }, now, seatsTaken: 0, previous: null, paid: "checkout" }).action, "checkout");
// 3b: the one free yes on the priced workshop stays as a comp
eq("comp stays", decideRsvp({ thread: { ...open, priceMinor: 2000 }, now, seatsTaken: 0, previous: "yes", paid: "refuse" }), { action: "already", status: "yes" });
eq("comp stays when full", decideRsvp({ thread: { ...open, priceMinor: 2000, attendeeLimit: 1 }, now, seatsTaken: 1, previous: "yes", paid: "refuse" }).action, "already");
eq("full beats pay (waitlist first)", decideRsvp({ thread: { ...open, priceMinor: 2000, attendeeLimit: 1 }, now, seatsTaken: 1, previous: null, paid: "checkout" }).action, "waitlist");

// Guest verification state (3a)
const hash = "abc";
eq("unverified", guestRsvpState({ verifyHash: hash, verifyExpiresAt: "2026-11-18T12:00:00Z", verifiedAt: null }, now), "unverified");
eq("unverified does not count", guestRsvpCounts("unverified"), false);
eq("verified counts", guestRsvpCounts(guestRsvpState({ verifyHash: hash, verifiedAt: "2026-11-16T11:00:00Z" }, now)), true);
eq("expired", guestRsvpState({ verifyHash: hash, verifyExpiresAt: "2026-11-15T12:00:00Z", verifiedAt: null }, now), "expired");
eq("expired does not count", guestRsvpCounts("expired"), false);
eq("legacy row (no fields) keeps counting", guestRsvpCounts(guestRsvpState({}, now)), true);
eq("guest needs email", cleanGuestInput({ name: "Ann" }).ok, false);
eq("guest bad email", cleanGuestInput({ name: "Ann", email: "not-an-email" }).ok, false);
eq("guest long message", cleanGuestInput({ name: "Ann", email: "a@b.co", message: "x".repeat(1001) }).ok, false);
{
  const g = cleanGuestInput({ name: " Ann ", email: " Ann@Example.COM ", newsletterOptIn: "yes" });
  eq("guest cleaned", g.ok && [g.name, g.email, g.newsletterOptIn], ["Ann", "ann@example.com", false]);
  const g2 = cleanGuestInput({ name: "Ann", email: "a@b.co", newsletterOptIn: true });
  eq("newsletter only on explicit true", g2.ok && g2.newsletterOptIn, true);
}
eq("rate limit by email", guestRateLimited({ sameEmailLastHour: GUEST_PER_EMAIL_PER_HOUR, sameIpLastHour: 0 }), true);
eq("rate limit by ip", guestRateLimited({ sameEmailLastHour: 0, sameIpLastHour: GUEST_PER_IP_PER_HOUR }), true);
eq("under the limits", guestRateLimited({ sameEmailLastHour: 1, sameIpLastHour: 2 }), false);

// Follower, never a mail subscriber (3c)
eq("follow when open and no role", followDecision({ followOnRsvp: true, role: null, joinPolicy: "open" }), { action: "follow", subscribeToMail: false });
eq("follow by default policy", followDecision({ followOnRsvp: true, role: null, joinPolicy: undefined }).action, "follow");
eq("never subscribes to mail", [
  followDecision({ followOnRsvp: true, role: null, joinPolicy: "open" }),
  followDecision({ followOnRsvp: true, role: "member", joinPolicy: "open" }),
  followDecision({ followOnRsvp: false, role: null, joinPolicy: "open" }),
  followDecision({ followOnRsvp: true, role: null, joinPolicy: "private" }),
].every((d) => d.subscribeToMail === false), true);
eq("role holder is left alone", followDecision({ followOnRsvp: true, role: "member", joinPolicy: "open" }).action, "none");
eq("viewer is left alone", followDecision({ followOnRsvp: true, role: "viewer", joinPolicy: "open" }).action, "none");
eq("site without follow-on-RSVP", followDecision({ followOnRsvp: false, role: null, joinPolicy: "open" }).action, "none");
eq("private org refuses", followDecision({ followOnRsvp: true, role: null, joinPolicy: "private" }).action, "refuse");
eq("invite-only org refuses", followDecision({ followOnRsvp: true, role: null, joinPolicy: "invite_only" }).action, "refuse");
eq("private org: a member is fine", followDecision({ followOnRsvp: true, role: "member", joinPolicy: "private" }).action, "none");

// Waitlist promotion order (3d)
const t = (h: number) => new Date(now.getTime() - h * 3600_000).toISOString();
{
  const queue = [
    { userId: "c", queuedAt: t(1) },
    { userId: "a", queuedAt: t(5) },
    { userId: "b", queuedAt: t(3) },
  ];
  eq("oldest first", pickPromotions({ free: 2, queue, now, priced: false }).map((p) => p.userId), ["a", "b"]);
  eq("free thread promotes to a seat", pickPromotions({ free: 1, queue, now, priced: false })[0], { userId: "a", mode: "seat", holdExpiresAt: null });
  const priced = pickPromotions({ free: 1, queue, now, priced: true })[0];
  eq("priced thread holds 24h", [priced.mode, priced.holdExpiresAt?.toISOString()], ["hold", "2026-11-17T12:00:00.000Z"]);
  eq("nothing free, nobody promoted", pickPromotions({ free: 0, queue, now, priced: false }), []);
  const held = [{ userId: "a", queuedAt: t(5), holdExpiresAt: new Date(now.getTime() + 3600_000) }, ...queue.slice(0, 1)];
  eq("a live hold is not promoted twice", pickPromotions({ free: 1, queue: held, now, priced: true }).map((p) => p.userId), ["c"]);
  const lapsed = [{ userId: "a", queuedAt: t(5), holdExpiresAt: new Date(now.getTime() - 1000) }, { userId: "b", queuedAt: t(3) }];
  eq("a lapsed hold is promotable again", pickPromotions({ free: 1, queue: lapsed, now, priced: true }).map((p) => p.userId), ["a"]);
  eq("same time: stable by id", pickPromotions({ free: 2, queue: [{ userId: "z", queuedAt: t(1) }, { userId: "y", queuedAt: t(1) }], now, priced: false }).map((p) => p.userId), ["y", "z"]);
}
eq("seatsFree", [seatsFree(5, 3), seatsFree(5, 9), seatsFree(null, 9)], [2, 0, Infinity]);

// Composition with a stubbed store and stubbed mail: join, fill, waitlist, cancel, promote.
{
  const limit = 2;
  const rows = new Map<string, { status: RsvpStatusValue; at: number }>();
  const sent: Array<{ to: string; kind: string }> = [];
  let clock = 0;
  const taken = (except?: string) => [...rows].filter(([u, r]) => u !== except && r.status === "yes").length;
  const join = (u: string) => {
    const d = decideRsvp({ thread: { ...open, attendeeLimit: limit }, now, seatsTaken: taken(u), previous: rows.get(u)?.status ?? null, paid: "refuse" });
    if (d.action === "confirm") rows.set(u, { status: "yes", at: ++clock });
    if (d.action === "waitlist") rows.set(u, { status: "waitlist", at: ++clock });
    return d.action;
  };
  const leave = (u: string) => {
    rows.delete(u);
    const queue = [...rows].filter(([, r]) => r.status === "waitlist").map(([userId, r]) => ({ userId, queuedAt: new Date(r.at) }));
    for (const p of pickPromotions({ free: seatsFree(limit, taken()), queue, now, priced: false })) {
      rows.set(p.userId, { status: "yes", at: ++clock });
      sent.push({ to: p.userId, kind: "place-opened" });
    }
  };
  eq("first two confirm", [join("u1"), join("u2")], ["confirm", "confirm"]);
  eq("third and fourth wait", [join("u3"), join("u4")], ["waitlist", "waitlist"]);
  leave("u1");
  eq("u3 promoted first", [rows.get("u3")?.status, rows.get("u4")?.status], ["yes", "waitlist"]);
  eq("one mail, to u3", sent, [{ to: "u3", kind: "place-opened" }]);
  leave("u4");
  eq("leaving the line frees nothing", [taken(), sent.length], [2, 1]);
}

// Attended only for workshops and events (3e)
eq("workshop", attendedAllowed("workshop"), true);
eq("event", attendedAllowed("event"), true);
eq("standing meeting", attendedAllowed("meeting"), false);
eq("series session", attendedAllowed("series_session"), false);
eq("reading group", attendedAllowed("reading_group"), false);
eq("unknown kind", attendedAllowed(null), false);

// Refund recorded as due only for a paid place
eq("paid cancel records due", refundOnCancel({ hadPaidOrder: true, paidMinor: 2000 }), { record: true, amountMinor: 2000 });
eq("comp cancel records nothing", refundOnCancel({ hadPaidOrder: false, paidMinor: 0 }), { record: false, amountMinor: 0 });

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
