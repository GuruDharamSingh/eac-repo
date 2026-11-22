import Link from "next/link";
import type { ReactNode } from "react";

export interface PrimaryButtonProps {
  children: ReactNode;
  disabled?: boolean;
  href?: string;
  onClick?: () => void;
  type?: "button" | "submit";
}

/** 56px brass button with cut corners. A link when `href` is given. */
export function PrimaryButton({ children, disabled, href, onClick, type = "button" }: PrimaryButtonProps) {
  if (href && !disabled) {
    return (
      <Link href={href} className="m-btn" onClick={onClick}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} className="m-btn" disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}
