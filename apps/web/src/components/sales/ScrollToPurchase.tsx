"use client";

import type { MouseEvent, ReactNode } from "react";

type Props = {
  href?: string;
  className?: string;
  children: ReactNode;
  /** Element id to scroll to (default: purchase form) */
  targetId?: string;
};

/**
 * Smooth-scroll to an in-page section (inquire form). Avoids broken #hash
 * behavior when duplicate ids or sticky headers get in the way.
 */
export function ScrollToPurchase({
  href = "#purchase",
  className,
  children,
  targetId = "purchase",
}: Props) {
  function onClick(e: MouseEvent<HTMLAnchorElement>) {
    const el = document.getElementById(targetId);
    if (!el) return;
    e.preventDefault();
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    // Keep URL hash in sync for share/back
    if (href.startsWith("#")) {
      history.replaceState(null, "", href);
    }
    // Focus first field in the form when possible
    const focusable = el.querySelector<HTMLElement>(
      "input, textarea, select, button"
    );
    focusable?.focus({ preventScroll: true });
  }

  return (
    <a className={className} href={href} onClick={onClick}>
      {children}
    </a>
  );
}
