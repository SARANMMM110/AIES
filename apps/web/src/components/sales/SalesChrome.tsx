"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import "./sales.css";

type NavLink = {
  href: string;
  label: string;
  /** Section id on /sales for hash links */
  section?: string;
};

const LINKS: NavLink[] = [
  { href: "/sales", label: "Agencies", section: "agencies" },
  { href: "/sales#how", label: "How it works", section: "how" },
  { href: "/sales#resale", label: "Resale", section: "resale" },
  { href: "/sales/bundles", label: "Bundles" },
  { href: "/purchase?suite=1", label: "Suite" },
];

function readHash(): string {
  if (typeof window === "undefined") return "";
  return window.location.hash.replace(/^#/, "");
}

function linkIsActive(link: NavLink, pathname: string, hash: string, pinned: string | null) {
  if (pinned) return pinned === link.href;

  if (link.href.startsWith("/purchase")) {
    return pathname.startsWith("/purchase");
  }

  if (link.href.startsWith("/sales/bundles")) {
    return pathname.startsWith("/sales/bundles");
  }

  // In-page section links on the catalog
  if (link.section && link.href.includes("#")) {
    return pathname === "/sales" && hash === link.section;
  }

  // Agencies: catalog root with no section hash, or any individual agency page
  if (link.href === "/sales") {
    if (pathname.startsWith("/sales/") && !pathname.startsWith("/sales/bundles")) return true;
    return pathname === "/sales" && (!hash || hash === "agencies");
  }

  return false;
}

export function SalesHeader() {
  const { user, loading } = useAuth();
  const pathname = usePathname() || "/sales";
  const [hash, setHash] = useState("");
  const [pinned, setPinned] = useState<string | null>(null);

  useEffect(() => {
    setHash(readHash());
    setPinned(null);

    const onHashChange = () => {
      setHash(readHash());
      setPinned(null);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [pathname]);

  // Keep the matching nav item active while scrolling sections on /sales
  useEffect(() => {
    if (pathname !== "/sales") return;

    const sectionIds = LINKS.map((l) => l.section).filter(Boolean) as string[];
    const nodes = sectionIds
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (!nodes.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible?.target?.id) return;
        setHash(visible.target.id);
        setPinned(null);
        if (window.location.hash.replace(/^#/, "") !== visible.target.id) {
          window.history.replaceState(null, "", `#${visible.target.id}`);
        }
      },
      {
        root: null,
        // Account for sticky header — prefer the section near the top third
        rootMargin: "-20% 0px -55% 0px",
        threshold: [0.15, 0.35, 0.6],
      }
    );

    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [pathname]);

  const inquireHref = pathname.startsWith("/purchase")
    ? null
    : pathname.startsWith("/sales")
      ? "#purchase"
      : "/purchase";

  return (
    <header className="sales-header">
      <div className="container sales-header-inner">
        <Link className="sales-brand" href="/sales" aria-label="AI Enterprise Studio">
          <span className="sales-brand-mark" aria-hidden>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M12 4l8 14H4L12 4z" fill="currentColor" />
            </svg>
          </span>
          <span className="sales-brand-copy">
            <strong>AI Enterprise Studio</strong>
            <em>Agency systems</em>
          </span>
        </Link>

        <nav className="sales-header-nav" aria-label="Sales">
          {LINKS.map((link) => {
            const active = linkIsActive(link, pathname, hash, pinned);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={active ? "active" : undefined}
                aria-current={active ? "page" : undefined}
                onClick={() => {
                  setPinned(link.href);
                  if (link.section && link.href.includes("#")) {
                    setHash(link.section);
                    return;
                  }
                  if (link.href === "/sales") {
                    setHash("");
                    if (pathname === "/sales" && typeof window !== "undefined") {
                      window.history.replaceState(null, "", "/sales");
                      window.requestAnimationFrame(() => {
                        document.getElementById("agencies")?.scrollIntoView({ behavior: "smooth", block: "start" });
                      });
                    }
                    return;
                  }
                  setHash("");
                }}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="sales-header-actions">
          {!loading && user ? (
            <>
              <Link className="sales-header-link" href="/products">
                My Products
              </Link>
              <Link className="sales-header-cta" href="/dashboard">
                Dashboard
              </Link>
            </>
          ) : inquireHref ? (
            inquireHref === "#purchase" ? (
              <a
                className="sales-header-cta"
                href="#purchase"
                onClick={(e) => {
                  e.preventDefault();
                  setPinned(null);
                  setHash("purchase");
                  document.getElementById("purchase")?.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                  });
                  history.replaceState(null, "", "#purchase");
                }}
              >
                Purchase
              </a>
            ) : (
              <Link className="sales-header-cta" href={inquireHref}>
                Purchase
              </Link>
            )
          ) : null}
        </div>
      </div>
    </header>
  );
}

export function SalesFooter() {
  return (
    <footer className="sales-foot">
      <div className="container foot">
        <span>© 2026 AI Enterprise Studio. All rights reserved.</span>
        <div className="sales-foot-links">
          <Link href="/sales">Agencies</Link>
          <Link href="/sales#resale">Resale</Link>
          <Link href="/sales/bundles">Bundles</Link>
          <Link href="/purchase?suite=1">Complete Suite</Link>
        </div>
      </div>
    </footer>
  );
}
