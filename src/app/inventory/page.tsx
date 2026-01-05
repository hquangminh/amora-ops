"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import BottomNav from "@/app/_components/BottomNav";

type AppRole = "admin" | "sales" | "accountant" | null;

type Category = { id: string; name: string; is_active?: boolean };

type Item = {
  id: string;
  name: string;
  type: "product" | "supply";
  unit: string;
  category_id: string | null;
  categories?: { id: string; name: string } | null;
};

type Batch = {
  id: string;
  received_date: string;
  qty_received: number;
  qty_remaining: number;
  unit_cost: number;
  supplier_name: string | null;
  note: string | null;
  item_id: string;
  created_at?: string;
  items?: Item | null;
};

export default function InventoryPage() {
  const [authed, setAuthed] = useState(false);
  const [role, setRole] = useState<AppRole>(null);

  const isAdmin = role === "admin";
  const canRead = role === "admin" || role === "sales" || role === "accountant";
  const canWrite = isAdmin; // inventory_batches: chỉ admin được sửa/xoá/tạo

  // data
  const [items, setItems] = useState<Item[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);

  // UI filters
  const [onlyRemaining, setOnlyRemaining] = useState(true); // chỉ xem lô còn hàng
  const [q, setQ] = useState(""); // search theo item / ncc / note

  // form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const isEditing = !!editingId;

  const [itemId, setItemId] = useState("");
  const [receivedDate, setReceivedDate] = useState<string>(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [qty, setQty] = useState("1");
  const [unitCost, setUnitCost] = useState("0");
  const [supplier, setSupplier] = useState("");
  const [note, setNote] = useState("");

  const selectedItem = useMemo(
    () => items.find((i) => i.id === itemId),
    [items, itemId]
  );

  const loadRole = async () => {
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes.user;
    if (!user) return;

    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) return setRole(null);
    setRole((data?.role as AppRole) ?? null);
  };

  const refresh = async () => {
    // items (chỉ active)
    const { data: it, error: itErr } = await supabase
      .from("items")
      .select("id,name,type,unit,category_id,categories(id,name)")
      .eq("is_active", true)
      .order("name");

    if (itErr) alert(itErr.message);
    else setItems((it as any) ?? []);

    // batches
    // - nếu onlyRemaining: chỉ lấy lô còn > 0 (để tính tổng tồn kho chuẩn hơn)
    // - nếu không: lấy lịch sử (limit) để xem log
    let query = supabase
      .from("inventory_batches")
      .select(
        "id,received_date,qty_received,qty_remaining,unit_cost,supplier_name,note,item_id,created_at,items(id,name,type,unit,category_id,categories(id,name))"
      )
      .order("created_at", { ascending: false })
      .limit(200);

    if (onlyRemaining) query = query.gt("qty_remaining", 0);

    const { data: ba, error: bErr } = await query;

    if (bErr) alert(bErr.message);
    else setBatches((ba as any) ?? []);
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
  }, [onlyRemaining]);

  const resetForm = () => {
    setEditingId(null);
    setItemId("");
    setReceivedDate(new Date().toISOString().slice(0, 10));
    setQty("1");
    setUnitCost("0");
    setSupplier("");
    setNote("");
  };

  const createOrUpdateBatch = async () => {
    if (!canWrite) return alert("Chỉ admin được thao tác kho.");
    if (!itemId) return alert("Chọn item");

    const qNum = Number(qty);
    const cNum = Number(unitCost);

    if (!(qNum > 0)) return alert("Số lượng phải > 0");
    if (cNum < 0) return alert("Giá nhập không được âm");

    if (!editingId) {
      // CREATE
      const { error } = await supabase.from("inventory_batches").insert({
        item_id: itemId,
        received_date: receivedDate,
        qty_received: qNum,
        qty_remaining: qNum,
        unit_cost: cNum,
        supplier_name: supplier.trim() || null,
        note: note.trim() || null,
      });

      if (error) return alert(error.message);
      resetForm();
      await refresh();
      return;
    }

    // UPDATE (giữ qty_remaining như cũ để không làm sai tồn nếu đã xuất)
    const current = batches.find((b) => b.id === editingId);
    const currentRemaining = Number(current?.qty_remaining ?? 0);

    if (currentRemaining > qNum) {
      return alert(
        "Không thể giảm số lượng nhập thấp hơn số lượng còn trong lô.\nHãy nhập qty_received >= qty_remaining hiện tại."
      );
    }

    const { error } = await supabase
      .from("inventory_batches")
      .update({
        item_id: itemId,
        received_date: receivedDate,
        qty_received: qNum,
        qty_remaining: currentRemaining,
        unit_cost: cNum,
        supplier_name: supplier.trim() || null,
        note: note.trim() || null,
      })
      .eq("id", editingId);

    if (error) return alert(error.message);

    resetForm();
    await refresh();
  };

  const startEdit = (b: Batch) => {
    if (!canWrite) return alert("Chỉ admin được sửa lô.");

    setEditingId(b.id);
    setItemId(b.item_id);
    setReceivedDate(b.received_date);
    setQty(String(b.qty_received));
    setUnitCost(String(b.unit_cost ?? 0));
    setSupplier(b.supplier_name ?? "");
    setNote(b.note ?? "");

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deleteBatch = async (id: string) => {
    if (!canWrite) return alert("Chỉ admin được xoá lô.");

    const b = batches.find((x) => x.id === id);
    const remain = Number(b?.qty_remaining ?? 0);
    const received = Number(b?.qty_received ?? 0);

    if (
      !confirm(
        `XOÁ lô này?\n- Nhập: ${received}\n- Còn: ${remain}\n\nNếu lô đã được dùng (đã trừ tồn), xoá sẽ làm sai số liệu hoặc DB có thể chặn.`
      )
    )
      return;

    const { error } = await supabase
      .from("inventory_batches")
      .delete()
      .eq("id", id);

    if (error) return alert(error.message);

    if (editingId === id) resetForm();
    await refresh();
  };

  // Filter search (client-side)
  const filteredBatches = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return batches;

    return batches.filter((b) => {
      const itemName = (b.items?.name ?? "").toLowerCase();
      const supplierName = (b.supplier_name ?? "").toLowerCase();
      const noteText = (b.note ?? "").toLowerCase();
      const catName = (b.items?.categories?.name ?? "").toLowerCase();
      return (
        itemName.includes(qq) ||
        supplierName.includes(qq) ||
        noteText.includes(qq) ||
        catName.includes(qq)
      );
    });
  }, [batches, q]);

  // Summary: tổng tồn + giá trị tồn (theo qty_remaining)
  const summary = useMemo(() => {
    let totalQty = 0;
    let totalValue = 0;

    let productQty = 0;
    let productValue = 0;
    let supplyQty = 0;
    let supplyValue = 0;

    const byCategory = new Map<
      string,
      { name: string; qty: number; value: number }
    >();

    for (const b of filteredBatches) {
      const remain = Number(b.qty_remaining || 0);
      const cost = Number(b.unit_cost || 0);
      const value = remain * cost;

      totalQty += remain;
      totalValue += value;

      const t = b.items?.type;
      if (t === "product") {
        productQty += remain;
        productValue += value;
      } else if (t === "supply") {
        supplyQty += remain;
        supplyValue += value;
      }

      const catId = b.items?.category_id ?? "no_cat";
      const catName = b.items?.categories?.name ?? "(Chưa phân danh mục)";

      const cur = byCategory.get(catId);
      if (!cur) byCategory.set(catId, { name: catName, qty: remain, value });
      else {
        cur.qty += remain;
        cur.value += value;
      }
    }

    const categoryRows = Array.from(byCategory.entries())
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.value - a.value);

    // Footer totals for table
    let sumReceived = 0;
    let sumRemaining = 0;
    let sumReceivedValue = 0;
    let sumRemainingValue = 0;

    for (const b of filteredBatches) {
      const rcv = Number(b.qty_received || 0);
      const rem = Number(b.qty_remaining || 0);
      const cost = Number(b.unit_cost || 0);
      sumReceived += rcv;
      sumRemaining += rem;
      sumReceivedValue += rcv * cost;
      sumRemainingValue += rem * cost;
    }

    return {
      totalQty,
      totalValue,
      productQty,
      productValue,
      supplyQty,
      supplyValue,
      categoryRows,
      footer: {
        sumReceived,
        sumRemaining,
        sumReceivedValue,
        sumRemainingValue,
      },
    };
  }, [filteredBatches]);

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
          <span>Kho</span>
          <span className="badge">Nhập lô</span>
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

      {/* PERMISSION */}
      <div className="card" style={{ marginTop: 14 }}>
        <div className="card-h">
          <div>
            <h2 className="h2">Quyền truy cập</h2>
            <p className="p">
              Role hiện tại: <b>{role ?? "(chưa có)"}</b>
              {!canWrite && (
                <span className="muted">
                  {" "}
                  • (Chỉ admin được tạo/sửa/xoá lô)
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* SUMMARY */}
      <div className="card" style={{ marginTop: 14 }}>
        <div className="card-h" style={{ justifyContent: "space-between" }}>
          <div>
            <h2 className="h2">Tổng tồn kho</h2>
            <p className="p">
              Tính theo <b>qty_remaining</b> (tồn hiện tại)
            </p>
          </div>

          <label className="muted" style={{ display: "flex", gap: 8 }}>
            <input
              type="checkbox"
              checked={onlyRemaining}
              onChange={(e) => setOnlyRemaining(e.target.checked)}
            />
            Chỉ xem lô còn hàng
          </label>
        </div>

        <div className="card-b">
          <div className="grid">
            <div className="field" style={{ gridColumn: "span 4" }}>
              <div className="label">Tổng số lượng còn</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>
                {summary.totalQty.toLocaleString()}
              </div>
            </div>

            <div className="field" style={{ gridColumn: "span 4" }}>
              <div className="label">Giá trị tồn kho</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>
                {summary.totalValue.toLocaleString()}
              </div>
            </div>

            <div className="field" style={{ gridColumn: "span 4" }}>
              <div className="label">Theo loại</div>
              <div className="muted" style={{ fontSize: 13, lineHeight: 1.5 }}>
                Thành phẩm: <b>{summary.productQty.toLocaleString()}</b> •{" "}
                {summary.productValue.toLocaleString()}
                <br />
                Vật tư: <b>{summary.supplyQty.toLocaleString()}</b> •{" "}
                {summary.supplyValue.toLocaleString()}
              </div>
            </div>

            <div className="field" style={{ gridColumn: "span 12" }}>
              <div className="label">Theo danh mục</div>
              <div className="tableWrap" style={{ marginTop: 8 }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Danh mục</th>
                      <th className="right">Tổng còn</th>
                      <th className="right">Giá trị tồn</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.categoryRows.map((r) => (
                      <tr key={r.id}>
                        <td>
                          <b>{r.name}</b>
                        </td>
                        <td className="right">{r.qty.toLocaleString()}</td>
                        <td className="right">{r.value.toLocaleString()}</td>
                      </tr>
                    ))}
                    {summary.categoryRows.length === 0 && (
                      <tr>
                        <td colSpan={3} className="muted">
                          Chưa có dữ liệu.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
                * Tổng này đang tính theo dữ liệu đang load trên trang. Nếu bạn
                muốn “chuẩn toàn kho”, mình sẽ làm RPC/view để tính nhanh và
                đúng tuyệt đối.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CREATE / EDIT */}
      <div className="card" style={{ marginTop: 14 }}>
        <div className="card-h">
          <div>
            <h2 className="h2">
              {isEditing ? "Sửa lô nhập" : "Nhập kho theo lô"}
            </h2>
            <p className="p">Nhập theo lô để có giá nhập (unit cost).</p>
          </div>
        </div>

        <div className="card-b">
          {!canWrite ? (
            <p className="p muted">
              Bạn đang ở chế độ xem. Chỉ admin được tạo/sửa/xoá lô nhập.
            </p>
          ) : (
            <div className="grid">
              <div className="field" style={{ gridColumn: "span 6" }}>
                <div className="label">Item</div>
                <select
                  className="input"
                  value={itemId}
                  onChange={(e) => setItemId(e.target.value)}
                >
                  <option value="">(Chọn item)</option>
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} —{" "}
                      {i.type === "product" ? "Thành phẩm" : "Vật tư"} ({i.unit}
                      ){i.categories?.name ? ` • ${i.categories.name}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field" style={{ gridColumn: "span 2" }}>
                <div className="label">Ngày nhập</div>
                <input
                  className="input"
                  type="date"
                  value={receivedDate}
                  onChange={(e) => setReceivedDate(e.target.value)}
                />
              </div>

              <div className="field" style={{ gridColumn: "span 2" }}>
                <div className="label">Số lượng nhập</div>
                <input
                  className="input"
                  type="number"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                />
              </div>

              <div className="field" style={{ gridColumn: "span 2" }}>
                <div className="label">Giá nhập/đơn vị</div>
                <input
                  className="input"
                  type="number"
                  value={unitCost}
                  onChange={(e) => setUnitCost(e.target.value)}
                />
              </div>

              <div className="field" style={{ gridColumn: "span 4" }}>
                <div className="label">Nhà cung cấp (tuỳ chọn)</div>
                <input
                  className="input"
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                />
              </div>

              <div className="field" style={{ gridColumn: "span 8" }}>
                <div className="label">Ghi chú (tuỳ chọn)</div>
                <input
                  className="input"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>

              <div
                style={{
                  gridColumn: "span 12",
                  display: "flex",
                  gap: 10,
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                <button className="btn primary" onClick={createOrUpdateBatch}>
                  {isEditing ? "✓ Cập nhật lô" : "+ Tạo lô nhập"}
                </button>

                {isEditing && (
                  <button className="btn" onClick={resetForm}>
                    Huỷ
                  </button>
                )}

                {selectedItem && (
                  <span className="muted">
                    Đang thao tác cho: <b>{selectedItem.name}</b> (
                    {selectedItem.unit})
                  </span>
                )}
              </div>

              {isEditing && (
                <div style={{ gridColumn: "span 12" }}>
                  <p className="muted" style={{ fontSize: 12, margin: 0 }}>
                    Lưu ý: Khi sửa, hệ thống giữ nguyên <b>qty_remaining</b> để
                    tránh sai tồn nếu lô đã được dùng.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* LIST */}
      <div className="card" style={{ marginTop: 14 }}>
        <div className="card-h" style={{ justifyContent: "space-between" }}>
          <div>
            <h2 className="h2">Danh sách lô nhập</h2>
            <p className="p">Đang hiển thị: {filteredBatches.length} lô</p>
          </div>

          <div className="row" style={{ gap: 10, alignItems: "center" }}>
            <input
              className="input"
              placeholder="Tìm item / NCC / ghi chú / danh mục..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={{ width: 320 }}
            />
            <button className="btn" onClick={refresh}>
              ↻
            </button>
          </div>
        </div>

        <div className="card-b" style={{ padding: 0 }}>
          <div className="tableWrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Danh mục</th>
                  <th>Ngày nhập</th>
                  <th className="right">Nhập</th>
                  <th className="right">Còn</th>
                  <th className="right">Giá nhập</th>
                  <th className="right">Tổng nhập</th>
                  <th className="right">Tổng còn</th>
                  <th>NCC</th>
                  <th>Ghi chú</th>
                  <th style={{ width: 180 }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredBatches.map((b) => {
                  const receivedValue =
                    Number(b.qty_received || 0) * Number(b.unit_cost || 0);
                  const remainingValue =
                    Number(b.qty_remaining || 0) * Number(b.unit_cost || 0);

                  return (
                    <tr key={b.id}>
                      <td>
                        <b>{b.items?.name ?? b.item_id}</b>
                        <div className="muted" style={{ fontSize: 12 }}>
                          {b.items?.type === "product"
                            ? "Thành phẩm"
                            : "Vật tư"}{" "}
                          {b.items?.unit ? `• ${b.items.unit}` : ""}
                        </div>
                      </td>

                      <td className="muted">
                        {b.items?.categories?.name ?? "-"}
                      </td>

                      <td className="muted">{b.received_date}</td>

                      <td className="right">
                        <b>{Number(b.qty_received).toLocaleString()}</b>
                      </td>

                      <td className="right">
                        <b>{Number(b.qty_remaining).toLocaleString()}</b>
                      </td>

                      <td className="right" title="unit_cost">
                        {Number(b.unit_cost).toLocaleString()}
                      </td>

                      <td className="right">
                        {receivedValue.toLocaleString()}
                      </td>
                      <td className="right">
                        {remainingValue.toLocaleString()}
                      </td>

                      <td className="muted">{b.supplier_name ?? "-"}</td>
                      <td className="muted">{b.note ?? "-"}</td>

                      <td>
                        {canWrite ? (
                          <div
                            style={{
                              display: "flex",
                              gap: 10,
                              flexWrap: "wrap",
                            }}
                          >
                            <button
                              className="btn"
                              onClick={() => startEdit(b)}
                            >
                              Sửa
                            </button>
                            <button
                              className="btn"
                              onClick={() => deleteBatch(b.id)}
                            >
                              Xoá
                            </button>
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

                {filteredBatches.length === 0 && (
                  <tr>
                    <td colSpan={11} className="muted">
                      Chưa có lô nhập nào.
                    </td>
                  </tr>
                )}
              </tbody>

              {/* FOOTER TOTAL */}
              {filteredBatches.length > 0 && (
                <tfoot>
                  <tr style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                    <td colSpan={3} className="muted" style={{ padding: 10 }}>
                      <b>Tổng</b>
                    </td>
                    <td className="right" style={{ padding: 10 }}>
                      <b>{summary.footer.sumReceived.toLocaleString()}</b>
                    </td>
                    <td className="right" style={{ padding: 10 }}>
                      <b>{summary.footer.sumRemaining.toLocaleString()}</b>
                    </td>
                    <td />
                    <td className="right" style={{ padding: 10 }}>
                      <b>{summary.footer.sumReceivedValue.toLocaleString()}</b>
                    </td>
                    <td className="right" style={{ padding: 10 }}>
                      <b>{summary.footer.sumRemainingValue.toLocaleString()}</b>
                    </td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
