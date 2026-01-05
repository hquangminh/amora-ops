"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import BottomNav from "@/app/_components/BottomNav";
import Pagination from "@/app/_components/Pagination";
import { supabase } from "@/lib/supabaseClient";

type Customer = { id: string; name: string; phone: string | null };
type Item = { id: string; name: string; sale_price: number };

type Line = {
  item_id: string;
  name: string;
  qty: number;
  unit_price: number;
};

export default function NewOrderPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);

  // Items (paged)
  const [items, setItems] = useState<Item[]>([]);
  const [itemQ, setItemQ] = useState("");
  const itemsPageSize = 24;
  const [itemsPage, setItemsPage] = useState(1);
  const [itemsTotal, setItemsTotal] = useState(0);

  const [customerId, setCustomerId] = useState("");
  const [channel, setChannel] = useState("Facebook");
  const [lines, setLines] = useState<Line[]>([]);
  const [saving, setSaving] = useState(false);

  const total = useMemo(
    () => lines.reduce((s, l) => s + l.qty * l.unit_price, 0),
    [lines]
  );

  const fetchCustomers = async () => {
    const c = await supabase
      .from("customers")
      .select("id,name,phone")
      .order("name", { ascending: true })
      .limit(500);

    if (c.error) alert(c.error.message);
    setCustomers((c.data as any) ?? []);
  };

  const fetchItems = async (p = itemsPage, qqInput = itemQ) => {
    const from = (p - 1) * itemsPageSize;
    const to = from + itemsPageSize - 1;

    let query = supabase
      .from("items")
      .select("id,name,sale_price", { count: "exact" })
      .eq("type", "product")
      .eq("is_active", true);

    const qq = qqInput.trim();
    if (qq) query = query.ilike("name", `%${qq}%`);

    const { data, count, error } = await query
      .order("name", { ascending: true })
      .range(from, to);

    if (error) return alert(error.message);
    setItems((data as any) ?? []);
    setItemsTotal(count ?? 0);
  };

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return (window.location.href = "/login");
      await fetchCustomers();
      await fetchItems(1, itemQ);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // đổi search sản phẩm thì về trang 1
  useEffect(() => {
    setItemsPage(1);
  }, [itemQ]);

  useEffect(() => {
    fetchItems(itemsPage, itemQ);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsPage, itemQ]);

  const addItem = (it: Item) => {
    setLines((prev) => {
      const found = prev.find((l) => l.item_id === it.id);
      if (found) {
        return prev.map((l) =>
          l.item_id === it.id ? { ...l, qty: l.qty + 1 } : l
        );
      }
      return [
        ...prev,
        {
          item_id: it.id,
          name: it.name,
          qty: 1,
          unit_price: Number(it.sale_price || 0),
        },
      ];
    });
  };

  const inc = (id: string) =>
    setLines((p) =>
      p.map((l) => (l.item_id === id ? { ...l, qty: l.qty + 1 } : l))
    );

  const dec = (id: string) =>
    setLines((p) =>
      p
        .map((l) => (l.item_id === id ? { ...l, qty: l.qty - 1 } : l))
        .filter((l) => l.qty > 0)
    );

  const updatePrice = (id: string, v: string) => {
    const n = Number(v || 0);
    setLines((p) =>
      p.map((l) => (l.item_id === id ? { ...l, unit_price: n } : l))
    );
  };

  const saveOrder = async () => {
    if (!customerId) return alert("Chọn khách hàng");
    if (lines.length === 0) return alert("Chưa có sản phẩm");

    setSaving(true);

    const code = "AM" + Date.now().toString().slice(-6);

    const { data: order, error: oErr } = await supabase
      .from("orders")
      .insert({
        order_code: code,
        customer_id: customerId,
        channel,
        subtotal: total,
        total,
        status: "new",
        delivery_status: "pending",
        payment_status: "unpaid",
        paid_amount: 0,
      })
      .select("id")
      .single();

    if (oErr || !order) {
      setSaving(false);
      return alert(oErr?.message ?? "Không tạo được order");
    }

    const payload = lines.map((l) => ({
      order_id: order.id,
      item_id: l.item_id,
      qty: l.qty,
      unit_price: l.unit_price,
      line_total: l.qty * l.unit_price,
    }));

    const { error: iErr } = await supabase.from("order_items").insert(payload);
    setSaving(false);

    if (iErr) return alert(iErr.message);

    window.location.href = "/orders";
  };

  return (
    <div className="container">
      <div className="topbar">
        <div className="brand">
          <span>Tạo đơn</span>
          <span className="badge">New</span>
        </div>
        <Link className="btn" href="/orders">
          ← Danh sách
        </Link>
      </div>

      <div className="grid" style={{ marginTop: 14 }}>
        {/* LEFT */}
        <div className="card" style={{ gridColumn: "span 5" }}>
          <div className="card-h">
            <h2 className="h2">Thông tin</h2>
          </div>

          <div className="card-b">
            <div className="field">
              <div className="label">Khách hàng</div>
              <select
                className="select"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
              >
                <option value="">— chọn —</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.phone ? ` (${c.phone})` : ""}
                  </option>
                ))}
              </select>

              <div style={{ marginTop: 8 }}>
                <Link className="btn" href="/customers">
                  + Thêm khách mới
                </Link>
              </div>
            </div>

            <div className="field" style={{ marginTop: 10 }}>
              <div className="label">Kênh</div>
              <input
                className="input"
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                placeholder="Facebook / Shopee / Offline..."
              />
            </div>
          </div>
        </div>

        {/* RIGHT: ITEMS PICKER */}
        <div className="card" style={{ gridColumn: "span 7" }}>
          <div className="card-h">
            <div>
              <h2 className="h2">Chọn sản phẩm</h2>
              <p className="p">
                Tổng: <b>{itemsTotal}</b> sản phẩm • Mỗi trang {itemsPageSize}
              </p>
            </div>

            <input
              className="input"
              value={itemQ}
              onChange={(e) => setItemQ(e.target.value)}
              placeholder="Tìm sản phẩm..."
              style={{ maxWidth: 260 }}
            />
          </div>

          <div className="card-b">
            <div className="row">
              {items.map((it) => (
                <button key={it.id} className="btn" onClick={() => addItem(it)}>
                  {it.name}{" "}
                  <span className="muted">
                    ({Number(it.sale_price || 0).toLocaleString()})
                  </span>
                </button>
              ))}
              {items.length === 0 && (
                <div className="muted">Không có sản phẩm.</div>
              )}
            </div>

            <div style={{ marginTop: 12 }}>
              <Pagination
                page={itemsPage}
                total={itemsTotal}
                pageSize={itemsPageSize}
                onPage={setItemsPage}
              />
            </div>
          </div>
        </div>

        {/* ORDER LINES */}
        <div className="card" style={{ gridColumn: "span 12" }}>
          <div className="card-h">
            <h2 className="h2">Chi tiết đơn</h2>
            <div className="muted" style={{ fontSize: 13 }}>
              Tổng: <b>{total.toLocaleString()}</b>
            </div>
          </div>

          <div className="card-b" style={{ padding: 0 }}>
            <div className="tableWrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Sản phẩm</th>
                    <th className="right">SL</th>
                    <th className="right">Giá</th>
                    <th className="right">Thành tiền</th>
                    <th className="right">+/-</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.item_id}>
                      <td>
                        <b>{l.name}</b>
                      </td>
                      <td className="right">{l.qty}</td>
                      <td className="right">
                        <input
                          className="input"
                          style={{ width: 120, textAlign: "right" }}
                          type="number"
                          value={l.unit_price}
                          onChange={(e) =>
                            updatePrice(l.item_id, e.target.value)
                          }
                        />
                      </td>
                      <td className="right">
                        {(l.qty * l.unit_price).toLocaleString()}
                      </td>
                      <td className="right">
                        <button className="btn" onClick={() => dec(l.item_id)}>
                          -
                        </button>
                        <button
                          className="btn"
                          onClick={() => inc(l.item_id)}
                          style={{ marginLeft: 8 }}
                        >
                          +
                        </button>
                      </td>
                    </tr>
                  ))}

                  {lines.length === 0 && (
                    <tr>
                      <td colSpan={5} className="muted">
                        Chưa có sản phẩm.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card-b">
            <button
              className="btn primary"
              onClick={saveOrder}
              disabled={saving}
            >
              {saving ? "Đang lưu..." : "Lưu đơn"}
            </button>
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
