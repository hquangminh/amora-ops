export type AppRole = "admin" | "sales" | "accountant";

export const canSeeAdmin = (r: AppRole | null) => r === "admin";
export const canSeeOps = (r: AppRole | null) =>
  r === "admin" || r === "accountant";
export const canSeeSales = (r: AppRole | null) =>
  r === "admin" || r === "sales";
export const canEditOrders = (r: AppRole | null) =>
  r === "admin" || r === "sales";
export const canEditCustomers = (r: AppRole | null) =>
  r === "admin" || r === "sales";
export const canEditExpenses = (r: AppRole | null) =>
  r === "admin" || r === "accountant";
export const canEditMaster = (r: AppRole | null) => r === "admin";
