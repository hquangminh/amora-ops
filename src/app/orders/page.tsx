"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import BottomNav from "@/app/_components/BottomNav";
import Pagination from "@/app/_components/Pagination";
import { supabase } from "@/lib/supabaseClient";
import { getMyRole, type AppRole } from "@/lib/getRole";

type OrderRow = {
  id: string;
  order_code: string;
  status: "new" | "confirmed" | "completed" | "cancelled";
  channel: string;
  total: number;
  cogs_total: number;
  gross_profit: number;
  created_at: string;

  delivery_status: "pending" | "shipped" | "delivered" | "returned" | "failed";
  payment_status: "unpaid" | "partial" | "paid";
  paid_amount: number;
  paid_at: string | null;

  customers?: { name: string } | null;
};

const statusLabel: Record<OrderRow["status"], string> = {
  new: "Mới",
  confirmed: "Xác nhận",
  completed: "Đã chốt COGS",
  cancelled: "Huỷ",
};

const deliveryLabel: Record<OrderRow["delivery_status"], string> = {
  pending: "Chưa giao",
  shipped: "Đang giao",
  delivered: "Đã giao",
  returned: "Hoàn",
  failed: "Thất bại",
};

const paymentLabel: Record<OrderRow["payment_status"], string> = {
  unpaid: "Chưa thu",
  partial: "Thu 1 phần",
  paid: "Đã thu",
};

