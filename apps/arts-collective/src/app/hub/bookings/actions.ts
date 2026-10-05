"use server";

import { revalidatePath } from "next/cache";
import {
  sellerCancelBooking,
  sellerConfirmTime,
  sellerProposeTimes,
} from "@elkdonis/commerce/server";
import { getCurrentUser } from "@/lib/session";

// ============================================================================
// The seller's answers to a booking (migration 174). The seller is the
// signed-in person, from the session; commerce matches seller_user_id, so a
// booking id belonging to someone else is simply "no longer open".
// ============================================================================

type Result = { ok: true } | { ok: false; error: string };

async function seller(): Promise<string | null> {
  const user = await getCurrentUser();
  return user?.id ?? null;
}

export async function confirmBookingTime(bookingId: string, at: string): Promise<Result> {
  const id = await seller();
  if (!id) return { ok: false, error: "Sign in first." };
  const r = await sellerConfirmTime(id, bookingId, at);
  revalidatePath("/hub/bookings");
  return r;
}

export async function proposeBookingTimes(bookingId: string, times: string[], message: string): Promise<Result> {
  const id = await seller();
  if (!id) return { ok: false, error: "Sign in first." };
  const r = await sellerProposeTimes(id, bookingId, times, message);
  revalidatePath("/hub/bookings");
  return r;
}

export async function cancelBooking(bookingId: string, message: string): Promise<Result> {
  const id = await seller();
  if (!id) return { ok: false, error: "Sign in first." };
  const r = await sellerCancelBooking(id, bookingId, message);
  revalidatePath("/hub/bookings");
  return r;
}
