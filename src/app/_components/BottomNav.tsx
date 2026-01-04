"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/orders", label: "Đơn" },
  { href: "/inventory", label: "Kho" },
  { href: "/items", label: "Items" },
  { href: "/expenses", label: "Chi phí" },
  { href: "/customers", label: "Khách hàng" },
  { href: "/campaigns", label: "Campaigns" },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <div className="bottomNav">
      <div className="wrap">
        {tabs.map((t) => {
          const active =
            pathname === t.href || pathname.startsWith(t.href + "/");
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`navItem ${active ? "active" : ""}`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
