// Network-sold services -> the booking module (2026-11-27). A subpath so @elkdonis/content, which has no
// link to @elkdonis/booking, reaches `recordNetworkBooking` through this package (which has it).
export { recordNetworkBooking, releaseBooking } from "@elkdonis/booking";
export type { RecordNetworkBookingInput, RecordNetworkBookingResult } from "@elkdonis/booking";
