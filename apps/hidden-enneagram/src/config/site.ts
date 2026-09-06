export const siteConfig = {
  orgId: "hidden-enneagram",
  orgName: "The Hidden Enneagram",
  /** Display name shown to buyers in payment instructions and emails. */
  payeeName: process.env.HIDDEN_ENNEAGRAM_PAYEE_NAME ?? "The Hidden Enneagram",
  /** Where a buyer sends the eTransfer — not stored in the DB. */
  payoutEmail: process.env.HIDDEN_ENNEAGRAM_PAYOUT_EMAIL ?? "info@elkdonis-arts.org",
};
