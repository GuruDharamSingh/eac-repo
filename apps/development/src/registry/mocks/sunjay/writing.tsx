"use client";

import { WritingShelf } from "@elkdonis/cms-ui/writing";
import "@elkdonis/cms-ui/writing.css";
import "./sunjay-mock.css";
import { SHELF } from "./sample";

// Real: cms-ui's WritingShelf (what Sunjay's Writing block wraps) with four invented pieces.
export default function Writing() {
  return (
    <div>
      <WritingShelf items={SHELF} basePath="/writing" heading="Writing" kicker={null} intro={null} />
      <div className="mt-6">
        <a href="/writing" className="text-sm font-medium text-[hsl(var(--rust))] underline underline-offset-4">
          All writing →
        </a>
      </div>
    </div>
  );
}
