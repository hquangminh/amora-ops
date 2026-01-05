"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import BottomNav from "@/app/_components/BottomNav";
import Pagination from "@/app/_components/Pagination";

type AppRole = "admin" | "sales" | "accountant" | null;

type Line = {
  id?: string;
  description: string;
  amount: number; // VND integer
  is_void?: boolean;

  // UI-only (không lưu DB): để user gõ 26.850 / 26,850 / -26.850...
  amount_text?: string;
};

type Invoice = {
  id: string;
  date: string; // yyyy-mm-dd
  category: string;
  channel: string | null;
  vendor: string | null;
  invoice_no: string | null;
  note: string | null;

  vat_rate: number;
  amount_net: number;
  vat_amount: number;
  amount_gross: number;

  created_at: string;
  expense_lines?: (Line & { created_at?: string })[];
};

const defaultCats = ["Ads", "Ship", "Vật tư", "Vận hành", "WEBSITE", "Khác"];

/** yyyy-mm-dd */
function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}
function toMonthStr(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}
function monthRange(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const s = new Date(y, m - 1, 1);
  const e = new Date(y, m, 1);
  return {
    start: toDateStr(s),
    end: toDateStr(new Date(e.getTime() - 86400000)),
  };
}

/** VND thường không lẻ */
function roundVnd(n: number) {
  return Math.round(Number.isFinite(n) ? n : 0);
}

/** Format hiển thị VND */
function fmtVnd(n: number) {
  const x = roundVnd(n);
  return x.toLocaleString("vi-VN");
}

/**
 * Parse input tiền kiểu VN:
 * - "26.850" -> 26850
 * - "26,850" -> 26850
 * - "-26.850" -> -26850
 * - "-26,85" -> -2685 (vẫn đúng theo digits)
 *
 * Quy tắc: lấy sign từ dấu '-', rồi strip hết ký tự không phải digit.
 * => loại bỏ hoàn toàn lỗi locale decimal.
 */
function parseVndInput(raw: string) {
  const s = (raw ?? "").trim();
  if (!s) return 0;
  const sign = s.startsWith("-") ? -1 : 1;
  const digits = s.replace(/[^\d]/g, ""); // chỉ giữ số
  const n = digits ? Number(digits) : 0;
  return roundVnd(sign * n);
}

/** hiển thị trong input (để user dễ nhìn) */
function defaultAmountText(n: number) {
  // dùng vi-VN để có dấu chấm phân tách nghìn
  return fmtVnd(n);
}

