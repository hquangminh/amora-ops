"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getMyRole, type AppRole } from "@/lib/getRole";
import { canSeeMenu } from "@/lib/guard";

export default function BottomNav() {
  const pathname = usePathname();
  const [role, setRole] = useState<AppRole | null>(null);

  useEffect(() => {
    getMyRole().then(setRole);
  }, []);

  const items = [
    { key: "dashboard", href: "/dashboard", label: "Dashboard" },
    { key: "orders", href: "/orders", label: "Đơn" },
    { key: "inventory", href: "/inventory", label: "Kho" },
    { key: "items", href: "/items", label: "Items" },
    { key: "expenses", href: "/expenses", label: "Chi phí" },
    { key: "customers", href: "/customers", label: "Khách" },
    { key: "campaigns", href: "/campaigns", label: "Campaigns" },
    { key: "admin", href: "/admin", label: "Admin" },
  ] as const;

  // Role chưa có => chưa show BottomNav (hoặc show skeleton)
  if (!role) return null;

  const visible = items.filter((it) => {
    if (it.key === "admin") return role === "admin";
    return canSeeMenu(role, it.key);
  });

  return (
    <div className="bottomNav">
      <div className="wrap">
        {visible.map((it) => {
          const active =
            pathname === it.href || pathname.startsWith(it.href + "/");
          return (
            <Link
              key={it.key}
              className={`navItem ${active ? "active" : ""}`}
              href={it.href}
            >
              {it.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
