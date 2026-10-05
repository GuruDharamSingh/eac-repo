import { SITE_VIEW_COOKIE } from "@/lib/writing-room";

/**
 * "View site" from the writing room: mark this browser session as having
 * chosen the site, then go to the landing page. A relative Location, because
 * request.nextUrl.origin reports the container's bind address.
 */
export function GET() {
  return new Response(null, {
    status: 303,
    headers: {
      Location: "/",
      "Set-Cookie": `${SITE_VIEW_COOKIE}=1; Path=/; HttpOnly; SameSite=Lax`,
    },
  });
}