export default function ExpensesPage() {
  const pageSize = 20;

  // auth + role
  const [role, setRole] = useState<AppRole>(null);
  const canWrite = role === "admin" || role === "accountant";
  const canRead = role === "admin" || role === "sales" || role === "accountant";

  // list state
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [rows, setRows] = useState<Invoice[]>([]);
  const [q, setQ] = useState("");

  // filter by date
  const now = useMemo(() => new Date(), []);
  const [mode, setMode] = useState<"all" | "month" | "range">("all");
  const [month, setMonth] = useState<string>(() => toMonthStr(now));
  const [from, setFrom] = useState<string>(() =>
    toDateStr(new Date(now.getTime() - 6 * 86400000))
  );
  const [to, setTo] = useState<string>(() => toDateStr(now));

  // form/edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const isEditing = !!editingId;

  const [date, setDate] = useState(() => toDateStr(new Date()));
  const [category, setCategory] = useState("Ads");
  const [channel, setChannel] = useState("Facebook");
  const [vendor, setVendor] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [note, setNote] = useState("");
  const [vatRate, setVatRate] = useState("0"); // %

  const [lines, setLines] = useState<Line[]>([
    { description: "Chi phí", amount: 0, amount_text: "0" },
  ]);

  const logout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const loadRole = async () => {
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes.user;
    if (!user) {
      window.location.href = "/login";
      return;
    }

    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) return setRole(null);
    setRole((data?.role as AppRole) ?? null);
  };

  const resetForm = () => {
    setEditingId(null);
    setDate(toDateStr(new Date()));
    setCategory("Ads");
    setChannel("Facebook");
    setVendor("");
    setInvoiceNo("");
    setNote("");
    setVatRate("0");
    setLines([{ description: "Chi phí", amount: 0, amount_text: "0" }]);
  };

  const computed = useMemo(() => {
    const effectiveLines = lines.filter((l) => !l.is_void);
    const netRaw = effectiveLines.reduce(
      (s, l) => s + roundVnd(l.amount || 0),
      0
    );

    const r = Number(vatRate || 0);
    const net = roundVnd(netRaw);
    const vat = roundVnd((net * r) / 100);
    const gross = roundVnd(net + vat);

    return { net, vat, gross };
  }, [lines, vatRate]);

  const addLine = () => {
    setLines((prev) => [
      ...prev,
      { description: "Dòng mới", amount: 0, amount_text: "0" },
    ]);
  };

  const voidLineAt = (idx: number) => {
    // policy: không xoá → void
    setLines((prev) =>
      prev.map((l, i) => (i === idx ? { ...l, is_void: true } : l))
    );
  };

  const updateLine = (idx: number, patch: Partial<Line>) => {
    setLines((prev) =>
      prev.map((l, i) => (i === idx ? { ...l, ...patch } : l))
    );
  };

  const buildDateFilter = (query: any) => {
    if (mode === "month") {
      const r = monthRange(month);
      return query.gte("date", r.start).lte("date", r.end);
    }
    if (mode === "range") {
      return query.gte("date", from).lte("date", to);
    }
    return query;
  };

  const fetchRows = async () => {
    if (!canRead) return;

    const fromIdx = (page - 1) * pageSize;
    const toIdx = fromIdx + pageSize - 1;

    let query = supabase
      .from("expense_invoices")
      .select(
        "id,date,category,channel,vendor,invoice_no,note,vat_rate,amount_net,vat_amount,amount_gross,created_at,expense_lines(id,description,amount,is_void,created_at)",
        { count: "exact" }
      );

    const qq = q.trim();
    if (qq) {
      query = query.or(
        `category.ilike.%${qq}%,channel.ilike.%${qq}%,note.ilike.%${qq}%,vendor.ilike.%${qq}%,invoice_no.ilike.%${qq}%`
      );
    }

    query = buildDateFilter(query);

    const { data, count, error } = await query
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .range(fromIdx, toIdx);

    if (error) return alert(error.message);

    const normalized = ((data as any) ?? []).map((x: any) => ({
      ...x,
      expense_lines: (x.expense_lines ?? []).sort((a: any, b: any) =>
        a.created_at > b.created_at ? 1 : -1
      ),
    }));

    setRows(normalized);
    setTotalCount(count ?? 0);
  };

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        window.location.href = "/login";
        return;
      }
      await loadRole();
      await fetchRows();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // đổi filter/search thì về trang 1
  useEffect(() => {
    setPage(1);
  }, [q, mode, month, from, to]);

  useEffect(() => {
    fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, q, mode, month, from, to, role]);

  const submitInvoice = async () => {
    if (!canWrite) return alert("Bạn không có quyền thêm/sửa chi phí.");

    if (!date) return alert("Chọn ngày.");
    const r = Number(vatRate || 0);
    if (r < 0 || r > 100) return alert("VAT rate không hợp lệ (0-100).");

    const effectiveLines = lines
      .filter((l) => !l.is_void)
      .map((l) => ({
        description: (l.description || "").trim(),
        amount: roundVnd(l.amount || 0),
      }))
      .filter((l) => l.description);

    if (effectiveLines.length === 0) {
      return alert("Cần ít nhất 1 dòng chi phí.");
    }

    // cho phép âm (discount), nhưng tổng net không nên âm
    const net = effectiveLines.reduce((s, l) => s + roundVnd(l.amount || 0), 0);
    if (!(net > 0)) {
      return alert("Tổng trước VAT phải > 0 (sau khi trừ giảm giá).");
    }

    const amount_net = roundVnd(net);
    const vat_amount = roundVnd((amount_net * r) / 100);
    const amount_gross = roundVnd(amount_net + vat_amount);

    const headerPayload = {
      date,
      category: category.trim() || "Khác",
      channel: channel.trim() || null,
      vendor: vendor.trim() || null,
      invoice_no: invoiceNo.trim() || null,
      note: note.trim() || null,
      vat_rate: r,
      amount_net,
      vat_amount,
      amount_gross,
    };

    if (!editingId) {
      // CREATE header
      const { data: inv, error: invErr } = await supabase
        .from("expense_invoices")
        .insert(headerPayload)
        .select("id")
        .single();

      if (invErr) return alert(invErr.message);

      // INSERT lines
      const linePayload = effectiveLines.map((l) => ({
        invoice_id: inv.id,
        description: l.description,
        amount: l.amount,
        is_void: false,
      }));

      const { error: lineErr } = await supabase
        .from("expense_lines")
        .insert(linePayload);

      if (lineErr) return alert(lineErr.message);

      resetForm();
      setPage(1);
      await fetchRows();
      return;
    }

    // UPDATE header
    const { error: upErr } = await supabase
      .from("expense_invoices")
      .update(headerPayload)
      .eq("id", editingId);

    if (upErr) return alert(upErr.message);

    // UPDATE lines strategy:
    // - nếu line có id: update (description/amount/is_void)
    // - nếu không có id: insert mới
    const existing = lines.filter((l) => l.id);
    for (const l of existing) {
      const { error } = await supabase
        .from("expense_lines")
        .update({
          description: (l.description || "").trim(),
          amount: roundVnd(l.amount || 0),
          is_void: !!l.is_void,
        })
        .eq("id", l.id!);

      if (error) return alert(error.message);
    }

    const newLines = lines.filter((l) => !l.id && !l.is_void);
    if (newLines.length) {
      const payload = newLines
        .map((l) => ({
          invoice_id: editingId,
          description: (l.description || "").trim(),
          amount: roundVnd(l.amount || 0),
          is_void: false,
        }))
        .filter((x) => x.description);

      if (payload.length) {
        const { error } = await supabase.from("expense_lines").insert(payload);
        if (error) return alert(error.message);
      }
    }

    resetForm();
    await fetchRows();
  };

  const onEdit = (inv: Invoice) => {
    if (!canWrite) return alert("Bạn không có quyền sửa chi phí.");

    setEditingId(inv.id);
    setDate(inv.date);
    setCategory(inv.category ?? "Khác");
    setChannel(inv.channel ?? "");
    setVendor(inv.vendor ?? "");
    setInvoiceNo(inv.invoice_no ?? "");
    setNote(inv.note ?? "");
    setVatRate(String(inv.vat_rate ?? 0));

    const loadedLines = (inv.expense_lines ?? []).map((l) => {
      const amt = roundVnd(Number(l.amount || 0));
      return {
        id: l.id,
        description: l.description,
        amount: amt,
        amount_text: defaultAmountText(amt),
        is_void: !!l.is_void,
      };
    });

    setLines(
      loadedLines.length
        ? loadedLines
        : [{ description: "Chi phí", amount: 0, amount_text: "0" }]
    );

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const pageTotal = useMemo(
    () => rows.reduce((s, r) => s + Number(r.amount_gross || 0), 0),
    [rows]
  );

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
          <span>Chi phí</span>
          <span className="badge">Amora</span>
        </div>

        <div className="row">
          <Link className="btn" href="/dashboard">
            ← Dashboard
          </Link>
          <button className="btn" onClick={fetchRows}>
            ↻
          </button>
          <button className="btn" onClick={logout}>
            Logout
          </button>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="card" style={{ marginTop: 14 }}>
        <div className="card-h" style={{ justifyContent: "space-between" }}>
          <div>
            <h2 className="h2">Bộ lọc</h2>
            <p className="p">
              Role hiện tại: <b>{role ?? "(chưa có)"}</b>
            </p>
          </div>

          <div className="row" style={{ gap: 10, alignItems: "center" }}>
            <select
              className="select"
              value={mode}
              onChange={(e) => setMode(e.target.value as any)}
              style={{ maxWidth: 200 }}
            >
              <option value="all">Tất cả</option>
              <option value="month">Theo tháng</option>
              <option value="range">Theo khoảng</option>
            </select>

            {mode === "month" && (
              <input
                className="input"
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                style={{ width: 180 }}
              />
            )}

            {mode === "range" && (
              <>
                <input
                  className="input"
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  style={{ width: 160 }}
                />
                <input
                  className="input"
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  style={{ width: 160 }}
                />
              </>
            )}

            <input
              className="input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm vendor / invoice no / nhóm / kênh / ghi chú..."
              style={{ width: 360 }}
            />
          </div>
        </div>
      </div>

      {/* CREATE / EDIT */}
      {canWrite && (
        <div className="card" style={{ marginTop: 14 }}>
          <div className="card-h" style={{ justifyContent: "space-between" }}>
            <div>
              <h2 className="h2">
                {isEditing ? "Sửa bill chi phí" : "Nhập bill chi phí"}
              </h2>
              <p className="p">
                1 bill nhiều dòng (dịch vụ + giảm giá) + VAT tự tính.
              </p>
            </div>

            <div className="muted" style={{ textAlign: "right" }}>
              <div>
                Net: <b>{fmtVnd(computed.net)}</b>
              </div>
              <div>
                VAT: <b>{fmtVnd(computed.vat)}</b>
              </div>
              <div>
                Gross: <b>{fmtVnd(computed.gross)}</b>
              </div>
            </div>
          </div>

          <div className="card-b">
            <div className="grid">
              <div className="field" style={{ gridColumn: "span 3" }}>
                <div className="label">Ngày (ngày thanh toán / ghi nhận)</div>
                <input
                  className="input"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>

              <div className="field" style={{ gridColumn: "span 3" }}>
                <div className="label">Nhóm</div>
                <input
                  className="input"
                  list="cats"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                />
                <datalist id="cats">
                  {defaultCats.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>

              <div className="field" style={{ gridColumn: "span 3" }}>
                <div className="label">Kênh (tuỳ chọn)</div>
                <input
                  className="input"
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                  placeholder="WEBSITE / Facebook / Shopee..."
                />
              </div>

              <div className="field" style={{ gridColumn: "span 3" }}>
                <div className="label">VAT (%)</div>
                <input
                  className="input"
                  inputMode="numeric"
                  value={vatRate}
                  onChange={(e) => setVatRate(e.target.value)}
                  placeholder="8"
                />
              </div>

              <div className="field" style={{ gridColumn: "span 4" }}>
                <div className="label">Vendor (tuỳ chọn)</div>
                <input
                  className="input"
                  value={vendor}
                  onChange={(e) => setVendor(e.target.value)}
                  placeholder="Vietnix / Meta / ..."
                />
              </div>

              <div className="field" style={{ gridColumn: "span 4" }}>
                <div className="label">Invoice No / Mã GD (tuỳ chọn)</div>
                <input
                  className="input"
                  value={invoiceNo}
                  onChange={(e) => setInvoiceNo(e.target.value)}
                  placeholder="VCB-... / INV-..."
                />
              </div>

              <div className="field" style={{ gridColumn: "span 4" }}>
                <div className="label">Ghi chú (tuỳ chọn)</div>
                <input
                  className="input"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Bill hosting + domain..."
                />
              </div>

              <div className="field" style={{ gridColumn: "span 12" }}>
                <div className="label">
                  Các dòng trong bill (amount có thể âm nếu là giảm giá). Nhập
                  được: 26850 / 26,850 / 26.850 / -26,850 / -26.850
                </div>

                <div className="tableWrap" style={{ marginTop: 8 }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Mô tả</th>
                        <th className="right" style={{ width: 220 }}>
                          Số tiền (VND)
                        </th>
                        <th style={{ width: 140 }}>Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((l, idx) => {
                        const isNeg = Number(l.amount || 0) < 0;
                        return (
                          <tr
                            key={l.id ?? idx}
                            style={l.is_void ? { opacity: 0.45 } : undefined}
                          >
                            <td>
                              <input
                                className="input"
                                value={l.description}
                                onChange={(e) =>
                                  updateLine(idx, {
                                    description: e.target.value,
                                  })
                                }
                                placeholder="VD: HOSTING 3 tháng / Domain 1 năm / Discount..."
                                disabled={!!l.is_void}
                              />
                            </td>

                            <td className="right">
                              <input
                                className="input"
                                type="text"
                                inputMode="numeric"
                                value={
                                  l.amount_text ??
                                  (Number.isFinite(l.amount)
                                    ? defaultAmountText(l.amount)
                                    : "0")
                                }
                                onChange={(e) => {
                                  const raw = e.target.value;
                                  // user đang gõ -> giữ raw
                                  const parsed = parseVndInput(raw);
                                  updateLine(idx, {
                                    amount_text: raw,
                                    amount: parsed,
                                  });
                                }}
                                onBlur={() => {
                                  // normalize khi blur -> format đẹp
                                  const parsed = roundVnd(l.amount || 0);
                                  updateLine(idx, {
                                    amount: parsed,
                                    amount_text: defaultAmountText(parsed),
                                  });
                                }}
                                disabled={!!l.is_void}
                                style={
                                  isNeg
                                    ? { color: "#ff6b6b", fontWeight: 700 }
                                    : undefined
                                }
                                placeholder="VD: 537000 hoặc -26850"
                              />
                            </td>

                            <td>
                              {!l.is_void ? (
                                <button
                                  className="btn"
                                  onClick={() => voidLineAt(idx)}
                                >
                                  Huỷ dòng
                                </button>
                              ) : (
                                <span
                                  className="muted"
                                  style={{ fontSize: 12 }}
                                >
                                  (đã huỷ)
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {lines.length === 0 && (
                        <tr>
                          <td colSpan={3} className="muted">
                            Chưa có dòng nào.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    flexWrap: "wrap",
                    marginTop: 10,
                  }}
                >
                  <button className="btn" onClick={addLine}>
                    + Thêm dòng
                  </button>

                  <button className="btn primary" onClick={submitInvoice}>
                    {isEditing ? "✓ Cập nhật bill" : "+ Lưu bill"}
                  </button>

                  {isEditing && (
                    <button className="btn" onClick={resetForm}>
                      Huỷ
                    </button>
                  )}
                </div>

                <p className="p muted" style={{ marginTop: 10 }}>
                  * Policy: không xoá bill/dòng. Khi cần bỏ 1 dòng, dùng “Huỷ
                  dòng”.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LIST */}
      <div className="card" style={{ marginTop: 14 }}>
        <div className="card-h" style={{ justifyContent: "space-between" }}>
          <div>
            <h2 className="h2">Danh sách bill</h2>
            <p className="p">
              Tổng: <b>{totalCount}</b> bill • Tổng tiền (trang này, gross):{" "}
              <b>{fmtVnd(pageTotal)}</b>
            </p>
          </div>
          <span className="muted">Mỗi trang {pageSize}</span>
        </div>

        <div className="card-b" style={{ padding: 0 }}>
          <div className="tableWrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Ngày</th>
                  <th>Nhóm</th>
                  <th>Vendor</th>
                  <th>Invoice</th>
                  <th className="right">Net</th>
                  <th className="right">VAT</th>
                  <th className="right">Gross</th>
                  <th style={{ width: 140 }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((inv) => (
                  <>
                    <tr key={inv.id}>
                      <td>{inv.date}</td>
                      <td>
                        <b>{inv.category}</b>
                        <div className="muted" style={{ fontSize: 12 }}>
                          {inv.channel ?? "-"}
                        </div>
                      </td>
                      <td className="muted">{inv.vendor ?? "-"}</td>
                      <td className="muted">
                        {inv.invoice_no ?? "-"}
                        {inv.note ? (
                          <div style={{ fontSize: 12 }}>{inv.note}</div>
                        ) : null}
                      </td>
                      <td className="right">
                        {fmtVnd(Number(inv.amount_net || 0))}
                      </td>
                      <td className="right">
                        {fmtVnd(Number(inv.vat_amount || 0))}
                      </td>
                      <td className="right">
                        <b>{fmtVnd(Number(inv.amount_gross || 0))}</b>
                      </td>
                      <td>
                        {canWrite ? (
                          <button className="btn" onClick={() => onEdit(inv)}>
                            Sửa
                          </button>
                        ) : (
                          <span className="muted" style={{ fontSize: 12 }}>
                            (Chỉ admin/kế toán)
                          </span>
                        )}
                      </td>
                    </tr>

                    {/* Lines */}
                    <tr
                      key={`${inv.id}-lines`}
                      style={{ background: "rgba(255,255,255,0.02)" }}
                    >
                      <td colSpan={8} style={{ padding: 10 }}>
                        <div
                          className="muted"
                          style={{ fontSize: 12, marginBottom: 6 }}
                        >
                          Chi tiết dòng:
                        </div>
                        <div className="tableWrap">
                          <table className="table">
                            <thead>
                              <tr>
                                <th>Mô tả</th>
                                <th className="right" style={{ width: 220 }}>
                                  Số tiền
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {(inv.expense_lines ?? [])
                                .filter((l) => !l.is_void)
                                .map((l) => {
                                  const amt = roundVnd(Number(l.amount || 0));
                                  const isNeg = amt < 0;
                                  return (
                                    <tr key={l.id}>
                                      <td className="muted">{l.description}</td>
                                      <td
                                        className="right"
                                        style={
                                          isNeg
                                            ? {
                                                color: "#ff6b6b",
                                                fontWeight: 700,
                                              }
                                            : undefined
                                        }
                                      >
                                        {fmtVnd(amt)}
                                      </td>
                                    </tr>
                                  );
                                })}
                              {(inv.expense_lines ?? []).filter(
                                (l) => !l.is_void
                              ).length === 0 && (
                                <tr>
                                  <td colSpan={2} className="muted">
                                    Không có dòng.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  </>
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
              total={totalCount}
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
