/**
 * Render-through checks for the primitives.
 *
 * These render to static markup rather than asserting on props, because the
 * whole design rests on the DATA ATTRIBUTES reaching the DOM — that is the
 * only thing primitives.css can select on. A component that took `variant` and
 * quietly failed to emit `data-variant` would pass any props-level test and
 * render completely unstyled in the browser.
 */
import { renderToStaticMarkup } from "react-dom/server";
import * as React from "react";
import {
  Badge,
  Checkbox,
  RadioGroup,
  RadioGroupItem,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Button,
  Card,
  CardAction,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Textarea,
} from "../src/index";

let pass = 0;
const failures: string[] = [];

function check(name: string, cond: boolean, detail = "") {
  if (cond) pass++;
  else failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
}

const html = (el: React.ReactElement) => renderToStaticMarkup(el);

// ── Data attributes reach the DOM ───────────────────────────────────────────

const btn = html(React.createElement(Button, null, "Save"));
check("button emits data-slot", btn.includes('data-slot="button"'), btn);
check("button defaults to variant=default", btn.includes('data-variant="default"'));
check("button defaults to size=default", btn.includes('data-size="default"'));
check("button defaults type=button", btn.includes('type="button"'), btn);

const destructive = html(
  React.createElement(Button, { variant: "destructive", size: "sm" }, "Delete")
);
check("button carries variant", destructive.includes('data-variant="destructive"'));
check("button carries size", destructive.includes('data-size="sm"'));

// An explicit submit must survive the type default.
const submit = html(React.createElement(Button, { type: "submit" }, "Go"));
check("explicit type=submit survives", submit.includes('type="submit"'), submit);

for (const [name, el] of [
  ["input", React.createElement(Input, {})],
  ["textarea", React.createElement(Textarea, {})],
  ["label", React.createElement(Label, null, "Name")],
  ["badge", React.createElement(Badge, null, "New")],
  ["card", React.createElement(Card, null, "x")],
] as const) {
  check(`${name} emits data-slot`, html(el).includes(`data-slot="${name}"`));
}

// ── className passes through, never replaces ────────────────────────────────

const withClass = html(
  React.createElement(Button, { className: "w-full" }, "Wide")
);
check("caller className kept", withClass.includes("w-full"), withClass);
check("own class still present", withClass.includes("eac-button"), withClass);

// ── asChild renders the child, not a <button> ───────────────────────────────

const asChild = html(
  React.createElement(
    Button,
    { asChild: true, variant: "outline" },
    React.createElement("a", { href: "/next", className: "mine" }, "Next")
  )
);
check("asChild renders the anchor", asChild.startsWith("<a"), asChild);
check("asChild does NOT wrap in a button", !asChild.includes("<button"), asChild);
check("asChild keeps the href", asChild.includes('href="/next"'), asChild);
check("asChild applies data-variant", asChild.includes('data-variant="outline"'), asChild);
// Both class names must survive: the child's own styling and ours.
check("asChild merges className", asChild.includes("mine") && asChild.includes("eac-button"), asChild);

// A non-element child must not throw — it renders bare rather than crashing.
let threw = false;
try {
  html(React.createElement(Button, { asChild: true }, "just text"));
} catch {
  threw = true;
}
check("asChild with a text child does not throw", !threw);

// ── aria-invalid is passed through, since the CSS selects on it ─────────────

const invalid = html(React.createElement(Input, { "aria-invalid": true }));
check("aria-invalid reaches the DOM", invalid.includes('aria-invalid="true"'), invalid);

// ── Card composition ────────────────────────────────────────────────────────

const card = html(
  React.createElement(
    Card,
    null,
    React.createElement(
      CardHeader,
      null,
      React.createElement(CardTitle, null, "Title"),
      React.createElement(CardAction, null, React.createElement(Button, { size: "icon" }, "x"))
    )
  )
);
check("card-header present", card.includes('data-slot="card-header"'));
// The two-column header layout is a :has() rule, so the action's data-slot
// must be inside the header or the layout silently never applies.
check("card-action nested in header", /card-header[\s\S]*card-action/.test(card), card);

