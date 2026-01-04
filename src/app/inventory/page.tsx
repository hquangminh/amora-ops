"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

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
};

export default function InventoryPage() {
  const [authed, setAuthed] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [batches, setBatches] = useState<(Batch & { items?: Item | null })[]>(
    []
  );

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

  const refresh = async () => {
    const { data: it, error: itErr } = await supabase
      .from("items")
      .select("id,name,type,unit")
      .eq("is_active", true)
      .order("name");
    if (itErr) alert(itErr.message);
    else setItems((it as any) ?? []);

    const { data: ba, error: bErr } = await supabase
      .from("inventory_batches")
      .select(
        "id,received_date,qty_received,qty_remaining,unit_cost,supplier_name,note,item_id,items(id,name,type,unit)"
      )
      .order("created_at", { ascending: false })
      .limit(50);

    if (bErr) alert(bErr.message);
    else setBatches((ba as any) ?? []);
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

  const createBatch = async () => {
    if (!itemId) return alert("Chọn item");
    const q = Number(qty);
    const c = Number(unitCost);
    if (!(q > 0)) return alert("Số lượng phải > 0");

    const { error } = await supabase.from("inventory_batches").insert({
      item_id: itemId,
      received_date: receivedDate,
      qty_received: q,
      qty_remaining: q,
      unit_cost: c,
      supplier_name: supplier.trim() || null,
      note: note.trim() || null,
    });

    if (error) return alert(error.message);

    setQty("1");
    setUnitCost("0");
    setSupplier("");
    setNote("");
    await refresh();
  };

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
        <h2>Kho - Nhập lô</h2>
        <Link href="/dashboard">← Dashboard</Link>
      </div>

      <div
        style={{
          border: "1px solid #eee",
          borderRadius: 12,
          padding: 12,
          marginTop: 12,
        }}
      >
        <h3 style={{ marginTop: 0 }}>Nhập kho theo lô (có giá nhập)</h3>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(6, 1fr)",
            gap: 8,
          }}
        >
          <label style={{ gridColumn: "span 3" }}>
            Item
            <select
              value={itemId}
              onChange={(e) => setItemId(e.target.value)}
              style={{ width: "100%", padding: 10 }}
            >
              <option value="">(Chọn item)</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} — {i.type === "product" ? "Thành phẩm" : "Vật tư"} (
                  {i.unit})
                </option>
              ))}
            </select>
          </label>

          <label style={{ gridColumn: "span 1" }}>
            Ngày nhập
            <input
              type="date"
              value={receivedDate}
              onChange={(e) => setReceivedDate(e.target.value)}
              style={{ width: "100%", padding: 10 }}
            />
          </label>

          <label style={{ gridColumn: "span 1" }}>
            Số lượng
            <input
              type="number"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              style={{ width: "100%", padding: 10 }}
            />
          </label>

          <label style={{ gridColumn: "span 1" }}>
            Giá nhập/đơn vị
            <input
              type="number"
              value={unitCost}
              onChange={(e) => setUnitCost(e.target.value)}
              style={{ width: "100%", padding: 10 }}
            />
          </label>

          <label style={{ gridColumn: "span 2" }}>
            Nhà cung cấp (tuỳ chọn)
            <input
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              style={{ width: "100%", padding: 10 }}
            />
          </label>

          <label style={{ gridColumn: "span 4" }}>
            Ghi chú (tuỳ chọn)
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              style={{ width: "100%", padding: 10 }}
            />
          </label>

          <div style={{ gridColumn: "span 6" }}>
            <button onClick={createBatch} style={{ padding: "10px 14px" }}>
              + Tạo lô nhập
            </button>
            {selectedItem && (
              <span style={{ marginLeft: 10, color: "#666" }}>
                Đang nhập cho: <b>{selectedItem.name}</b> ({selectedItem.unit})
              </span>
            )}
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: 12,
          border: "1px solid #eee",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: 12,
            background: "#fafafa",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <b>Lịch sử lô nhập (50 gần nhất)</b>
          <button onClick={refresh}>↻ Tải lại</button>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ background: "#fff" }}>
            <tr>
              <th style={{ textAlign: "left", padding: 10 }}>Item</th>
              <th style={{ textAlign: "left", padding: 10 }}>Ngày nhập</th>
              <th style={{ textAlign: "right", padding: 10 }}>Nhập</th>
              <th style={{ textAlign: "right", padding: 10 }}>Còn</th>
              <th style={{ textAlign: "right", padding: 10 }}>Giá nhập</th>
              <th style={{ textAlign: "left", padding: 10 }}>NCC</th>
              <th style={{ textAlign: "left", padding: 10 }}>Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            {batches.map((b) => (
              <tr key={b.id} style={{ borderTop: "1px solid #f0f0f0" }}>
                <td style={{ padding: 10 }}>
                  {(b as any).items?.name ?? b.item_id}
                </td>
                <td style={{ padding: 10 }}>{b.received_date}</td>
                <td style={{ padding: 10, textAlign: "right" }}>
                  {Number(b.qty_received).toLocaleString()}
                </td>
                <td style={{ padding: 10, textAlign: "right" }}>
                  {Number(b.qty_remaining).toLocaleString()}
                </td>
                <td style={{ padding: 10, textAlign: "right" }}>
                  {Number(b.unit_cost).toLocaleString()}
                </td>
                <td style={{ padding: 10 }}>{b.supplier_name ?? "-"}</td>
                <td style={{ padding: 10 }}>{b.note ?? "-"}</td>
              </tr>
            ))}
            {batches.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: 12, color: "#666" }}>
                  Chưa có lô nhập nào.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
