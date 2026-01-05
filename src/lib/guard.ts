import type { AppRole } from "@/lib/getRole";

export function canSeeMenu(role: AppRole, key: string) {
  if (role === "admin") return true;

  if (role === "sales") {
    return ["dashboard", "orders", "customers"].includes(key);
  }

  if (role === "accountant") {
    // kế toán thấy hết trừ user/admin page
    return [
      "dashboard",
      "orders",
      "customers",
      "items",
      "inventory",
      "expenses",
      "campaigns",
    ].includes(key);
  }

  return false;
}

export function canDelete(role: AppRole, table: string) {
  // expenses: không ai xóa
  if (table === "expenses") return false;
  return role === "admin";
}
