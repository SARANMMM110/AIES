"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificationBell } from "@/components/NotificationBell";
import { ToastBanner, consumeFlashToast, useShellToast } from "@/components/Toast";
import { ADMIN_CACHE_KEYS, fetchAdminCached } from "@/lib/admin-list-cache";
import "./admin-shell.css";

const ADMIN_LINKS = [
  { href: "/admin", label: "Overview", group: "Control" },
  { href: "/admin/products", label: "Products", group: "Catalog" },
  { href: "/admin/bundles", label: "Bundles", group: "Catalog" },
  { href: "/admin/wiki", label: "Agency Wiki", group: "Catalog" },
  { href: "/admin/inquiries", label: "Inquiries", group: "System" },
  { href: "/admin/users", label: "Users", group: "System" },
  { href: "/admin/settings", label: "Settings", group: "System" },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname() || "/admin";
  const router = useRouter();
  const [navOpen, setNavOpen] = useState(false);
  const { toast, showToast } = useShellToast();

  // Re-consume flash toasts when navigating between admin pages.
  useEffect(() => {
    const flash = consumeFlashToast();
    if (flash) showToast(flash.message, flash.tone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Warm caches one-at-a-time so we don't stampede the DB pool on login.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void (async () => {
      const jobs = [
        () => fetchAdminCached(ADMIN_CACHE_KEYS.products, "/api/products"),
        () => fetchAdminCached(ADMIN_CACHE_KEYS.bundles, "/api/bundles"),
        () => fetchAdminCached(ADMIN_CACHE_KEYS.wikiArticles, "/api/wiki/admin/articles"),
        () => fetchAdminCached(ADMIN_CACHE_KEYS.inquiries, "/api/sales/inquiries"),
      ];
      for (const job of jobs) {
        if (cancelled) return;
        try {
          await job();
        } catch {
          /* ignore warm failures */
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  async function handleLogout() {
    await logout();
    router.replace("/admin/login");
  }

  const initials = user
    ? `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`.toUpperCase() || "A"
    : "A";

  const groups = ["Control", "Catalog", "System"] as const;

  return (
    <div className={`admin-shell ${navOpen ? "nav-open" : ""}`}>
      <ToastBanner toast={toast} />
      <aside className="admin-shell-sidebar">
        <Link href="/admin" className="admin-shell-brand" onClick={() => setNavOpen(false)}>
          <span className="admin-shell-mark" aria-hidden>
            AES
          </span>
          <span>
            <strong>AI Enterprise Studio</strong>
            <em>Admin control plane</em>
          </span>
        </Link>

        <nav className="admin-shell-nav" aria-label="Admin" onClick={() => setNavOpen(false)}>
          {groups.map((group) => {
            const items = ADMIN_LINKS.filter((link) => link.group === group);
            if (!items.length) return null;
            return (
              <div key={group} className="admin-shell-group">
                <p className="admin-shell-group-label">{group}</p>
                {items.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={isActive(pathname, link.href) ? "active" : undefined}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            );
          })}
        </nav>

        <div className="admin-shell-foot">
          <ThemeToggle />
          {user ? (
            <div className="admin-shell-user">
              <span className="admin-shell-avatar" aria-hidden>
                {initials}
              </span>
              <div>
                <strong>
                  {user.firstName} {user.lastName}
                </strong>
                <span>{user.email}</span>
              </div>
              <button type="button" className="admin-shell-logout" onClick={() => void handleLogout()}>
                Log out
              </button>
            </div>
          ) : null}
        </div>
      </aside>

      <div className="admin-shell-main">
        <header className="admin-shell-topbar">
          <button
            type="button"
            className="admin-shell-menu"
            aria-label="Open admin navigation"
            onClick={() => setNavOpen((value) => !value)}
          >
            Menu
          </button>
          <div className="admin-shell-crumb">
            <span>Admin</span>
            <strong>{ADMIN_LINKS.find((link) => isActive(pathname, link.href))?.label || "Console"}</strong>
          </div>
          <div className="admin-shell-top-actions">
            <NotificationBell tone="admin" />
            <Link href="/admin" className="admin-shell-home">
              Overview
            </Link>
          </div>
        </header>
        <div className="admin-shell-content">{children}</div>
      </div>

      {navOpen ? (
        <button
          type="button"
          className="admin-shell-backdrop"
          aria-label="Close admin navigation"
          onClick={() => setNavOpen(false)}
        />
      ) : null}
    </div>
  );
}