export default function OrdersPage() {
  const [role, setRole] = useState<AppRole | null>(null);

  const [rows, setRows] = useState<OrderRow[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | OrderRow["status"]>("all");

  // pagination
  const pageSize = 20;
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchRows = async (p = page, s = status, qqInput = q) => {
    const from = (p - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from("orders")
      .select(
        "id,order_code,status,channel,total,cogs_total,gross_profit,created_at,delivery_status,payment_status,paid_amount,paid_at,customers(name)",
        { count: "exact" }
      )
      .order("created_at", { ascending: false });

    if (s !== "all") query = query.eq("status", s);

    const qq = qqInput.trim();
    if (qq) {
      // Nếu embed filter customers.name gây lỗi, xoá customers.name.ilike là vẫn chạy.
      query = query.or(
        `order_code.ilike.%${qq}%,channel.ilike.%${qq}%,customers.name.ilike.%${qq}%`
      );
    }

    const { data, count, error } = await query.range(from, to);
    if (error) return alert(error.message);

    setRows((data as any) ?? []);
    setTotal(count ?? 0);
  };

  const refresh = async () => {
    setPage(1);
    await fetchRows(1, status, q);
  };

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return (window.location.href = "/login");
      setRole(await getMyRole());
      await fetchRows(1, status, q);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // whenever page/status/q changes -> refetch
  useEffect(() => {
    fetchRows(page, status, q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, status, q]);

  const updateDelivery = async (
    orderId: string,
    next: OrderRow["delivery_status"]
  ) => {
    setLoadingId(orderId);
    const { error } = await supabase
      .from("orders")
      .update({ delivery_status: next })
      .eq("id", orderId);
    setLoadingId(null);
    if (error) return alert(error.message);
    await fetchRows(page, status, q);
  };

  const updatePayment = async (
    orderId: string,
    nextStatus: OrderRow["payment_status"],
    nextPaidAmount?: number
  ) => {
    setLoadingId(orderId);

    const patch: any = {
      payment_status: nextStatus,
    };

    if (typeof nextPaidAmount === "number") patch.paid_amount = nextPaidAmount;

    if (nextStatus === "paid") patch.paid_at = new Date().toISOString();
    if (nextStatus !== "paid") patch.paid_at = null;

    const { error } = await supabase
      .from("orders")
      .update(patch)
      .eq("id", orderId);

    setLoadingId(null);
    if (error) return alert(error.message);
    await fetchRows(page, status, q);
  };

  const completeOrder = async (orderId: string) => {
    if (!confirm("Chốt COGS + trừ kho FIFO cho đơn này?")) return;
    setLoadingId(orderId);

    const res = await fetch("/api/orders/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId }),
    });

    const json = await res.json().catch(() => ({}));
    setLoadingId(orderId);

    setLoadingId(null);
    if (!res.ok) return alert((json as any)?.error || "Có lỗi khi chốt COGS");
    await fetchRows(page, status, q);
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

    const json = await res.json().catch(() => ({}));
    setLoadingId(null);

    if (!res.ok) return alert((json as any)?.error || "Có lỗi khi huỷ đơn");
    await fetchRows(page, status, q);
  };

  const shownCount = useMemo(() => rows.length, [rows]);

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
            <p className="p">
              {shownCount} dòng • Tổng <b>{total}</b> đơn
            </p>
          </div>

          <div className="row" style={{ alignItems: "center" }}>
            <select
              className="select"
              value={status}
              onChange={(e) => {
                const v = e.target.value as any;
                setStatus(v);
                setPage(1);
              }}
              style={{ maxWidth: 200 }}
            >
              <option value="all">Tất cả</option>
              <option value="new">Mới</option>
              <option value="confirmed">Xác nhận</option>
              <option value="completed">Đã chốt COGS</option>
              <option value="cancelled">Huỷ</option>
            </select>

            <input
              className="input"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Tìm mã/khách/kênh..."
              style={{ maxWidth: 340 }}
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
                  <th>Status</th>
                  <th>Giao hàng</th>
                  <th>Thanh toán</th>
                  <th className="right">Doanh thu</th>
                  <th className="right">COGS</th>
                  <th className="right">Lãi gộp</th>
                  <th className="right">Thao tác</th>
                </tr>
              </thead>

              <tbody>
                {rows.map((o) => {
                  const isBusy = loadingId === o.id;

                  const payText =
                    o.payment_status === "paid"
                      ? "Đã thu"
                      : o.payment_status === "partial"
                      ? `Thu ${Number(o.paid_amount || 0).toLocaleString()}`
                      : "Chưa thu";

                  return (
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

                      <td className="muted">{statusLabel[o.status]}</td>

                      <td>
                        <select
                          className="select"
                          value={o.delivery_status}
                          disabled={isBusy || o.status === "cancelled"}
                          onChange={(e) =>
                            updateDelivery(o.id, e.target.value as any)
                          }
                          style={{ minWidth: 150 }}
                        >
                          <option value="pending">
                            {deliveryLabel.pending}
                          </option>
                          <option value="shipped">
                            {deliveryLabel.shipped}
                          </option>
                          <option value="delivered">
                            {deliveryLabel.delivered}
                          </option>
                          <option value="returned">
                            {deliveryLabel.returned}
                          </option>
                          <option value="failed">{deliveryLabel.failed}</option>
                        </select>

                        {o.delivery_status === "delivered" &&
                          o.status !== "completed" && (
                            <div
                              className="muted"
                              style={{ fontSize: 12, marginTop: 4 }}
                            >
                              ⚠ đã giao nhưng chưa chốt COGS
                            </div>
                          )}
                      </td>

                      <td>
                        <div
                          style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
                        >
                          <select
                            className="select"
                            value={o.payment_status}
                            disabled={isBusy || o.status === "cancelled"}
                            onChange={(e) =>
                              updatePayment(o.id, e.target.value as any)
                            }
                            style={{ minWidth: 150 }}
                          >
                            <option value="unpaid">
                              {paymentLabel.unpaid}
                            </option>
                            <option value="partial">
                              {paymentLabel.partial}
                            </option>
                            <option value="paid">{paymentLabel.paid}</option>
                          </select>

                          {o.payment_status === "partial" && (
                            <input
                              className="input"
                              type="number"
                              value={Number(o.paid_amount || 0)}
                              onChange={(e) =>
                                updatePayment(
                                  o.id,
                                  "partial",
                                  Number(e.target.value || 0)
                                )
                              }
                              style={{ width: 140 }}
                              placeholder="Đã thu"
                              disabled={isBusy || o.status === "cancelled"}
                            />
                          )}
                        </div>

                        <div
                          className="muted"
                          style={{ fontSize: 12, marginTop: 4 }}
                        >
                          {payText}
                          {o.paid_at
                            ? ` • ${new Date(o.paid_at).toLocaleString()}`
                            : ""}
                        </div>
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
                        {o.status !== "completed" &&
                          o.status !== "cancelled" && (
                            <button
                              className="btn primary"
                              disabled={isBusy}
                              onClick={() => completeOrder(o.id)}
                            >
                              {isBusy ? "..." : "Chốt COGS"}
                            </button>
                          )}

                        {o.status === "completed" && (
                          <button
                            className="btn danger"
                            disabled={isBusy || role !== "admin"}
                            onClick={() => cancelOrder(o.id)}
                            style={{ marginLeft: 8 }}
                          >
                            {isBusy ? "..." : "Huỷ + hoàn kho"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {rows.length === 0 && (
                  <tr>
                    <td colSpan={10} className="muted">
                      Chưa có đơn.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <Pagination
            page={page}
            total={total}
            pageSize={pageSize}
            onPage={setPage}
          />
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
