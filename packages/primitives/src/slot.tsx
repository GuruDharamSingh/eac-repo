import * as React from "react";

// ============================================================================
// asChild, without Radix.
//
// The shadcn copies pulled in `radix-ui` purely for `Slot.Root` — the helper
// behind `asChild`, which renders the caller's own element (a Next <Link>,
// usually) carrying the component's props instead of wrapping it in a <button>
// that would sit illegally inside an <a>.
//
// That is the whole of what was used from the package, and it is short enough
// to own. Owning it is the point: these primitives are meant to render in
// every app, including ones whose package.json never listed radix-ui, and the
// census found several apps importing primitives whose Radix dependency was
// missing entirely — resolving only by accident of pnpm hoisting.
// ============================================================================

export interface SlotProps extends React.HTMLAttributes<HTMLElement> {
  children?: React.ReactNode;
}

/**
 * Merge the slot's props into its single child element.
 *
 * Order matters in two places and they pull opposite ways:
 *
 *  - `className` and `style` are COMBINED, so a caller styling their <Link>
 *    keeps that styling on top of the variant's.
 *  - Event handlers are CHAINED, so neither side silently loses its handler —
 *    a button that both closes a menu and follows a link has to do both.
 *  - Everything else lets the child win, because the child is the more
 *    specific statement of intent.
 */
export function Slot({ children, ...slotProps }: SlotProps) {
  if (!React.isValidElement(children)) {
    // Not a single element — nothing to merge onto. Returning the children
    // untouched keeps `asChild` from throwing on an empty or text child; the
    // caller gets an unstyled result, which is visible and debuggable, rather
    // than a crashed render.
    return <>{children}</>;
  }

  const child = children as React.ReactElement<Record<string, unknown>>;
  const childProps = child.props;
  const merged: Record<string, unknown> = { ...slotProps, ...childProps };

  for (const key of Object.keys(slotProps)) {
    const slotValue = (slotProps as Record<string, unknown>)[key];
    const childValue = childProps[key];

    if (/^on[A-Z]/.test(key) && typeof slotValue === "function") {
      merged[key] =
        typeof childValue === "function"
          ? (...args: unknown[]) => {
              (childValue as (...a: unknown[]) => void)(...args);
              (slotValue as (...a: unknown[]) => void)(...args);
            }
          : slotValue;
    } else if (key === "className") {
      merged[key] = [slotValue, childValue].filter(Boolean).join(" ");
    } else if (key === "style") {
      merged[key] = { ...(slotValue as object), ...(childValue as object) };
    }
  }

  return React.cloneElement(child, merged);
}

/** Join class names, skipping anything falsy. */
export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}
