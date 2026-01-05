"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import BottomNav from "@/app/_components/BottomNav";
import { generateSkuOptionA } from "@/lib/sku";

type AppRole = "admin" | "sales" | "accountant" | null;

type Category = { id: string; name: string; is_active?: boolean };
type Item = {
  id: string;
  sku: string | null;
  name: string;
  type: "product" | "supply";
  unit: string;
  sale_price: number;
  low_stock_threshold: number;
  category_id: string | null;
  is_active?: boolean;
  categories?: { id: string; name: string } | null;
};

export default function ItemsPage() {
  const [authed, setAuthed] = useState(false);
  const [role, setRole] = useState<AppRole>(null);

  const isAdmin = role === "admin";
  const canWrite = isAdmin; // trang này: chỉ admin được sửa/ẩn/xoá/master data
  const canRead = role === "admin" || role === "accountant" || role === "sales";

  // SKU auto (Option A)
  const [autoSku, setAutoSku] = useState(true); // chỉ áp dụng khi CREATE
  const [skuTouched, setSkuTouched] = useState(false); // user đã tự gõ / chấp nhận SKU?

  // data
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);

  // UI toggles
  const [showInactive, setShowInactive] = useState(false);

  // form create category
  const [catName, setCatName] = useState("");

  // category edit
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editingCatName, setEditingCatName] = useState("");

  // form create/edit item
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const isEditingItem = !!editingItemId;

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

  const loadRole = async () => {
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes.user;
    if (!user) return;

    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      setRole(null);
      return;
    }
    setRole((data?.role as AppRole) ?? null);
  };

  const refresh = async () => {
    // categories
    // admin: có thể xem cả active/inactive (tuỳ toggle)
    // role khác: chỉ xem active (vì master data thường chỉ admin/accountant xem)
    let catQuery = supabase
      .from("categories")
      .select("id,name,is_active")
      .order("name");

    if (!showInactive) catQuery = catQuery.eq("is_active", true);

    const { data: c, error: cErr } = await catQuery;
    if (cErr) alert(cErr.message);
    else setCategories((c as Category[]) ?? []);

    // items
    let itemQuery = supabase
      .from("items")
      .select(
        "id,sku,name,type,unit,sale_price,low_stock_threshold,category_id,is_active,categories(id,name)"
      )
      .order("created_at", { ascending: false });

    if (!showInactive) itemQuery = itemQuery.eq("is_active", true);

    const { data: it, error: iErr } = await itemQuery;
    if (iErr) alert(iErr.message);
    else setItems((it as any) ?? []);
  };

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        window.location.href = "/login";
        return;
      }
      setAuthed(true);
      await loadRole();
      await refresh();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!authed) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showInactive]);

  const resetItemForm = () => {
    setEditingItemId(null);
    setType("product");
    setCategoryId("");
    setSku("");
    setName("");
    setUnit("cái");
    setSalePrice("0");
    setLowStock("0");
    // reset SKU auto
    setAutoSku(true);
    setSkuTouched(false);
  };

  const createCategory = async () => {
    if (!canWrite) return alert("Chỉ admin được tạo/sửa danh mục.");

    const n = catName.trim();
    if (!n) return alert("Nhập tên danh mục");

    const { error } = await supabase.from("categories").insert({
      name: n,
      is_active: true,
    });

    if (error) return alert(error.message);
    setCatName("");
    await refresh();
  };

  const startEditCategory = (c: Category) => {
    if (!canWrite) return alert("Chỉ admin được sửa danh mục.");
    setEditingCatId(c.id);
    setEditingCatName(c.name);
  };

  const cancelEditCategory = () => {
    setEditingCatId(null);
    setEditingCatName("");
  };

  const saveEditCategory = async () => {
    if (!canWrite) return alert("Chỉ admin được sửa danh mục.");
    if (!editingCatId) return;

    const n = editingCatName.trim();
    if (!n) return alert("Tên danh mục không được trống.");

    const { error } = await supabase
      .from("categories")
      .update({ name: n })
      .eq("id", editingCatId);

    if (error) return alert(error.message);

    cancelEditCategory();
    await refresh();
  };

  const hideCategory = async (id: string) => {
    if (!canWrite) return alert("Chỉ admin được ẩn danh mục.");
    if (!confirm("Ẩn danh mục này? (không xoá hẳn)")) return;

    const { error } = await supabase
      .from("categories")
      .update({ is_active: false })
      .eq("id", id);

    if (error) return alert(error.message);
    await refresh();
  };

  const startEditItem = (i: Item) => {
    if (!canWrite) return alert("Chỉ admin được sửa item.");
    setEditingItemId(i.id);
    setType(i.type);
    setCategoryId(i.category_id ?? "");
    setSku(i.sku ?? "");
    setName(i.name ?? "");
    setUnit(i.unit ?? "cái");
    setSalePrice(String(i.sale_price ?? 0));
    setLowStock(String(i.low_stock_threshold ?? 0));

    setSkuTouched(true); // edit mode: không auto đổi SKU

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const createOrUpdateItem = async () => {
    if (!canWrite) return alert("Chỉ admin được thêm/sửa item.");

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

    if (!editingItemId) {
      // CREATE
      const { error } = await supabase.from("items").insert(payload);
      if (error) return alert(error.message);
      resetItemForm();
      await refresh();
      return;
    }

    // UPDATE
    const { error } = await supabase
      .from("items")
      .update(payload)
      .eq("id", editingItemId);

    if (error) return alert(error.message);

    resetItemForm();
    await refresh();
  };

  const softHideItem = async (id: string) => {
    if (!canWrite) return alert("Chỉ admin được ẩn item.");
    if (!confirm("Ẩn item này? (không xoá hẳn)")) return;

    const { error } = await supabase
      .from("items")
      .update({ is_active: false })
      .eq("id", id);

    if (error) return alert(error.message);
    await refresh();
  };

  const genSku = async () => {
    const catName = categories.find((c) => c.id === categoryId)?.name;
    const n = name.trim();
    if (!catName || !n) {
      alert("Chọn danh mục và nhập tên trước.");
      return;
    }

    try {
      const nextSku = await generateSkuOptionA({
        categoryName: catName,
        itemName: n,
      });
      setSku(nextSku);
      setSkuTouched(true); // coi như user chấp nhận
    } catch (e: any) {
      alert(e?.message || "Không tạo được SKU");
    }
  };

  useEffect(() => {
    // chỉ auto khi:
    // - admin (canWrite)
    // - đang CREATE (không phải edit)
    // - autoSku bật
    // - user chưa đụng vào sku
    if (!canWrite) return;
    if (editingItemId) return;
    if (!autoSku) return;
    if (skuTouched) return;

    const catName = categories.find((c) => c.id === categoryId)?.name;
    const n = name.trim();
    if (!catName || !n) return;

    (async () => {
      try {
        const nextSku = await generateSkuOptionA({
          categoryName: catName,
          itemName: n,
        });
        setSku(nextSku);
      } catch (e: any) {
        console.warn(e?.message || e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    categoryId,
    name,
    autoSku,
    skuTouched,
    editingItemId,
    categories,
    canWrite,
  ]);

  const hardDeleteItem = async (id: string) => {
    if (!isAdmin) return alert("Chỉ admin được xoá item.");
    if (
      !confirm(
        "XOÁ THẬT item này? (không khôi phục). Nếu item đã phát sinh đơn/hàng tồn, có thể DB sẽ chặn."
      )
    )
      return;

    const { error } = await supabase.from("items").delete().eq("id", id);
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

  if (!canRead) {
    return (
      <div className="container">
        <div className="card" style={{ marginTop: 14 }}>
          <div className="card-h">
            <h2 className="h2">Không có quyền</h2>
          </div>
          <div className="card-b">
            <p className="p">
              Tài khoản của bạn chưa được gán role hợp lệ
              (admin/sales/accountant) hoặc bị chặn truy cập trang này.
            </p>
            <Link className="btn" href="/dashboard">
              ← Dashboard
            </Link>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="container">
      <div className="topbar">
        <div className="brand">
          <span>Sản phẩm & Vật tư</span>
          <span className="badge">Amora</span>
        </div>

        <div className="row">
          <Link className="btn" href="/dashboard">
            ← Dashboard
          </Link>
          <button className="btn" onClick={refresh}>
            ↻
          </button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="card-h">
          <div>
            <h2 className="h2">Quyền truy cập</h2>
            <p className="p">
              Role hiện tại: <b>{role ?? "(chưa có)"}</b>
              {!canWrite && (
                <span className="muted">
                  {" "}
                  • (Trang này chỉ admin được sửa/ẩn/xoá)
                </span>
              )}
            </p>
          </div>
          <label className="muted" style={{ display: "flex", gap: 8 }}>
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
            />
            Hiện cả dữ liệu đã ẩn
          </label>
        </div>
      </div>

      {/* CATEGORIES */}
      <div className="card" style={{ marginTop: 14 }}>
        <div className="card-h">
          <div>
            <h2 className="h2">Categories (Danh mục)</h2>
            <p className="p">Admin: tạo/sửa/ẩn • Accountant/Sales: xem</p>
          </div>
        </div>

        <div className="card-b">
          {canWrite && (
            <div className="grid" style={{ marginBottom: 12 }}>
              <div className="field" style={{ gridColumn: "span 10" }}>
                <div className="label">Tạo danh mục</div>
                <input
                  className="input"
                  placeholder="Ví dụ: Nến thơm / Gift set / Vật tư đóng gói..."
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                />
              </div>
              <div style={{ gridColumn: "span 2", display: "flex", gap: 10 }}>
                <button className="btn primary" onClick={createCategory}>
                  + Thêm
                </button>
              </div>
            </div>
          )}

          <div className="tableWrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Tên danh mục</th>
                  <th style={{ width: 140 }}>Trạng thái</th>
                  <th style={{ width: 220 }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((c) => {
                  const isCatEditing = editingCatId === c.id;
                  return (
                    <tr key={c.id}>
                      <td>
                        {isCatEditing ? (
                          <input
                            className="input"
                            value={editingCatName}
                            onChange={(e) => setEditingCatName(e.target.value)}
                          />
                        ) : (
                          <b>{c.name}</b>
                        )}
                      </td>
                      <td className="muted">
                        {c.is_active === false ? "Đã ẩn" : "Đang dùng"}
                      </td>
                      <td>
                        {canWrite ? (
                          <div
                            style={{
                              display: "flex",
                              gap: 10,
                              flexWrap: "wrap",
                            }}
                          >
                            {isCatEditing ? (
                              <>
                                <button
                                  className="btn primary"
                                  onClick={saveEditCategory}
                                >
                                  ✓ Lưu
                                </button>
                                <button
                                  className="btn"
                                  onClick={cancelEditCategory}
                                >
                                  Huỷ
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  className="btn"
                                  onClick={() => startEditCategory(c)}
                                >
                                  Sửa
                                </button>
                                {c.is_active !== false && (
                                  <button
                                    className="btn"
                                    onClick={() => hideCategory(c.id)}
                                  >
                                    Ẩn
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        ) : (
                          <span className="muted" style={{ fontSize: 12 }}>
                            (Chỉ admin)
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {categories.length === 0 && (
                  <tr>
                    <td colSpan={3} className="muted">
                      Chưa có danh mục.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ITEM FORM */}
      <div className="card" style={{ marginTop: 14 }}>
        <div className="card-h">
          <div>
            <h2 className="h2">
              {isEditingItem ? "Sửa item" : "Tạo sản phẩm/vật tư"}
            </h2>
            <p className="p">
              Vật tư không cần giá bán thì để 0. “Đơn vị” gõ gì cũng được (tự
              tạo).
            </p>
          </div>
        </div>

        <div className="card-b">
          {!canWrite ? (
            <p className="p muted">
              Bạn đang ở chế độ xem. Chỉ admin được tạo/sửa/ẩn/xoá.
            </p>
          ) : (
            <div className="grid">
              <div className="field" style={{ gridColumn: "span 3" }}>
                <div className="label">Loại</div>
                <select
                  className="input"
                  value={type}
                  onChange={(e) => setType(e.target.value as any)}
                >
                  <option value="product">Thành phẩm (bán)</option>
                  <option value="supply">Vật tư (tem, hộp...)</option>
                </select>
              </div>

              <div className="field" style={{ gridColumn: "span 3" }}>
                <div className="label">Danh mục</div>
                <select
                  className="input"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                >
                  <option value="">(Chưa chọn)</option>
                  {categories
                    .filter((c) => c.is_active !== false) // form chỉ chọn danh mục đang active
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </div>

              <div className="field" style={{ gridColumn: "span 3" }}>
                <div className="label">SKU (tuỳ chọn)</div>
                <input
                  className="input"
                  value={sku}
                  onChange={(e) => {
                    setSku(e.target.value);
                    setSkuTouched(true);
                  }}
                />
              </div>
              {/* SKU tools */}
              <div
                style={{
                  gridColumn: "span 12",
                  display: "flex",
                  gap: 12,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                {!editingItemId && (
                  <label className="muted" style={{ display: "flex", gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={autoSku}
                      onChange={(e) => setAutoSku(e.target.checked)}
                    />
                    Auto SKU (Option A)
                  </label>
                )}

                <button className="btn" type="button" onClick={genSku}>
                  ✨ Tạo SKU
                </button>

                {!editingItemId && (
                  <span className="muted" style={{ fontSize: 12 }}>
                    Format: PREFIX-TEN-001 (VD: NT-LAV200G-001)
                  </span>
                )}
              </div>

              <div className="field" style={{ gridColumn: "span 3" }}>
                <div className="label">Đơn vị</div>
                <input
                  className="input"
                  list="units"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="cái/tờ/cuộn..."
                />
                <datalist id="units">
                  {units.map((u) => (
                    <option key={u} value={u} />
                  ))}
                </datalist>
              </div>

              <div className="field" style={{ gridColumn: "span 6" }}>
                <div className="label">Tên</div>
                <input
                  className="input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="field" style={{ gridColumn: "span 3" }}>
                <div className="label">Giá bán</div>
                <input
                  className="input"
                  type="number"
                  value={salePrice}
                  onChange={(e) => setSalePrice(e.target.value)}
                />
              </div>

              <div className="field" style={{ gridColumn: "span 3" }}>
                <div className="label">Tồn tối thiểu</div>
                <input
                  className="input"
                  type="number"
                  value={lowStock}
                  onChange={(e) => setLowStock(e.target.value)}
                />
              </div>

              <div
                style={{
                  gridColumn: "span 12",
                  display: "flex",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <button className="btn primary" onClick={createOrUpdateItem}>
                  {isEditingItem ? "✓ Cập nhật" : "+ Thêm item"}
                </button>
                {isEditingItem && (
                  <button className="btn" onClick={resetItemForm}>
                    Huỷ
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* FILTERS */}
      <div className="card" style={{ marginTop: 14 }}>
        <div className="card-h">
          <div>
            <h2 className="h2">Danh sách items</h2>
            <p className="p">{filtered.length} item</p>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <select
              className="input"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              style={{ width: 160 }}
            >
              <option value="all">Tất cả</option>
              <option value="product">Thành phẩm</option>
              <option value="supply">Vật tư</option>
            </select>

            <input
              className="input"
              placeholder="Tìm theo tên/SKU/danh mục..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={{ width: 320 }}
            />
          </div>
        </div>

        <div className="card-b" style={{ padding: 0 }}>
          <div className="tableWrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Tên</th>
                  <th>Loại</th>
                  <th>Danh mục</th>
                  <th>SKU</th>
                  <th>Đơn vị</th>
                  <th className="right">Giá bán</th>
                  <th className="right">Tồn tối thiểu</th>
                  <th style={{ width: 260 }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((i) => (
                  <tr key={i.id}>
                    <td>
                      <b>{i.name}</b>
                      {i.is_active === false && (
                        <span className="muted" style={{ marginLeft: 8 }}>
                          (đã ẩn)
                        </span>
                      )}
                    </td>
                    <td className="muted">
                      {i.type === "product" ? "Thành phẩm" : "Vật tư"}
                    </td>
                    <td className="muted">{i.categories?.name ?? "-"}</td>
                    <td className="muted">{i.sku ?? "-"}</td>
                    <td className="muted">{i.unit}</td>
                    <td className="right">
                      {Number(i.sale_price ?? 0).toLocaleString()}
                    </td>
                    <td className="right">
                      {Number(i.low_stock_threshold ?? 0).toLocaleString()}
                    </td>

                    <td>
                      {canWrite ? (
                        <div
                          style={{ display: "flex", gap: 10, flexWrap: "wrap" }}
                        >
                          <button
                            className="btn"
                            onClick={() => startEditItem(i)}
                          >
                            Sửa
                          </button>

                          {i.is_active !== false && (
                            <button
                              className="btn"
                              onClick={() => softHideItem(i.id)}
                            >
                              Ẩn
                            </button>
                          )}

                          {isAdmin && (
                            <button
                              className="btn"
                              onClick={() => hardDeleteItem(i.id)}
                            >
                              Xoá
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="muted" style={{ fontSize: 12 }}>
                          (Chỉ admin)
                        </span>
                      )}
                    </td>
                  </tr>
                ))}

                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="muted">
                      Chưa có dữ liệu. Hãy tạo danh mục và thêm item.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Không phân trang ở trang này (đang load all). Nếu muốn phân trang mình làm tiếp. */}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
