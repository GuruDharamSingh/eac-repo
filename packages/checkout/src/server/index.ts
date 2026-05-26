/**
 * Server-side checkout helpers — Next.js cookie-based cart token management.
 *
 * Consumers wrap this with their own server actions to keep the action
 * boundary explicit. Example:
 *
 *   "use server";
 *   import { withCartToken } from "@elkdonis/checkout/server";
 *   import { addToCart as addToCartCore } from "@elkdonis/commerce/server";
 *
 *   export async function addArtworkToCart(input) {
 *     return withCartToken(async (token) => addToCartCore({ cartToken: token, ...input }));
 *   }
 */

import { cookies } from "next/headers";
import { getOrCreateCart } from "@elkdonis/commerce/server";

export const CART_COOKIE = "ea_cart_token";
const COOKIE_MAX_AGE_DAYS = 30;

export async function readCartToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(CART_COOKIE)?.value ?? null;
}

export async function writeCartToken(token: string): Promise<void> {
  const store = await cookies();
  store.set(CART_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE_DAYS * 86400,
  });
}

export async function clearCartToken(): Promise<void> {
  const store = await cookies();
  store.delete(CART_COOKIE);
}

/**
 * Get-or-create the cart for the current request, ensuring the cookie is set,
 * then run the given function with the token. Use this from server actions
 * that need to mutate the cart.
 */
export async function withCartToken<T>(
  fn: (token: string) => Promise<T>,
  opts: { userId?: string | null; currency?: "CAD" | "USD" | "EUR" | "GBP" } = {}
): Promise<T> {
  const existing = await readCartToken();
  const { token } = await getOrCreateCart({
    token: existing,
    userId: opts.userId ?? null,
    currency: opts.currency,
  });
  if (token !== existing) {
    await writeCartToken(token);
  }
  return fn(token);
}
