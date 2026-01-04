"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import BottomNav from "@/app/_components/BottomNav";
import Pagination from "@/app/_components/Pagination";
import { supabase } from "@/lib/supabaseClient";
import { getMyRole } from "@/lib/getRole";

type Order = {
  id: string;
  order_code: string;
  status: "new" | "confirmed" | "completed" | "cancelled";
  channel: string;
  subtotal: number;
  total: number;
  cogs_total: number;
  gross_profit: number;
  created_at: string;
  customers?: {
    name: string;
    phone: string | null;
    address: string | null;
  } | null;
};

type Line = {
  id: string;
  qty: number;
  unit_price: number;
  line_total: number;
  items?: { name: string; unit: string } | null;
};

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [role, setRole] = useState<"admin" | "sales" | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [loading, setLoading] = useState(false);

  // pagination for lines
  const pageSize = 10;
  const [page, setPage] = useState(1);
  const [totalLines, setTotalLines] = useState(0);

  const profit = useMemo(
    () => (order ? Number(order.gross_profit || 0) : 0),
    [order]
  );

  const fetchOrder = async () => {
    const { data: o, error: oErr } = await supabase
      .from("orders")
      .select(
        "id,order_code,status,channel,subtotal,total,cogs_total,gross_profit,created_at,customers(name,phone,address)"
      )
      .eq("id", id)
      .single();

    if (oErr) return alert(oErr.message);
    setOrder((o as any) ?? null);
  };

  const fetchLines = async () => {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const {
      data: l,
      count,
      error: lErr,
    } = await supabase
      .from("order_items")
      .select("id,qty,unit_price,line_total,items(name,unit)", {
        count: "exact",
      })
      .eq("order_id", id)
      .order("created_at", { ascending: true })
      .range(from, to);

    if (lErr) return alert(lErr.message);
    setLines((l as any) ?? []);
    setTotalLines(count ?? 0);
  };

  const refresh = async () => {
    await fetchOrder();
    await fetchLines();
  };

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return (window.location.href = "/login");
      setRole(await getMyRole());
      await refresh();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // đổi page thì load lại lines
  useEffect(() => {
    if (!id) return;
    fetchLines();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const complete = async () => {
    if (!confirm("Hoàn tất đơn? (trừ kho FIFO + tính COGS)")) return;
    setLoading(true);

    const res = await fetch("/api/orders/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: id }),
    });

    const json = await res.json();
    setLoading(false);
    if (!res.ok) return alert(json.error || "Lỗi complete");

    // sau complete có thể thay đổi COGS, refresh lại order
    await fetchOrder();
  };

  const cancel = async () => {
    if (role !== "admin") return alert("Chỉ admin mới được huỷ + hoàn kho.");
    if (!confirm("HUỶ và HOÀN KHO?")) return;

    setLoading(true);
    const res = await fetch("/api/orders/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: id }),
    });

    const json = await res.json();
    setLoading(false);
    if (!res.ok) return alert(json.error || "Lỗi cancel");

    await fetchOrder();
  };

  if (!order) {
    return (
      <div className="container">
        <div className="topbar">
          <div className="brand">
            <span>Đơn</span>
            <span className="badge">Loading</span>
          </div>
          <Link className="btn" href="/orders">
            ← Danh sách
          </Link>
        </div>
        <div className="card" style={{ marginTop: 14 }}>
          <div className="card-b" style={{ color: "#9ca3af" }}>
            Đang tải...
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
          <span>Đơn {order.order_code}</span>
          <span className="badge">{order.status}</span>
        </div>
        <div className="row">
          <Link className="btn" href="/orders">
            ← Danh sách
          </Link>

          {order.status !== "completed" && order.status !== "cancelled" && (
            <button
              className="btn primary"
              onClick={complete}
              disabled={loading}
            >
              {loading ? "..." : "Hoàn tất"}
            </button>
          )}

          {order.status === "completed" && (
            <button
              className="btn danger"
              onClick={cancel}
              disabled={loading || role !== "admin"}
            >
              {loading ? "..." : "Huỷ + hoàn kho"}
            </button>
          )}
        </div>
      </div>

      <div className="grid" style={{ marginTop: 14 }}>
        <div className="card" style={{ gridColumn: "span 5" }}>
          <div className="card-h">
            <h2 className="h2">Khách hàng</h2>
          </div>
          <div className="card-b">
            <div>
              <b>{order.customers?.name ?? "-"}</b>
            </div>
            <div className="muted">{order.customers?.phone ?? ""}</div>
            <div className="muted">{order.customers?.address ?? ""}</div>
            <div style={{ marginTop: 10 }} className="muted">
              Kênh: <b>{order.channel}</b>
            </div>
          </div>
        </div>

        <div className="card" style={{ gridColumn: "span 7" }}>
          <div className="card-h">
            <h2 className="h2">Tổng kết</h2>
          </div>
          <div className="card-b">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span className="muted">Doanh thu</span>
              <b>{Number(order.total || 0).toLocaleString()}</b>
            </div>
            <div
              className="row"
              style={{ justifyContent: "space-between", marginTop: 8 }}
            >
              <span className="muted">Giá vốn (COGS)</span>
              <b>{Number(order.cogs_total || 0).toLocaleString()}</b>
            </div>
            <div
              className="row"
              style={{ justifyContent: "space-between", marginTop: 8 }}
            >
              <span className="muted">Lãi gộp</span>
              <b>{profit.toLocaleString()}</b>
            </div>
          </div>
        </div>

        {/* LINES */}
        <div className="card" style={{ gridColumn: "span 12" }}>
          <div className="card-h">
            <div>
              <h2 className="h2">Chi tiết sản phẩm</h2>
              <p className="p">
                Tổng: <b>{totalLines}</b> dòng • Mỗi trang {pageSize}
              </p>
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
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.id}>
                      <td>
                        <b>{l.items?.name ?? "-"}</b>
                        <div className="muted" style={{ fontSize: 12 }}>
                          {l.items?.unit ?? ""}
                        </div>
                      </td>
                      <td className="right">
                        {Number(l.qty).toLocaleString()}
                      </td>
                      <td className="right">
                        {Number(l.unit_price).toLocaleString()}
                      </td>
                      <td className="right">
                        {Number(l.line_total).toLocaleString()}
                      </td>
                    </tr>
                  ))}

                  {lines.length === 0 && (
                    <tr>
                      <td colSpan={4} className="muted">
                        Không có line.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ padding: 14 }}>
              <Pagination
                page={page}
                total={totalLines}
                pageSize={pageSize}
                onPage={setPage}
              />
            </div>
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
