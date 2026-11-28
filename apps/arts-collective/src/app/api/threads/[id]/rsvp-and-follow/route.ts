import { rsvpRoutes } from "@elkdonis/services";
import { rsvpFollowOptions } from "@/lib/rsvp-follow-options";

export const dynamic = "force-dynamic";
export const { GET, POST, DELETE } = rsvpRoutes(rsvpFollowOptions);
