"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import BottomNav from "@/app/_components/BottomNav";

type AppRole = "admin" | "sales" | "accountant" | null;

type Item = {
  id: string;
  name: string;
  type: "product" | "supply";
  unit: string;
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
};

export default function InventoryPage() {
  const [authed, setAuthed] = useState(false);
  const [role, setRole] = useState<AppRole>(null);

  const isAdmin = role === "admin";
  const canRead = role === "admin" || role === "sales" || role === "accountant";
  const canWrite = isAdmin; // inventory_batches: chỉ admin được sửa/xoá/tạo

  const [items, setItems] = useState<Item[]>([]);
  const [batches, setBatches] = useState<(Batch & { items?: Item | null })[]>(
    []
  );

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

    if (error) {
      setRole(null);
      return;
    }
    setRole((data?.role as AppRole) ?? null);
  };

  const refresh = async () => {
    // items (chỉ active)
    const { data: it, error: itErr } = await supabase
      .from("items")
      .select("id,name,type,unit")
      .eq("is_active", true)
      .order("name");

    if (itErr) alert(itErr.message);
    else setItems((it as any) ?? []);

    // batches (50 gần nhất)
    const { data: ba, error: bErr } = await supabase
      .from("inventory_batches")
      .select(
        "id,received_date,qty_received,qty_remaining,unit_cost,supplier_name,note,item_id,created_at,items(id,name,type,unit)"
      )
      .order("created_at", { ascending: false })
      .limit(50);

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
  }, []);

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

    const q = Number(qty);
    const c = Number(unitCost);

    if (!(q > 0)) return alert("Số lượng phải > 0");
    if (c < 0) return alert("Giá nhập không được âm");

    if (!editingId) {
      // CREATE
      const { error } = await supabase.from("inventory_batches").insert({
        item_id: itemId,
        received_date: receivedDate,
        qty_received: q,
        qty_remaining: q, // nhập mới: còn = nhập
        unit_cost: c,
        supplier_name: supplier.trim() || null,
        note: note.trim() || null,
      });

      if (error) return alert(error.message);
      resetForm();
      await refresh();
      return;
    }

    // UPDATE
    // rule: khi sửa, cho phép sửa received_date, unit_cost, supplier, note, qty_received, qty_remaining
    // nhưng phải đảm bảo: 0 <= qty_remaining <= qty_received
    const remaining = Number(qty); // mặc định UI nhập "qty" là qty_received, ta sẽ sync remaining giữ nguyên bằng field riêng nếu muốn
    // -> để rõ ràng: khi edit, qty input sẽ map vào qty_received (và giữ qty_remaining như cũ)
    // nên ta cần lấy current batch để giữ qty_remaining.
    const current = batches.find((b) => b.id === editingId);
    const currentRemaining = Number(current?.qty_remaining ?? 0);

    if (currentRemaining > q) {
      return alert(
        "Không thể giảm số lượng nhập thấp hơn số lượng còn trong lô. Hãy chỉnh 'Còn' trước hoặc nhập số lớn hơn."
      );
    }

    const { error } = await supabase
      .from("inventory_batches")
      .update({
        item_id: itemId,
        received_date: receivedDate,
        qty_received: q,
        // qty_remaining giữ nguyên (để không làm sai tồn khi đã xuất)
        qty_remaining: currentRemaining,
        unit_cost: c,
        supplier_name: supplier.trim() || null,
        note: note.trim() || null,
      })
      .eq("id", editingId);

    if (error) return alert(error.message);

    resetForm();
    await refresh();
  };

  const startEdit = (b: Batch & { items?: Item | null }) => {
    if (!canWrite) return alert("Chỉ admin được sửa lô.");

    setEditingId(b.id);
    setItemId(b.item_id);
    setReceivedDate(b.received_date);
    setQty(String(b.qty_received)); // edit: qty = qty_received
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

    // nếu đang edit đúng lô bị xoá -> reset
    if (editingId === id) resetForm();

    await refresh();
  };

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
                      )
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
        <div className="card-h">
          <div>
            <h2 className="h2">Lịch sử lô nhập</h2>
            <p className="p">50 gần nhất</p>
          </div>
          <button className="btn" onClick={refresh}>
            ↻
          </button>
        </div>

        <div className="card-b" style={{ padding: 0 }}>
          <div className="tableWrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Ngày nhập</th>
                  <th className="right">Nhập</th>
                  <th className="right">Còn</th>
                  <th className="right">Giá nhập</th>
                  <th>NCC</th>
                  <th>Ghi chú</th>
                  <th style={{ width: 180 }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <b>{(b as any).items?.name ?? b.item_id}</b>
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
                    <td className="muted">{b.supplier_name ?? "-"}</td>
                    <td className="muted">{b.note ?? "-"}</td>
                    <td>
                      {canWrite ? (
                        <div
                          style={{ display: "flex", gap: 10, flexWrap: "wrap" }}
                        >
                          <button className="btn" onClick={() => startEdit(b)}>
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
                ))}

                {batches.length === 0 && (
                  <tr>
                    <td colSpan={8} className="muted">
                      Chưa có lô nhập nào.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
