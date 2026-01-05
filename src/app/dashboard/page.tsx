"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Topbar from "@/app/_components/Topbar";
import BottomNav from "@/app/_components/BottomNav";
import { supabase } from "@/lib/supabaseClient";

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}
function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function nextMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 1);
}
function toMonthStr(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}
function parseMonthStart(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1);
}

function downloadCSV(filename: string, rows: Record<string, any>[]) {
  if (!rows.length) {
    alert("Không có dữ liệu để xuất.");
    return;
  }
  const headers = Object.keys(rows[0]);
  const esc = (v: any) => {
    const s = String(v ?? "");
    if (s.includes('"') || s.includes(",") || s.includes("\n")) {
      return `"${s.replaceAll('"', '""')}"`;
    }
    return s;
  };
  const csv = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => esc(r[h])).join(",")),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

type StockRow = {
  item_id: string;
  name: string;
  unit: string;
  low_stock_threshold: number;
  stock_qty: number;
};

type LightOrder = {
  id: string;
  order_code: string;
  status: "new" | "confirmed" | "completed" | "cancelled";
  delivery_status: "pending" | "shipped" | "delivered" | "returned" | "failed";
  payment_status: "unpaid" | "partial" | "paid";
  total: number;
  cogs_total: number;
  created_at: string;
};

