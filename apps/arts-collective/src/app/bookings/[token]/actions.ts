"use server";

import { buyerConfirmTime, buyerProposeTimes } from "@elkdonis/commerce/server";

// ============================================================================
// The buyer's answers, keyed by their private link's token (no account
// needed). Commerce matches buyer_token, and only the moves the booking's
// state allows go through.
// ============================================================================

type Result = { ok: true } | { ok: false; error: string };

export async function confirmAsBuyer(token: string, at: string): Promise<Result> {
  return buyerConfirmTime(token, at);
}

export async function proposeAsBuyer(token: string, times: string[], message: string): Promise<Result> {
  return buyerProposeTimes(token, times, message);
}
