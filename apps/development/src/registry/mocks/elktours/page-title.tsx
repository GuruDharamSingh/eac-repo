"use client";

import { MPageTitle } from "../../../../../elktours/src/blocks/mobile/m-page-title";
import { PhoneFrame } from "./phone-parts";
import { TOUR } from "@/sample";

// The one elktours phone block that imports cleanly (plain component, no "@/" imports): the REAL MPageTitle inside the phone
// frame the other m-* mocks use, over the app's scoped phone sheets. The words and count come from the shared sample world.
export default function PageTitle() {
  return (
    <PhoneFrame>
      <MPageTitle kicker="Fenwick Harbour" showCount countLabel="tours" title="Tours" intro={TOUR.excerpt} readMoreLabel="Read more" readMoreHref="/about" count={6} />
    </PhoneFrame>
  );
}