// ── Tier 2: the Radix-backed controls ───────────────────────────────────────
//
// Same reason as tier 1: primitives.css can only reach these through their
// data attributes, and for tier 2 several of those come from RADIX rather than
// from our own code (data-state, data-orientation). A Radix upgrade that
// renamed one would break the styling with no type error anywhere, so the
// attributes are asserted rather than assumed.

const sep = html(React.createElement(Separator, {}));
check("separator emits data-slot", sep.includes('data-slot="separator"'), sep);
check("separator defaults to horizontal", sep.includes('data-orientation="horizontal"'), sep);
check(
  "separator is decorative by default",
  sep.includes('role="none"') || !sep.includes('role="separator"'),
  sep
);

const vsep = html(React.createElement(Separator, { orientation: "vertical", decorative: false }));
check("vertical separator keeps orientation", vsep.includes('data-orientation="vertical"'), vsep);
check("non-decorative separator is announced", vsep.includes('role="separator"'), vsep);

const cb = html(React.createElement(Checkbox, { checked: true }));
check("checkbox emits data-slot", cb.includes('data-slot="checkbox"'), cb);
check("checkbox exposes checked state", cb.includes('data-state="checked"'), cb);
check("checked checkbox renders its tick", cb.includes("<svg"), cb);

const cbOff = html(React.createElement(Checkbox, { checked: false }));
check("unchecked checkbox has no tick", !cbOff.includes("<svg"), cbOff);
check("checkbox is a real button", cbOff.includes("<button"), cbOff);

const sw = html(React.createElement(Switch, { checked: true }));
check("switch emits data-slot", sw.includes('data-slot="switch"'), sw);
check("switch exposes checked state", sw.includes('data-state="checked"'), sw);
check("switch renders its thumb", sw.includes('data-slot="switch-thumb"'), sw);
check("switch has the right role", sw.includes('role="switch"'), sw);

const rg = html(
  React.createElement(
    RadioGroup,
    { value: "b" },
    React.createElement(RadioGroupItem, { value: "a" }),
    React.createElement(RadioGroupItem, { value: "b" })
  )
);
check("radio group emits data-slot", rg.includes('data-slot="radio-group"'), rg);
check("radio group has the right role", rg.includes('role="radiogroup"'), rg);
// Exactly one indicator: the selected option. Two would mean the group is not
// actually behaving as a single-choice control.
check(
  "exactly one radio indicator renders",
  (rg.match(/data-slot="radio-group-indicator"/g) || []).length === 1,
  rg
);

const tabs = html(
  React.createElement(
    Tabs,
    { defaultValue: "one" },
    React.createElement(
      TabsList,
      { variant: "line" },
      React.createElement(TabsTrigger, { value: "one" }, "One"),
      React.createElement(TabsTrigger, { value: "two" }, "Two")
    ),
    React.createElement(TabsContent, { value: "one" }, "First panel")
  )
);
check("tabs list carries the variant", tabs.includes('data-variant="line"'), tabs);
check("tabs list has the right role", tabs.includes('role="tablist"'), tabs);
check("active trigger is marked", tabs.includes('data-state="active"'), tabs);
// The underline is drawn from the LIST's data-variant down to the trigger, so
// the trigger must actually sit inside the list in the DOM.
check("triggers nest inside the list", /tabs-list[\s\S]*tabs-trigger/.test(tabs), tabs);

const sel = html(
  React.createElement(
    Select,
    { defaultValue: "x" },
    React.createElement(SelectTrigger, {}, React.createElement(SelectValue, {})),
    React.createElement(SelectContent, {}, React.createElement(SelectItem, { value: "x" }, "Ex"))
  )
);
check("select trigger emits data-slot", sel.includes('data-slot="select-trigger"'), sel);
check("select trigger has the right role", sel.includes('role="combobox"'), sel);
check("select trigger reports collapsed", sel.includes('aria-expanded="false"'), sel);

// ── Report ──────────────────────────────────────────────────────────────────

console.log(`\n  ${pass} passed, ${failures.length} failed\n`);
for (const f of failures) console.log(`  FAIL  ${f}`);
process.exit(failures.length ? 1 : 0);
