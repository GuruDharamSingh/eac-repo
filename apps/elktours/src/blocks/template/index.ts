import type { Block } from "@elkdonis/blocks";
import { bookingOptions } from "./booking-options";
import { locations } from "./locations";

/** Generally useful blocks that draw the record in the address (a tour today; a workshop's session later). */
export const TEMPLATE_BLOCK_LIST: Block<never>[] = [bookingOptions, locations] as unknown as Block<never>[];
