"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificationBell } from "@/components/NotificationBell";

const USER_LINKS = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <rect x="3" y="3" width="8" height="8" rx="2" />
        <rect x="13" y="3" width="8" height="5" rx="2" />
        <rect x="13" y="10" width="8" height="11" rx="2" />
        <rect x="3" y="13" width="8" height="8" rx="2" />
      </svg>
    ),
  },
  {
    href: "/products",
    label: "My Products",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <path d="M4 7l8-4 8 4-8 4-8-4z" />
        <path d="M4 12l8 4 8-4M4 17l8 4 8-4" />
      </svg>
    ),
  },
  {
    href: "/wiki",
    label: "Agency Wiki",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <path d="M4 5h7a3 3 0 0 1 3 3v11a3 3 0 0 0-3-3H4V5zM20 5h-7a3 3 0 0 0-3 3v11a3 3 0 0 1 3-3h7V5z" />
      </svg>
    ),
  },
  {
    href: "/account",
    label: "Account",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 20c1.2-3.5 3.8-5.2 7-5.2s5.8 1.7 7 5.2" />
      </svg>
    ),
  },
  {
    href: "/reseller",
    label: "Reseller",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <path d="M4 7h16v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7z" />
        <path d="M8 7V5a4 4 0 0 1 8 0v2" />
        <path d="M8 12h4" />
      </svg>
    ),
  },
];

const ADMIN_LINKS = [
  { href: "/admin", label: "Dashboard", icon: USER_LINKS[0].icon },
  { href: "/admin/products", label: "Products", icon: USER_LINKS[1].icon },
  { href: "/admin/bundles", label: "Bundles", icon: USER_LINKS[1].icon },
  { href: "/admin/wiki", label: "Agency Wiki", icon: USER_LINKS[2].icon },
  { href: "/admin/users", label: "Users", icon: USER_LINKS[3].icon },
  {
    href: "/admin/settings",
    label: "Settings",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9c.3.6.9 1 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
      </svg>
    ),
  },
];

export function AppShell({
  children,
  variant = "user",
}: {
  children: React.ReactNode;
  variant?: "user" | "admin";
}) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [navOpen, setNavOpen] = useState(false);
  const [canResell, setCanResell] = useState(false);

  useEffect(() => {
    if (!user || variant === "admin") return;
    void Promise.all([
      apiFetch<{ entitlements: unknown[] }>("/api/reseller/me").catch(() => ({ entitlements: [] as unknown[] })),
      apiFetch<Array<{ key: string }>>("/api/reseller/account").catch(() => [] as Array<{ key: string }>),
    ]).then(([me, account]) => {
      setCanResell(me.entitlements.length > 0 || (Array.isArray(account) && account.length > 0));
    });
  }, [user, variant]);

  const links = (variant === "admin" ? ADMIN_LINKS : USER_LINKS).filter(
    (link) => link.href !== "/reseller" || canResell
  );

  async function handleLogout() {
    await logout();
    router.push(variant === "admin" ? "/admin/login" : "/login");
  }

  function isActive(href: string) {
    if (href === "/admin") return pathname === "/admin";
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  const initials = user
    ? `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`.toUpperCase() || "U"
    : "U";

  return (
    <div className={`shell ${navOpen ? "nav-open" : ""}`}>
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">AES</span>
          <div>
            <strong>AI Enterprise Studio</strong>
            <p>{variant === "admin" ? "Admin console" : "Agency OS"}</p>
          </div>
        </div>

        <div className="nav-section-label">{variant === "admin" ? "Console" : "Workspace"}</div>
        <nav onClick={() => setNavOpen(false)}>
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={isActive(link.href) ? "nav-link active" : "nav-link"}
            >
              <span className="nav-ico">{link.icon}</span>
              <span>{link.label}</span>
            </Link>
          ))}
          {variant === "user" && user?.role === "ADMIN" ? (
            <Link
              href="/admin"
              className={pathname.startsWith("/admin") ? "nav-link active" : "nav-link"}
            >
              <span className="nav-ico">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                  <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" />
                  <path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" />
                </svg>
              </span>
              <span>Admin</span>
            </Link>
          ) : null}
        </nav>

        <div className="sidebar-foot">
          <ThemeToggle />
          {user ? (
            <div className="user-card">
              <span className="user-avatar" aria-hidden>
                {initials}
              </span>
              <div className="user-meta">
                <strong>
                  {user.firstName} {user.lastName}
                </strong>
                <span>{user.role}</span>
              </div>
              <button type="button" className="btn ghost btn-sm" onClick={() => void handleLogout()}>
                Log out
              </button>
            </div>
          ) : null}
        </div>
      </aside>

      <div className="shell-content">
        <header className="shell-topbar">
          <button
            type="button"
            className="shell-menu-btn btn ghost btn-sm"
            aria-label="Toggle navigation"
            onClick={() => setNavOpen((v) => !v)}
          >
            Menu
          </button>
          <span className="shell-topbar-title">
            {variant === "admin" ? "Admin" : "AI Enterprise Studio"}
          </span>
          <div className="shell-topbar-actions">
            <NotificationBell tone="user" />
          </div>
        </header>
        <main className="main">{children}</main>
      </div>

      {navOpen ? (
        <button
          type="button"
          className="nav-backdrop"
          aria-label="Close navigation"
          onClick={() => setNavOpen(false)}
        />
      ) : null}
    </div>
  );
}
