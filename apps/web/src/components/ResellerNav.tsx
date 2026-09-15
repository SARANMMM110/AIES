"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/reseller", label: "Overview" },
  { href: "/reseller/offers", label: "Offers" },
  { href: "/reseller/customers", label: "Customers" },
  { href: "/reseller/branding", label: "Branding" },
  { href: "/reseller/entitlements", label: "Entitlements" },
];

export function ResellerNav() {
  const pathname = usePathname();
  return (
    <nav className="reseller-subnav">
      {LINKS.map((link) => {
        const active = link.href === "/reseller" ? pathname === "/reseller" : pathname.startsWith(link.href);
        return (
          <Link key={link.href} className={active ? "active" : undefined} href={link.href}>
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