export default function DashboardPage() {
  const now = useMemo(() => new Date(), []);

  const [mode, setMode] = useState<"default" | "day" | "month" | "range">(
    "default"
  );
  const [day, setDay] = useState<string>(() => toDateStr(now));
  const [month, setMonth] = useState<string>(() => toMonthStr(now));
  const [from, setFrom] = useState<string>(() => toDateStr(addDays(now, -6)));
  const [to, setTo] = useState<string>(() => toDateStr(now));

  // KPI (Delivered-based revenue)
  const [todayRev, setTodayRev] = useState(0);
  const [todayCogs, setTodayCogs] = useState(0);
  const [todayExp, setTodayExp] = useState(0);

  const [monthRev, setMonthRev] = useState(0);
  const [monthCogs, setMonthCogs] = useState(0);
  const [monthExp, setMonthExp] = useState(0);

  // Filtered KPI
  const [fRev, setFRev] = useState(0);
  const [fCogs, setFCogs] = useState(0);
  const [fExp, setFExp] = useState(0);

  const [lowStock, setLowStock] = useState<StockRow[]>([]);
  const [needCogs, setNeedCogs] = useState<LightOrder[]>([]);

  const todayNet = todayRev - todayCogs - todayExp;
  const monthNet = monthRev - monthCogs - monthExp;
  const filteredNet = fRev - fCogs - fExp;

  const sum = (arr: any[], key: string) =>
    arr.reduce((s, r) => s + Number(r[key] || 0), 0);

  const getFilterRange = () => {
    if (mode === "day") {
      const d = new Date(day);
      const s = startOfDay(d);
      const e = addDays(s, 1);
      return {
        start: s.toISOString(),
        end: e.toISOString(),
        label: `Ngày ${day}`,
      };
    }
    if (mode === "month") {
      const s = parseMonthStart(month);
      const e = nextMonth(s);
      return {
        start: s.toISOString(),
        end: e.toISOString(),
        label: `Tháng ${month}`,
      };
    }
    if (mode === "range") {
      const s = startOfDay(new Date(from));
      const e = addDays(startOfDay(new Date(to)), 1);
      return {
        start: s.toISOString(),
        end: e.toISOString(),
        label: `Từ ${from} đến ${to}`,
      };
    }
    const s = startOfDay(addDays(new Date(), -6));
    const e = addDays(startOfDay(new Date()), 1);
    return {
      start: s.toISOString(),
      end: e.toISOString(),
      label: `7 ngày gần nhất`,
    };
  };

  // ✅ Default KPI: hôm nay + tháng này
  // Revenue = delivered
  // COGS = completed (vì cogs_total có sau khi chốt)
  const refreshDefault = async () => {
    const n = new Date();
    const todayStart = startOfDay(n);
    const todayEnd = addDays(todayStart, 1);
    const mStart = startOfMonth(n);
    const mEnd = nextMonth(mStart);

    const [
      delToday,
      cogsToday,
      expToday,
      delMonth,
      cogsMonth,
      expMonth,
      stock,
      warn,
    ] = await Promise.all([
      supabase
        .from("orders")
        .select("total")
        .eq("delivery_status", "delivered")
        .neq("status", "cancelled")
        .gte("created_at", todayStart.toISOString())
        .lt("created_at", todayEnd.toISOString()),

      supabase
        .from("orders")
        .select("cogs_total")
        .eq("status", "completed")
        .eq("delivery_status", "delivered")
        .gte("created_at", todayStart.toISOString())
        .lt("created_at", todayEnd.toISOString()),

      supabase
        .from("expenses")
        .select("amount")
        .gte("created_at", todayStart.toISOString())
        .lt("created_at", todayEnd.toISOString()),

      supabase
        .from("orders")
        .select("total")
        .eq("delivery_status", "delivered")
        .neq("status", "cancelled")
        .gte("created_at", mStart.toISOString())
        .lt("created_at", mEnd.toISOString()),

      supabase
        .from("orders")
        .select("cogs_total")
        .eq("status", "completed")
        .eq("delivery_status", "delivered")
        .gte("created_at", mStart.toISOString())
        .lt("created_at", mEnd.toISOString()),

      supabase
        .from("expenses")
        .select("amount")
        .gte("created_at", mStart.toISOString())
        .lt("created_at", mEnd.toISOString()),

      supabase
        .from("v_stock")
        .select("item_id,name,unit,low_stock_threshold,stock_qty"),

      supabase
        .from("orders")
        .select(
          "id,order_code,status,delivery_status,payment_status,total,cogs_total,created_at"
        )
        .eq("delivery_status", "delivered")
        .neq("status", "completed")
        .neq("status", "cancelled")
        .order("created_at", { ascending: false })
        .limit(8),
    ]);

    if (delToday.error) alert(delToday.error.message);
    if (cogsToday.error) alert(cogsToday.error.message);
    if (expToday.error) alert(expToday.error.message);
    if (delMonth.error) alert(delMonth.error.message);
    if (cogsMonth.error) alert(cogsMonth.error.message);
    if (expMonth.error) alert(expMonth.error.message);
    if (stock.error) alert(stock.error.message);
    if (warn.error) alert(warn.error.message);

    setTodayRev(sum(delToday.data ?? [], "total"));
    setTodayCogs(sum(cogsToday.data ?? [], "cogs_total"));
    setTodayExp(sum(expToday.data ?? [], "amount"));

    setMonthRev(sum(delMonth.data ?? [], "total"));
    setMonthCogs(sum(cogsMonth.data ?? [], "cogs_total"));
    setMonthExp(sum(expMonth.data ?? [], "amount"));

    const stockRows = (stock.data as any as StockRow[]) ?? [];
    setLowStock(
      stockRows
        .filter(
          (r) =>
            Number(r.low_stock_threshold || 0) > 0 &&
            Number(r.stock_qty) <= Number(r.low_stock_threshold)
        )
        .sort((a, b) => Number(a.stock_qty) - Number(b.stock_qty))
        .slice(0, 12)
    );

    setNeedCogs((warn.data as any) ?? []);
  };

  // ✅ Filtered KPI theo bộ lọc (delivered-based)
  const refreshFiltered = async () => {
    const r = getFilterRange();

    const [del, cogs, exp] = await Promise.all([
      supabase
        .from("orders")
        .select("total")
        .eq("delivery_status", "delivered")
        .neq("status", "cancelled")
        .gte("created_at", r.start)
        .lt("created_at", r.end),

      supabase
        .from("orders")
        .select("cogs_total")
        .eq("status", "completed")
        .eq("delivery_status", "delivered")
        .gte("created_at", r.start)
        .lt("created_at", r.end),

      supabase
        .from("expenses")
        .select("amount")
        .gte("created_at", r.start)
        .lt("created_at", r.end),
    ]);

    if (del.error) alert(del.error.message);
    if (cogs.error) alert(cogs.error.message);
    if (exp.error) alert(exp.error.message);

    setFRev(sum(del.data ?? [], "total"));
    setFCogs(sum(cogs.data ?? [], "cogs_total"));
    setFExp(sum(exp.data ?? [], "amount"));
  };

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return (window.location.href = "/login");
      await refreshDefault();
      await refreshFiltered();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyFilter = async () => {
    if (mode === "range" && from > to)
      return alert("Khoảng ngày không hợp lệ (from > to).");
    await refreshFiltered();
  };

  const exportOrders = async () => {
    const r = getFilterRange();
    const { data, error } = await supabase
      .from("orders")
      .select(
        "order_code,status,channel,delivery_status,payment_status,paid_amount,total,cogs_total,gross_profit,created_at,customers(name,phone)"
      )
      .gte("created_at", r.start)
      .lt("created_at", r.end)
      .order("created_at", { ascending: false })
      .limit(5000);

    if (error) return alert(error.message);

    const rows = (data as any[]).map((x) => ({
      order_code: x.order_code,
      status: x.status,
      delivery_status: x.delivery_status,
      payment_status: x.payment_status,
      paid_amount: x.paid_amount,
      channel: x.channel,
      customer_name: x.customers?.name ?? "",
      customer_phone: x.customers?.phone ?? "",
      total: x.total,
      cogs_total: x.cogs_total,
      gross_profit: x.gross_profit,
      created_at: x.created_at,
    }));

    downloadCSV(`orders_${r.label.replaceAll(" ", "_")}.csv`, rows);
  };

  const exportExpenses = async () => {
    const r = getFilterRange();
    const { data, error } = await supabase
      .from("expenses")
      .select("title,amount,expense_type,campaign_id,created_at")
      .gte("created_at", r.start)
      .lt("created_at", r.end)
      .order("created_at", { ascending: false })
      .limit(5000);

    if (error) return alert(error.message);

    const rows = (data as any[]).map((x) => ({
      title: x.title,
      amount: x.amount,
      expense_type: x.expense_type ?? "",
      campaign_id: x.campaign_id ?? "",
      created_at: x.created_at,
    }));

    downloadCSV(`expenses_${r.label.replaceAll(" ", "_")}.csv`, rows);
  };

  const rangeLabel = getFilterRange().label;

  return (
    <div className="container">
      <Topbar
        title="Dashboard"
        right={
          <>
            <button className="btn" onClick={refreshDefault}>
              ↻
            </button>
            <Link className="btn primary" href="/orders/new">
              + Tạo đơn
            </Link>
          </>
        }
      />

      {/* FILTER BAR */}
      <div className="card" style={{ marginTop: 14 }}>
        <div className="card-h">
          <div>
            <h2 className="h2">Lọc báo cáo</h2>
            <p className="p">
              * Doanh thu tính theo <b>đã giao (delivered)</b>. COGS tính theo{" "}
              <b>đã chốt COGS</b>.
            </p>
          </div>
          <span className="badge">{rangeLabel}</span>
        </div>

        <div className="card-b">
          <div className="row" style={{ alignItems: "center" }}>
            <select
              className="select"
              value={mode}
              onChange={(e) => setMode(e.target.value as any)}
              style={{ maxWidth: 210 }}
            >
              <option value="default">7 ngày gần nhất</option>
              <option value="day">Theo ngày</option>
              <option value="month">Theo tháng</option>
              <option value="range">Theo khoảng</option>
            </select>

            {mode === "day" && (
              <div style={{ minWidth: 180 }}>
                <div className="label">Chọn ngày</div>
                <input
                  className="input"
                  type="date"
                  value={day}
                  onChange={(e) => setDay(e.target.value)}
                />
              </div>
            )}

            {mode === "month" && (
              <div style={{ minWidth: 180 }}>
                <div className="label">Chọn tháng</div>
                <input
                  className="input"
                  type="month"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                />
              </div>
            )}

            {mode === "range" && (
              <>
                <div style={{ minWidth: 180 }}>
                  <div className="label">Từ ngày</div>
                  <input
                    className="input"
                    type="date"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                  />
                </div>
                <div style={{ minWidth: 180 }}>
                  <div className="label">Đến ngày</div>
                  <input
                    className="input"
                    type="date"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                  />
                </div>
              </>
            )}

            <button className="btn primary" onClick={applyFilter}>
              Áp dụng
            </button>

            <button className="btn" onClick={exportOrders}>
              Xuất Orders CSV
            </button>
            <button className="btn" onClick={exportExpenses}>
              Xuất Expenses CSV
            </button>
          </div>
        </div>
      </div>

      {/* DEFAULT KPI */}
      <div className="grid" style={{ marginTop: 14 }}>
        <div className="kpi" style={{ gridColumn: "span 3" }}>
          <div className="t">Doanh thu hôm nay (đã giao)</div>
          <div className="v">{todayRev.toLocaleString()}</div>
        </div>
        <div className="kpi" style={{ gridColumn: "span 3" }}>
          <div className="t">COGS hôm nay (đã chốt)</div>
          <div className="v">{todayCogs.toLocaleString()}</div>
        </div>
        <div className="kpi" style={{ gridColumn: "span 3" }}>
          <div className="t">Chi phí hôm nay</div>
          <div className="v">{todayExp.toLocaleString()}</div>
        </div>
        <div className="kpi" style={{ gridColumn: "span 3" }}>
          <div className="t">Lợi nhuận ròng hôm nay</div>
          <div className="v">{todayNet.toLocaleString()}</div>
        </div>

        <div className="kpi" style={{ gridColumn: "span 3" }}>
          <div className="t">Doanh thu tháng (đã giao)</div>
          <div className="v">{monthRev.toLocaleString()}</div>
        </div>
        <div className="kpi" style={{ gridColumn: "span 3" }}>
          <div className="t">COGS tháng (đã chốt)</div>
          <div className="v">{monthCogs.toLocaleString()}</div>
        </div>
        <div className="kpi" style={{ gridColumn: "span 3" }}>
          <div className="t">Chi phí tháng</div>
          <div className="v">{monthExp.toLocaleString()}</div>
        </div>
        <div className="kpi" style={{ gridColumn: "span 3" }}>
          <div className="t">Lợi nhuận ròng tháng</div>
          <div className="v">{monthNet.toLocaleString()}</div>
        </div>
      </div>

      {/* FILTERED KPI */}
      <div className="card" style={{ marginTop: 14 }}>
        <div className="card-h">
          <h2 className="h2">Theo bộ lọc: {rangeLabel}</h2>
          <span className="muted">
            Doanh thu (đã giao) - COGS (đã chốt) - Chi phí
          </span>
        </div>
        <div className="grid card-b">
          <div className="kpi" style={{ gridColumn: "span 4" }}>
            <div className="t">Doanh thu</div>
            <div className="v">{fRev.toLocaleString()}</div>
          </div>
          <div className="kpi" style={{ gridColumn: "span 4" }}>
            <div className="t">COGS</div>
            <div className="v">{fCogs.toLocaleString()}</div>
          </div>
          <div className="kpi" style={{ gridColumn: "span 4" }}>
            <div className="t">Chi phí</div>
            <div className="v">{fExp.toLocaleString()}</div>
          </div>

          <div className="kpi" style={{ gridColumn: "span 12" }}>
            <div className="t">Lợi nhuận ròng</div>
            <div className="v">{filteredNet.toLocaleString()}</div>
          </div>
        </div>
      </div>

      {/* WARN: delivered but not completed */}
      <div className="card" style={{ marginTop: 14 }}>
        <div className="card-h">
          <div>
            <h2 className="h2">Cảnh báo vận hành</h2>
            <p className="p">
              Đơn <b>đã giao</b> nhưng <b>chưa chốt COGS</b> (COGS sẽ bị thiếu).
            </p>
          </div>
          <Link className="btn primary" href="/orders">
            Mở Orders
          </Link>
        </div>
        <div className="card-b" style={{ padding: 0 }}>
          <div className="tableWrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Mã</th>
                  <th>Status</th>
                  <th>Thanh toán</th>
                  <th className="right">Doanh thu</th>
                  <th className="right">Tạo lúc</th>
                </tr>
              </thead>
              <tbody>
                {needCogs.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <Link href={`/orders/${o.id}`}>
                        <b>{o.order_code}</b>
                      </Link>
                    </td>
                    <td className="muted">{o.status}</td>
                    <td className="muted">{o.payment_status}</td>
                    <td className="right">
                      {Number(o.total || 0).toLocaleString()}
                    </td>
                    <td className="right">
                      {new Date(o.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
                {needCogs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="muted">
                      Không có 🎉
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* LOW STOCK */}
      <div className="card" style={{ marginTop: 14 }}>
        <div className="card-h">
          <div>
            <h2 className="h2">Cảnh báo tồn kho thấp</h2>
            <p className="p">Item có tồn ≤ mức tối thiểu.</p>
          </div>
          <Link className="btn primary" href="/inventory">
            + Nhập kho
          </Link>
        </div>

        <div className="card-b" style={{ padding: 0 }}>
          <div className="tableWrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Đơn vị</th>
                  <th className="right">Tồn</th>
                  <th className="right">Tối thiểu</th>
                </tr>
              </thead>
              <tbody>
                {lowStock.map((r) => (
                  <tr key={r.item_id}>
                    <td>
                      <b>{r.name}</b>
                    </td>
                    <td className="muted">{r.unit}</td>
                    <td className="right">
                      <b>{Number(r.stock_qty).toLocaleString()}</b>
                    </td>
                    <td
                      className="right"
                      style={{ color: "rgba(231,217,195,.9)" }}
                    >
                      {Number(r.low_stock_threshold).toLocaleString()}
                    </td>
                  </tr>
                ))}
                {lowStock.length === 0 && (
                  <tr>
                    <td colSpan={4} className="muted">
                      Không có cảnh báo 🎉
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
