import { contentRoutes } from "@elkdonis/content/routes";
import { redisRateLimiter } from "@elkdonis/content/server";
import { isCardPaymentAvailable, startStripeCheckout, syncStripeOrder } from "@elkdonis/checkout/stripe";
import { getRedisClient } from "@elkdonis/redis";
import { contentHost } from "@/lib/content-host";

/**
 * Content-library checkout on Para Theater (sunjay) (CONTRACT §17; Justin's go 2026-11-27, relayed by the content library PM).
 * Same mount as arts-collective: any org's priced offer, sold through the network org `oad`; the author is paid and
 * the offer's own org gets its agreed cut (commerce resolveSettlement). Rate limits live in Redis, shared across apps.
 */
export const contentCheckout = contentRoutes(contentHost, {
  payments: { isCardPaymentAvailable, startStripeCheckout, syncStripeOrder },
  limiter: redisRateLimiter(getRedisClient()),
});
