"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import BottomNav from "@/app/_components/BottomNav";
import { supabase } from "@/lib/supabaseClient";
import { getMyRole } from "@/lib/getRole";
import type { AppRole } from "@/lib/roles";

type DeliveryStatus = "pending" | "shipping" | "delivered" | "returned";
type PaymentStatus = "unpaid" | "paid" | "partial" | "refunded";

type OrderRow = {
  id: string;
  order_code: string;
  status: "new" | "confirmed" | "completed" | "cancelled";
  channel: string;
  total: number;
  cogs_total: number;
  gross_profit: number;
  delivery_status: DeliveryStatus;
  payment_status: PaymentStatus;
  created_at: string;
  customers?: { name: string } | null;
};

const statusLabel: Record<string, string> = {
  new: "Mới",
  confirmed: "Xác nhận",
  completed: "Hoàn tất",
  cancelled: "Huỷ",
};

const deliveryLabel: Record<DeliveryStatus, string> = {
  pending: "Chờ",
  shipping: "Đang giao",
  delivered: "Đã giao",
  returned: "Hoàn/Trả",
};

const paymentLabel: Record<PaymentStatus, string> = {
  unpaid: "Chưa thu",
  paid: "Đã thu",
  partial: "Thu 1 phần",
  refunded: "Hoàn tiền",
};

export default function OrdersPage() {
  const [role, setRole] = useState<AppRole | null>(null);
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | OrderRow["status"]>("all");

  const refresh = async () => {
    const { data, error } = await supabase
      .from("orders")
      .select(
        "id,order_code,status,channel,total,cogs_total,gross_profit,delivery_status,payment_status,created_at,customers(name)"
      )
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) alert(error.message);
    else setRows((data as any) ?? []);
  };

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return (window.location.href = "/login");
      setRole(await getMyRole());
      await refresh();
    });
  }, []);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return rows.filter((o) => {
      if (status !== "all" && o.status !== status) return false;
      if (!qq) return true;
      return (
        o.order_code.toLowerCase().includes(qq) ||
        (o.customers?.name ?? "").toLowerCase().includes(qq) ||
        (o.channel ?? "").toLowerCase().includes(qq)
      );
    });
  }, [rows, q, status]);

  const completeOrder = async (orderId: string) => {
    if (!confirm("Hoàn tất đơn? (trừ kho FIFO + tính giá vốn)")) return;
    setLoadingId(orderId);

    const res = await fetch("/api/orders/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId }),
    });

    const json = await res.json();
    setLoadingId(null);

    if (!res.ok) return alert(json.error || "Có lỗi khi hoàn tất đơn");
    await refresh();
  };

  const cancelOrder = async (orderId: string) => {
    if (role !== "admin") return alert("Chỉ admin mới được huỷ + hoàn kho.");
    if (!confirm("HUỶ đơn và HOÀN KHO? (undo FIFO allocations)")) return;
    setLoadingId(orderId);

    const res = await fetch("/api/orders/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId }),
    });

    const json = await res.json();
    setLoadingId(null);

    if (!res.ok) return alert(json.error || "Có lỗi khi huỷ đơn");
    await refresh();
  };

  return (
    <div className="container">
      <div className="topbar">
        <div className="brand">
          <span>Đơn hàng</span>
          <span className="badge">Amora</span>
        </div>
        <div className="row">
          <Link className="btn primary" href="/orders/new">
            + Tạo đơn
          </Link>
          <button className="btn" onClick={refresh}>
            ↻
          </button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="card-h">
          <div>
            <h2 className="h2">Danh sách</h2>
            <p className="p">{filtered.length} đơn</p>
          </div>

          <div className="row" style={{ alignItems: "center" }}>
            <select
              className="select"
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              style={{ maxWidth: 170 }}
            >
              <option value="all">Tất cả</option>
              <option value="new">Mới</option>
              <option value="confirmed">Xác nhận</option>
              <option value="completed">Hoàn tất</option>
              <option value="cancelled">Huỷ</option>
            </select>
            <input
              className="input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm mã/khách/kênh..."
              style={{ maxWidth: 320 }}
            />
            <span className="muted" style={{ fontSize: 13 }}>
              Role: <b>{role ?? "?"}</b>
            </span>
          </div>
        </div>

        <div className="card-b" style={{ padding: 0 }}>
          <div className="tableWrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Mã</th>
                  <th>Khách</th>
                  <th>Kênh</th>
                  <th>Trạng thái</th>
                  <th>Giao hàng</th>
                  <th>Thanh toán</th>
                  <th className="right">Doanh thu</th>
                  <th className="right">Giá vốn</th>
                  <th className="right">Lãi gộp</th>
                  <th className="right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <Link href={`/orders/${o.id}`}>
                        <b>{o.order_code}</b>
                      </Link>
                      <div className="muted" style={{ fontSize: 12 }}>
                        {new Date(o.created_at).toLocaleString()}
                      </div>
                    </td>
                    <td>{o.customers?.name ?? "-"}</td>
                    <td className="muted">{o.channel}</td>
                    <td className="muted">
                      {statusLabel[o.status] ?? o.status}
                    </td>
                    <td className="muted">
                      {deliveryLabel[o.delivery_status] ?? o.delivery_status}
                    </td>
                    <td className="muted">
                      {paymentLabel[o.payment_status] ?? o.payment_status}
                    </td>
                    <td className="right">
                      {Number(o.total || 0).toLocaleString()}
                    </td>
                    <td className="right">
                      {Number(o.cogs_total || 0).toLocaleString()}
                    </td>
                    <td className="right">
                      <b>{Number(o.gross_profit || 0).toLocaleString()}</b>
                    </td>
                    <td className="right">
                      {o.status !== "completed" && o.status !== "cancelled" && (
                        <button
                          className="btn primary"
                          disabled={loadingId === o.id}
                          onClick={() => completeOrder(o.id)}
                        >
                          {loadingId === o.id ? "..." : "Hoàn tất"}
                        </button>
                      )}
                      {o.status === "completed" && (
                        <button
                          className="btn danger"
                          disabled={loadingId === o.id || role !== "admin"}
                          onClick={() => cancelOrder(o.id)}
                          style={{ marginLeft: 8 }}
                        >
                          {loadingId === o.id ? "..." : "Huỷ + hoàn kho"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}

                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={10} className="muted">
                      Chưa có đơn.
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
