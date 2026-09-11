"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const navigation = [
  { href: "/", label: "Overview", short: "01" },
  { href: "/articles", label: "Articles", short: "02" },
  { href: "/imports", label: "Supplier Import", short: "03" },
  { href: "/orders", label: "Orders", short: "04" },
  { href: "/offers", label: "Offers", short: "05" },
  { href: "/requests", label: "Customer Requests", short: "06" },
  { href: "/reviews", label: "Product Reviews", short: "07" },
  { href: "/settings", label: "Shop Settings", short: "08" },
];

const storefrontUrl = process.env.NEXT_PUBLIC_STOREFRONT_URL || "http://127.0.0.1:4321";

function NavigationLinks({ onMobile = false }: { onMobile?: boolean }) {
  const pathname = usePathname();

  return (
    <nav className={onMobile ? "admin-mobile-links" : "admin-side-links"} aria-label="Store Manager">
      {navigation.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link href={item.href} aria-current={active ? "page" : undefined} key={item.href}>
            <span>{item.short}</span>
            <strong>{item.label}</strong>
          </Link>
        );
      })}
    </nav>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/signin") return children;

  async function signOut() {
    await fetch("/api/admin/session", { method: "DELETE" });
    window.location.href = "/signin";
  }
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link className="admin-brand" href="/" aria-label="Haley Wali Store Manager home">
          <span>
            <strong>HALEY WALI</strong>
            <small>STORE MANAGER</small>
          </span>
        </Link>

        <NavigationLinks />

        <div className="admin-sidebar-footer">
          <span>SHOP STATUS</span>
          <strong><i aria-hidden="true"></i> PRIVATE MANAGER</strong>
          <a href={storefrontUrl} target="_blank" rel="noreferrer">
            OPEN CUSTOMER SHOP <b aria-hidden="true">↗</b>
          </a>
          <button className="admin-signout" type="button" onClick={signOut}>SIGN OUT</button>
        </div>
      </aside>

      <div className="admin-workspace">
        <header className="admin-mobile-header">
          <Link href="/">HALEY WALI</Link>
          <details>
            <summary>MENU</summary>
            <NavigationLinks onMobile />
          </details>
        </header>
        {children}
      </div>
    </div>
  );
}
