"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type Category = { id: string; name: string };
type Item = {
  id: string;
  sku: string | null;
  name: string;
  type: "product" | "supply";
  unit: string;
  sale_price: number;
  low_stock_threshold: number;
  category_id: string | null;
  categories?: Category | null;
};

export default function ItemsPage() {
  const [authed, setAuthed] = useState(false);

  // data
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);

  // form create category
  const [catName, setCatName] = useState("");

  // form create item
  const [type, setType] = useState<"product" | "supply">("product");
  const [categoryId, setCategoryId] = useState<string>("");
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("cái");
  const [salePrice, setSalePrice] = useState("0");
  const [lowStock, setLowStock] = useState("0");

  // filters
  const [filterType, setFilterType] = useState<"all" | "product" | "supply">(
    "all"
  );
  const [q, setQ] = useState("");

  const units = useMemo(() => {
    // lấy unit từ items để “tự tạo” theo thực tế bạn nhập
    const set = new Set<string>([
      "cái",
      "hộp",
      "tờ",
      "cuộn",
      "chai",
      "gram",
      "ml",
    ]);
    items.forEach((i) => set.add(i.unit));
    return Array.from(set).sort();
  }, [items]);

  const refresh = async () => {
    // categories
    const { data: c, error: cErr } = await supabase
      .from("categories")
      .select("id,name")
      .eq("is_active", true)
      .order("name");
    if (cErr) alert(cErr.message);
    else setCategories(c ?? []);

    // items
    const { data: it, error: iErr } = await supabase
      .from("items")
      .select(
        "id,sku,name,type,unit,sale_price,low_stock_threshold,category_id,categories(id,name)"
      )
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (iErr) alert(iErr.message);
    else setItems((it as any) ?? []);
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) window.location.href = "/login";
      else {
        setAuthed(true);
        refresh();
      }
    });
  }, []);

  const createCategory = async () => {
    const n = catName.trim();
    if (!n) return alert("Nhập tên danh mục");
    const { error } = await supabase.from("categories").insert({ name: n });
    if (error) return alert(error.message);
    setCatName("");
    await refresh();
  };

  const createItem = async () => {
    const n = name.trim();
    if (!n) return alert("Nhập tên sản phẩm/vật tư");

    const payload: any = {
      type,
      name: n,
      sku: sku.trim() || null,
      unit: unit.trim() || "cái",
      sale_price: Number(salePrice || 0),
      low_stock_threshold: Number(lowStock || 0),
      category_id: categoryId || null,
    };

    // supply không cần sale_price, nhưng để 0 vẫn ok
    const { error } = await supabase.from("items").insert(payload);
    if (error) return alert(error.message);

    setSku("");
    setName("");
    setSalePrice("0");
    setLowStock("0");
    await refresh();
  };

  const softDeleteItem = async (id: string) => {
    if (!confirm("Ẩn item này? (không xoá hẳn)")) return;
    const { error } = await supabase
      .from("items")
      .update({ is_active: false })
      .eq("id", id);
    if (error) return alert(error.message);
    await refresh();
  };

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return items.filter((i) => {
      const okType = filterType === "all" ? true : i.type === filterType;
      const okQ =
        !qq ||
        i.name.toLowerCase().includes(qq) ||
        (i.sku ?? "").toLowerCase().includes(qq) ||
        (i.categories?.name ?? "").toLowerCase().includes(qq);
      return okType && okQ;
    });
  }, [items, filterType, q]);

  if (!authed) return null;

  return (
    <div style={{ maxWidth: 980, margin: "24px auto", padding: 16 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
        }}
      >
        <h2>Sản phẩm & Vật tư</h2>
        <Link href="/dashboard">← Dashboard</Link>
      </div>

      {/* Create category */}
      <div
        style={{
          border: "1px solid #eee",
          borderRadius: 12,
          padding: 12,
          marginTop: 12,
        }}
      >
        <h3 style={{ marginTop: 0 }}>Tạo danh mục</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            placeholder="Ví dụ: Nến thơm / Gift set / Vật tư đóng gói..."
            value={catName}
            onChange={(e) => setCatName(e.target.value)}
            style={{ flex: 1, minWidth: 260, padding: 10 }}
          />
          <button onClick={createCategory} style={{ padding: "10px 14px" }}>
            + Thêm danh mục
          </button>
        </div>
      </div>

      {/* Create item */}
      <div
        style={{
          border: "1px solid #eee",
          borderRadius: 12,
          padding: 12,
          marginTop: 12,
        }}
      >
        <h3 style={{ marginTop: 0 }}>Tạo sản phẩm/vật tư</h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(6, 1fr)",
            gap: 8,
          }}
        >
          <label style={{ gridColumn: "span 2" }}>
            Loại
            <select
              value={type}
              onChange={(e) => setType(e.target.value as any)}
              style={{ width: "100%", padding: 10 }}
            >
              <option value="product">Thành phẩm (bán)</option>
              <option value="supply">Vật tư (giấy in, tem, hộp...)</option>
            </select>
          </label>

          <label style={{ gridColumn: "span 2" }}>
            Danh mục
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              style={{ width: "100%", padding: 10 }}
            >
              <option value="">(Chưa chọn)</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <label style={{ gridColumn: "span 2" }}>
            SKU (tuỳ chọn)
            <input
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              style={{ width: "100%", padding: 10 }}
            />
          </label>

          <label style={{ gridColumn: "span 3" }}>
            Tên
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ width: "100%", padding: 10 }}
            />
          </label>

          <label style={{ gridColumn: "span 1" }}>
            Đơn vị
            <input
              list="units"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="cái/tờ/cuộn..."
              style={{ width: "100%", padding: 10 }}
            />
            <datalist id="units">
              {units.map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
          </label>

          <label style={{ gridColumn: "span 1" }}>
            Giá bán
            <input
              type="number"
              value={salePrice}
              onChange={(e) => setSalePrice(e.target.value)}
              style={{ width: "100%", padding: 10 }}
            />
          </label>

          <label style={{ gridColumn: "span 1" }}>
            Tồn tối thiểu
            <input
              type="number"
              value={lowStock}
              onChange={(e) => setLowStock(e.target.value)}
              style={{ width: "100%", padding: 10 }}
            />
          </label>

          <div style={{ gridColumn: "span 6" }}>
            <button onClick={createItem} style={{ padding: "10px 14px" }}>
              + Thêm item
            </button>
          </div>
        </div>
        <p style={{ marginBottom: 0, color: "#666" }}>
          * “Đơn vị” bạn gõ gì cũng được (tự tạo). Vật tư không cần giá bán thì
          để 0.
        </p>
      </div>

      {/* Filters */}
      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          alignItems: "center",
          marginTop: 16,
        }}
      >
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as any)}
          style={{ padding: 10 }}
        >
          <option value="all">Tất cả</option>
          <option value="product">Thành phẩm</option>
          <option value="supply">Vật tư</option>
        </select>
        <input
          placeholder="Tìm theo tên/SKU/danh mục..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ flex: 1, minWidth: 260, padding: 10 }}
        />
        <button onClick={refresh} style={{ padding: "10px 14px" }}>
          ↻ Tải lại
        </button>
      </div>

      {/* List */}
      <div
        style={{
          marginTop: 12,
          border: "1px solid #eee",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ background: "#fafafa" }}>
            <tr>
              <th style={{ textAlign: "left", padding: 10 }}>Tên</th>
              <th style={{ textAlign: "left", padding: 10 }}>Loại</th>
              <th style={{ textAlign: "left", padding: 10 }}>Danh mục</th>
              <th style={{ textAlign: "left", padding: 10 }}>SKU</th>
              <th style={{ textAlign: "left", padding: 10 }}>Đơn vị</th>
              <th style={{ textAlign: "right", padding: 10 }}>Giá bán</th>
              <th style={{ textAlign: "right", padding: 10 }}>Tồn tối thiểu</th>
              <th style={{ textAlign: "right", padding: 10 }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((i) => (
              <tr key={i.id} style={{ borderTop: "1px solid #f0f0f0" }}>
                <td style={{ padding: 10 }}>{i.name}</td>
                <td style={{ padding: 10 }}>
                  {i.type === "product" ? "Thành phẩm" : "Vật tư"}
                </td>
                <td style={{ padding: 10 }}>{i.categories?.name ?? "-"}</td>
                <td style={{ padding: 10 }}>{i.sku ?? "-"}</td>
                <td style={{ padding: 10 }}>{i.unit}</td>
                <td style={{ padding: 10, textAlign: "right" }}>
                  {Number(i.sale_price ?? 0).toLocaleString()}
                </td>
                <td style={{ padding: 10, textAlign: "right" }}>
                  {Number(i.low_stock_threshold ?? 0).toLocaleString()}
                </td>
                <td style={{ padding: 10, textAlign: "right" }}>
                  <button
                    onClick={() => softDeleteItem(i.id)}
                    style={{ padding: "6px 10px" }}
                  >
                    Ẩn
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} style={{ padding: 12, color: "#666" }}>
                  Chưa có dữ liệu. Hãy tạo danh mục và thêm item.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
