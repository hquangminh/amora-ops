"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Topbar from "@/app/_components/Topbar";
import BottomNav from "@/app/_components/BottomNav";
import { supabase } from "@/lib/supabaseClient";
import { exportExcel } from "@/lib/exportExcel";

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
    // CSV escape
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

export default function DashboardPage() {
  const now = useMemo(() => new Date(), []);

  // filter mode
  const [mode, setMode] = useState<"default" | "day" | "month" | "range">(
    "default"
  );

  // inputs
  const [day, setDay] = useState<string>(() => toDateStr(now));
  const [month, setMonth] = useState<string>(() => toMonthStr(now));
  const [from, setFrom] = useState<string>(() => toDateStr(addDays(now, -6)));
  const [to, setTo] = useState<string>(() => toDateStr(now));

  // KPI default (today/month)
  const [todayRev, setTodayRev] = useState(0);
  const [todayCogs, setTodayCogs] = useState(0);
  const [todayExp, setTodayExp] = useState(0);

  const [monthRev, setMonthRev] = useState(0);
  const [monthCogs, setMonthCogs] = useState(0);
  const [monthExp, setMonthExp] = useState(0);

  // KPI filtered (theo lựa chọn)
  const [fRev, setFRev] = useState(0);
  const [fCogs, setFCogs] = useState(0);
  const [fExp, setFExp] = useState(0);

  const [lowStock, setLowStock] = useState<StockRow[]>([]);
  const [showAllLow, setShowAllLow] = useState(false);

  const todayNet = todayRev - todayCogs - todayExp;
  const monthNet = monthRev - monthCogs - monthExp;

  const filteredNet = fRev - fCogs - fExp;

  // helper lấy khoảng thời gian filter
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
      const e = addDays(startOfDay(new Date(to)), 1); // inclusive end day
      return {
        start: s.toISOString(),
        end: e.toISOString(),
        label: `Từ ${from} đến ${to}`,
      };
    }
    // default: dùng range 7 ngày gần nhất cho “filtered block”
    const s = startOfDay(addDays(new Date(), -6));
    const e = addDays(startOfDay(new Date()), 1);
    return {
      start: s.toISOString(),
      end: e.toISOString(),
      label: `7 ngày gần nhất`,
    };
  };

  const sum = (arr: any[], key: string) =>
    arr.reduce((s, r) => s + Number(r[key] || 0), 0);

  const refreshDefault = async () => {
    const n = new Date();
    const todayStart = startOfDay(n);
    const todayEnd = addDays(todayStart, 1);
    const mStart = startOfMonth(n);
    const mEnd = nextMonth(mStart);

    const [oToday, oMonth, eToday, eMonth, stock] = await Promise.all([
      supabase
        .from("orders")
        .select("total,cogs_total")
        .eq("status", "completed")
        .gte("created_at", todayStart.toISOString())
        .lt("created_at", todayEnd.toISOString()),
      supabase
        .from("orders")
        .select("total,cogs_total")
        .eq("status", "completed")
        .gte("created_at", mStart.toISOString())
        .lt("created_at", mEnd.toISOString()),
      supabase
        .from("expenses")
        .select("amount")
        .gte("created_at", todayStart.toISOString())
        .lt("created_at", todayEnd.toISOString()),
      supabase
        .from("expenses")
        .select("amount")
        .gte("created_at", mStart.toISOString())
        .lt("created_at", mEnd.toISOString()),
      supabase
        .from("v_stock")
        .select("item_id,name,unit,low_stock_threshold,stock_qty"),
    ]);

    if (oToday.error) alert(oToday.error.message);
    if (oMonth.error) alert(oMonth.error.message);
    if (eToday.error) alert(eToday.error.message);
    if (eMonth.error) alert(eMonth.error.message);
    if (stock.error) alert(stock.error.message);

    setTodayRev(sum(oToday.data ?? [], "total"));
    setTodayCogs(sum(oToday.data ?? [], "cogs_total"));
    setTodayExp(sum(eToday.data ?? [], "amount"));

    setMonthRev(sum(oMonth.data ?? [], "total"));
    setMonthCogs(sum(oMonth.data ?? [], "cogs_total"));
    setMonthExp(sum(eMonth.data ?? [], "amount"));

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
  };

  const refreshFiltered = async () => {
    const r = getFilterRange();

    const [o, e] = await Promise.all([
      supabase
        .from("orders")
        .select("total,cogs_total")
        .eq("status", "completed")
        .gte("created_at", r.start)
        .lt("created_at", r.end),
      supabase
        .from("expenses")
        .select("amount")
        .gte("created_at", r.start)
        .lt("created_at", r.end),
    ]);

    if (o.error) alert(o.error.message);
    if (e.error) alert(e.error.message);

    setFRev(sum(o.data ?? [], "total"));
    setFCogs(sum(o.data ?? [], "cogs_total"));
    setFExp(sum(e.data ?? [], "amount"));
  };

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return (window.location.href = "/login");
      await refreshDefault();
      await refreshFiltered();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (mode === "range" && from > to) return;
    refreshFiltered();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, day, month, from, to]);

  const applyFilter = async () => {
    // validate range
    if (mode === "range" && from > to)
      return alert("Khoảng ngày không hợp lệ (from > to).");
    await refreshFiltered();
  };

  const exportReportExcel = async () => {
    const r = getFilterRange();

    const [o, e] = await Promise.all([
      supabase
        .from("orders")
        .select(
          "order_code,status,channel,total,cogs_total,gross_profit,created_at,customers(name,phone,address)"
        )
        .gte("created_at", r.start)
        .lt("created_at", r.end)
        .order("created_at", { ascending: false })
        .limit(5000),

      supabase
        .from("expenses")
        .select("title,amount,expense_type,campaign_id,created_at")
        .gte("created_at", r.start)
        .lt("created_at", r.end)
        .order("created_at", { ascending: false })
        .limit(5000),
    ]);

    if (o.error) return alert(o.error.message);
    if (e.error) return alert(e.error.message);

    const ordersRows = (o.data as any[]).map((x) => ({
      order_code: x.order_code,
      status: x.status,
      channel: x.channel,
      customer_name: x.customers?.name ?? "",
      customer_phone: x.customers?.phone ?? "",
      customer_address: x.customers?.address ?? "",
      total: x.total,
      cogs_total: x.cogs_total,
      gross_profit: x.gross_profit,
      created_at: x.created_at,
    }));

    const expensesRows = (e.data as any[]).map((x) => ({
      title: x.title,
      amount: x.amount,
      expense_type: x.expense_type ?? "",
      campaign_id: x.campaign_id ?? "",
      created_at: x.created_at,
    }));

    const safeLabel = r.label.replaceAll(" ", "_").replaceAll("/", "-");
    exportExcel(`amora_report_${safeLabel}.xlsx`, {
      Orders: ordersRows,
      Expenses: expensesRows,
    });
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
            <Link className="btn" href="/orders/new">
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
              Mặc định vẫn hiển thị “Hôm nay” và “Tháng này”. Phần dưới là theo
              bộ lọc.
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
              style={{ maxWidth: 190 }}
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

            <button className="btn" onClick={exportReportExcel}>
              Xuất Excel (Orders + Expenses)
            </button>
          </div>
        </div>
      </div>

      {/* DEFAULT KPI: TODAY */}
      <div className="grid" style={{ marginTop: 14 }}>
        <div className="kpi" style={{ gridColumn: "span 3" }}>
          <div className="t">Doanh thu hôm nay</div>
          <div className="v">{todayRev.toLocaleString()}</div>
        </div>
        <div className="kpi" style={{ gridColumn: "span 3" }}>
          <div className="t">Giá vốn hôm nay</div>
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

        {/* DEFAULT KPI: MONTH */}
        <div className="kpi" style={{ gridColumn: "span 3" }}>
          <div className="t">Doanh thu tháng</div>
          <div className="v">{monthRev.toLocaleString()}</div>
        </div>
        <div className="kpi" style={{ gridColumn: "span 3" }}>
          <div className="t">Giá vốn tháng</div>
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
          <span className="muted">Doanh thu - Giá vốn - Chi phí</span>
        </div>
        <div className="grid card-b">
          <div className="kpi" style={{ gridColumn: "span 4" }}>
            <div className="t">Doanh thu</div>
            <div className="v">{fRev.toLocaleString()}</div>
          </div>
          <div className="kpi" style={{ gridColumn: "span 4" }}>
            <div className="t">Giá vốn (COGS)</div>
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
