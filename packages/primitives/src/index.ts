// ============================================================================
// @elkdonis/primitives
//
// The controls every app is built from, in one place, styled by tokens rather
// than by Tailwind utilities — so they render correctly in ifac and artdirect
// (own stylesheets) and in danamccool (no shadcn tokens at all), not only in
// the apps that happen to compile the same Tailwind config.
//
// Consumers must import the stylesheet once, in their global CSS:
//
//     @import "@elkdonis/primitives/primitives.css";
//
// Without it the components render as unstyled semantic HTML. That is the
// intended failure — legible and obviously wrong — rather than invisible.
// ============================================================================

export { Button } from "./components/button";
export type { ButtonProps, ButtonSize, ButtonVariant } from "./components/button";

export { Badge } from "./components/badge";
export type { BadgeProps, BadgeVariant } from "./components/badge";

export { Input, Textarea } from "./components/input";
export type { InputProps, TextareaProps } from "./components/input";

export { Label } from "./components/label";
export type { LabelProps } from "./components/label";

export {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./components/card";

// ── Tier 2: Radix for behaviour, our tokens for looks ──────────────────────

export { Separator } from "./components/separator";
export type { SeparatorProps } from "./components/separator";

export { Checkbox } from "./components/checkbox";
export type { CheckboxProps } from "./components/checkbox";

export { Switch } from "./components/switch";
export type { SwitchProps } from "./components/switch";

export { RadioGroup, RadioGroupItem } from "./components/radio-group";
export type { RadioGroupItemProps, RadioGroupProps } from "./components/radio-group";

export { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/tabs";
export type { TabsContentProps, TabsListProps, TabsListVariant, TabsProps, TabsTriggerProps } from "./components/tabs";

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "./components/select";
export type { SelectTriggerProps } from "./components/select";

export { Slot, cx } from "./slot";
