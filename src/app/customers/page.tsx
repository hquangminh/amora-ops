"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import BottomNav from "@/app/_components/BottomNav";
import Pagination from "@/app/_components/Pagination";

type Customer = {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  note: string | null;
  created_at: string;
};

export default function CustomersPage() {
  const pageSize = 20;
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [rows, setRows] = useState<Customer[]>([]);
  const [q, setQ] = useState("");

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");

  const fetchRows = async () => {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from("customers")
      .select("id,name,phone,address,note,created_at", { count: "exact" });

    const qq = q.trim();
    if (qq) {
      query = query.or(
        `name.ilike.%${qq}%,phone.ilike.%${qq}%,address.ilike.%${qq}%`
      );
    }

    const { data, count, error } = await query
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) return alert(error.message);
    setRows((data as Customer[]) ?? []);
    setTotal(count ?? 0);
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

  const createCustomer = async () => {
    const n = name.trim();
    if (!n) return alert("Nhập tên khách");

    const { error } = await supabase.from("customers").insert({
      name: n,
      phone: phone.trim() || null,
      address: address.trim() || null,
      note: note.trim() || null,
    });

    if (error) return alert(error.message);

    setName("");
    setPhone("");
    setAddress("");
    setNote("");

    setPage(1);
    await fetchRows();
  };

  return (
    <div className="container">
      <div className="topbar">
        <div className="brand">
          <span>Khách hàng</span>
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
            <h2 className="h2">Thêm khách hàng</h2>
            <p className="p">Tên + SĐT + địa chỉ để tạo đơn nhanh.</p>
          </div>
          <span className="muted">Mỗi trang {pageSize}</span>
        </div>

        <div className="card-b">
          <div className="grid">
            <div className="field" style={{ gridColumn: "span 4" }}>
              <div className="label">Tên</div>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="field" style={{ gridColumn: "span 4" }}>
              <div className="label">SĐT</div>
              <input
                className="input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div className="field" style={{ gridColumn: "span 4" }}>
              <div className="label">Địa chỉ</div>
              <input
                className="input"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>
            <div className="field" style={{ gridColumn: "span 12" }}>
              <div className="label">Ghi chú</div>
              <input
                className="input"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
            <div style={{ gridColumn: "span 12" }}>
              <button className="btn primary" onClick={createCustomer}>
                + Thêm khách
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
            <p className="p">{total} khách</p>
          </div>
          <input
            className="input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm theo tên / sđt / địa chỉ..."
            style={{ maxWidth: 360 }}
          />
        </div>

        <div className="card-b" style={{ padding: 0 }}>
          <div className="tableWrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Tên</th>
                  <th>SĐT</th>
                  <th>Địa chỉ</th>
                  <th>Ghi chú</th>
                  <th>Ngày tạo</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <b>{c.name}</b>
                    </td>
                    <td className="muted">{c.phone ?? "-"}</td>
                    <td className="muted">{c.address ?? "-"}</td>
                    <td className="muted">{c.note ?? "-"}</td>
                    <td className="muted">
                      {new Date(c.created_at).toLocaleString()}
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
