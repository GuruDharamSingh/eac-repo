import { contentRoutes } from "@elkdonis/content/routes";
import { redisRateLimiter } from "@elkdonis/content/server";
import { isCardPaymentAvailable, startStripeCheckout, syncStripeOrder } from "@elkdonis/checkout/stripe";
import { getRedisClient } from "@elkdonis/redis";
import { contentHost } from "@/lib/content-host";

/**
 * Content-library checkout on arts-collective (CONTRACT §17; Justin's go 2026-11-27, arts-collective first).
 * Any org's priced offer, sold through the network org `oad`; the author is paid and the offer's own org gets its
 * agreed cut (commerce resolveSettlement). Rate limits live in Redis so they hold across restarts and instances.
 */
export const contentCheckout = contentRoutes(contentHost, {
  payments: { isCardPaymentAvailable, startStripeCheckout, syncStripeOrder },
  limiter: redisRateLimiter(getRedisClient()),
});
