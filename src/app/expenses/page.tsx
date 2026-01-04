"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import BottomNav from "@/app/_components/BottomNav";
import Pagination from "@/app/_components/Pagination";

type Expense = {
  id: string;
  date: string;
  category: string;
  amount: number;
  channel: string | null;
  note: string | null;
  created_at: string;
};

const defaultCats = ["Ads", "Ship", "Vật tư", "Vận hành", "Khác"];

export default function ExpensesPage() {
  const pageSize = 20;
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [rows, setRows] = useState<Expense[]>([]);
  const [q, setQ] = useState("");

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState("Ads");
  const [amount, setAmount] = useState("0");
  const [channel, setChannel] = useState("Facebook");
  const [note, setNote] = useState("");

  const fetchRows = async () => {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from("expenses")
      .select("id,date,category,amount,channel,note,created_at", {
        count: "exact",
      });

    const qq = q.trim();
    if (qq) {
      query = query.or(
        `category.ilike.%${qq}%,channel.ilike.%${qq}%,note.ilike.%${qq}%`
      );
    }

    const { data, count, error } = await query
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) return alert(error.message);
    setRows((data as Expense[]) ?? []);
    setTotalCount(count ?? 0);
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) window.location.href = "/login";
      else fetchRows();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // đổi search thì về trang 1
  useEffect(() => {
    setPage(1);
  }, [q]);

  useEffect(() => {
    fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, q]);

  const createExpense = async () => {
    const a = Number(amount);
    if (!(a > 0)) return alert("Số tiền phải > 0");

    const { error } = await supabase.from("expenses").insert({
      date,
      category: category.trim() || "Khác",
      amount: a,
      channel: channel.trim() || null,
      note: note.trim() || null,
    });

    if (error) return alert(error.message);

    setAmount("0");
    setNote("");

    setPage(1);
    await fetchRows();
  };

  // Tổng tiền theo trang đang xem (đúng UX cho phân trang)
  const pageTotal = useMemo(
    () => rows.reduce((s, r) => s + Number(r.amount || 0), 0),
    [rows]
  );

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
        </div>
      </div>

      {/* CREATE */}
      <div className="card" style={{ marginTop: 14 }}>
        <div className="card-h">
          <div>
            <h2 className="h2">Nhập chi phí</h2>
            <p className="p">Nhập nhanh 10 giây.</p>
          </div>
          <span className="muted">Mỗi trang {pageSize}</span>
        </div>

        <div className="card-b">
          <div className="grid">
            <div className="field" style={{ gridColumn: "span 3" }}>
              <div className="label">Ngày</div>
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
              <div className="label">Số tiền</div>
              <input
                className="input"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>

            <div className="field" style={{ gridColumn: "span 3" }}>
              <div className="label">Kênh (tuỳ chọn)</div>
              <input
                className="input"
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                placeholder="Facebook / Shopee / Offline..."
              />
            </div>

            <div className="field" style={{ gridColumn: "span 12" }}>
              <div className="label">Ghi chú</div>
              <input
                className="input"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ví dụ: ads tuần 1 / in tem / ship..."
              />
            </div>

            <div style={{ gridColumn: "span 12" }}>
              <button className="btn primary" onClick={createExpense}>
                + Thêm chi phí
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* LIST */}
      <div className="card" style={{ marginTop: 14 }}>
        <div className="card-h">
          <div>
            <h2 className="h2">Danh sách</h2>
            <p className="p">
              Tổng: <b>{totalCount}</b> dòng • Tổng tiền (trang này):{" "}
              <b>{pageTotal.toLocaleString()}</b>
            </p>
          </div>

          <input
            className="input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm theo nhóm/kênh/ghi chú..."
            style={{ maxWidth: 360 }}
          />
        </div>

        <div className="card-b" style={{ padding: 0 }}>
          <div className="tableWrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Ngày</th>
                  <th>Nhóm</th>
                  <th>Kênh</th>
                  <th>Ghi chú</th>
                  <th className="right">Số tiền</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.date}</td>
                    <td>
                      <b>{r.category}</b>
                    </td>
                    <td className="muted">{r.channel ?? "-"}</td>
                    <td className="muted">{r.note ?? "-"}</td>
                    <td className="right">
                      <b>{Number(r.amount).toLocaleString()}</b>
                    </td>
                  </tr>
                ))}

                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="muted">
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
