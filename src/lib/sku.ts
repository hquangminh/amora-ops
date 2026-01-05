// src/lib/sku.ts
import { supabase } from "@/lib/supabaseClient";

/**
 * OPTION A format:
 *   PREFIX-SLUG-001
 * Ví dụ:
 *   NT-LAV200G-001
 *   VT-HOPGIAY-001
 *
 * - PREFIX: từ danh mục (map cố định nếu có) hoặc lấy chữ cái đầu của 1-2 từ
 * - SLUG: từ tên item (bỏ dấu, uppercase, chỉ A-Z0-9, bỏ khoảng trắng), giới hạn 12 ký tự
 * - 001: auto tăng theo base (PREFIX-SLUG)
 */

const CAT_PREFIX: Record<string, string> = {
  "Nến Thơm": "NT",
  "Nen Thom": "NT",
  "Gift set": "GS",
  "Gift Set": "GS",
  "Vật tư": "VT",
  "Vat tu": "VT",
  "Vật tư đóng gói": "DG",
  "Vat tu dong goi": "DG",
};

function stripVietnamese(input: string) {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

export function makePrefixFromCategory(categoryName?: string) {
  const n = (categoryName || "").trim();
  if (!n) return "SP";

  // map cố định trước
  if (CAT_PREFIX[n]) return CAT_PREFIX[n];

  const parts = stripVietnamese(n).split(/\s+/).filter(Boolean);

  // lấy 2 chữ cái đầu của 2 từ đầu tiên
  const p = (parts[0]?.[0] || "") + (parts[1]?.[0] || "");
  return (p || parts[0]?.slice(0, 2) || "SP").toUpperCase();
}

export function makeSlugFromName(name?: string) {
  const raw = stripVietnamese((name || "").trim()).toUpperCase();

  // chỉ giữ chữ/số/khoảng trắng/dấu -
  const cleaned = raw.replace(/[^A-Z0-9\s-]/g, "");

  // bỏ khoảng trắng và dấu -, gộp lại thành 1 chuỗi gọn
  const slug = cleaned.replace(/[\s-]+/g, "");

  // giới hạn độ dài để SKU gọn
  return slug.slice(0, 12) || "ITEM";
}

export async function generateSkuOptionA(params: {
  categoryName?: string;
  itemName?: string;
}) {
  const prefix = makePrefixFromCategory(params.categoryName);
  const slug = makeSlugFromName(params.itemName);

  const base = `${prefix}-${slug}`; // base để tìm suffix
  // tìm SKU lớn nhất của base này, ví dụ NT-LAV200G-009 => next = 010

  const { data, error } = await supabase
    .from("items")
    .select("sku")
    .ilike("sku", `${base}-%`)
    .order("sku", { ascending: false })
    .limit(1);

  if (error) throw error;

  const lastSku = (data?.[0]?.sku || "") as string;
  let nextNum = 1;

  if (lastSku) {
    const parts = lastSku.split("-");
    const tail = parts[parts.length - 1];
    const n = Number.parseInt(tail, 10);
    if (Number.isFinite(n)) nextNum = n + 1;
  }

  const suffix = String(nextNum).padStart(3, "0");
  return `${base}-${suffix}`;
}
