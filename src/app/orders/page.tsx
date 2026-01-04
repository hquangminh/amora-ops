"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import BottomNav from "@/app/_components/BottomNav";
import Pagination from "@/app/_components/Pagination";
import { supabase } from "@/lib/supabaseClient";
import { getMyRole } from "@/lib/getRole";

type OrderRow = {
  id: string;
  order_code: string;
  status: "new" | "confirmed" | "completed" | "cancelled";
  channel: string;
  total: number;
  cogs_total: number;
  gross_profit: number;
  created_at: string;
  customers?: { name: string } | null;
};

const statusLabel: Record<string, string> = {
  new: "Mới",
  confirmed: "Xác nhận",
  completed: "Hoàn tất",
  cancelled: "Huỷ",
};

export default function OrdersPage() {
  const [role, setRole] = useState<"admin" | "sales" | null>(null);

  const [rows, setRows] = useState<OrderRow[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | OrderRow["status"]>("all");

  const pageSize = 20;
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchRows = async () => {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from("orders")
      .select(
        "id,order_code,status,channel,total,cogs_total,gross_profit,created_at,customers(name)",
        { count: "exact" }
      )
      .order("created_at", { ascending: false });

    if (status !== "all") query = query.eq("status", status);

    const qq = q.trim();
    if (qq) {
      query = query.or(
        `order_code.ilike.%${qq}%,channel.ilike.%${qq}%,customers.name.ilike.%${qq}%`
      );
    }

    const { data, count, error } = await query.range(from, to);

    if (error) return alert(error.message);
    setRows((data as any as OrderRow[]) ?? []);
    setTotal(count ?? 0);
  };

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return (window.location.href = "/login");
      setRole(await getMyRole());
      await fetchRows();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // đổi search/status thì về trang 1
  useEffect(() => {
    setPage(1);
  }, [q, status]);

  useEffect(() => {
    fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, q, status]);

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
    await fetchRows();
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
    await fetchRows();
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
          <button className="btn" onClick={fetchRows}>
            ↻
          </button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="card-h">
          <div>
            <h2 className="h2">Danh sách</h2>
            <p className="p">
              Tổng: <b>{total}</b> đơn • Mỗi trang {pageSize}
            </p>
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
                  <th className="right">Doanh thu</th>
                  <th className="right">Giá vốn</th>
                  <th className="right">Lãi gộp</th>
                  <th className="right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((o) => (
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

                {rows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="muted">
                      Không có dữ liệu.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div style={{ padding: 14 }}>
            <Pagination
              page={page}
              total={total}
              pageSize={pageSize}
              onPage={setPage}
            />
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
