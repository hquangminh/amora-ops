"use client";

import { useEffect, useMemo, useState } from "react";
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

type AppRole = "admin" | "sales" | "accountant" | null;

export default function CustomersPage() {
  const pageSize = 20;

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [rows, setRows] = useState<Customer[]>([]);
  const [q, setQ] = useState("");

  // form
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");

  // edit mode
  const [editingId, setEditingId] = useState<string | null>(null);
  const isEditing = useMemo(() => !!editingId, [editingId]);

  // auth + role
  const [role, setRole] = useState<AppRole>(null);

  const canDelete = role === "admin"; // chỉ admin được xoá (đúng với RLS bạn muốn)

  const resetForm = () => {
    setName("");
    setPhone("");
    setAddress("");
    setNote("");
    setEditingId(null);
  };

  const loadRole = async () => {
    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr) throw userErr;
    const user = userRes.user;
    if (!user) {
      window.location.href = "/login";
      return;
    }

    // đọc role từ user_roles (tránh enum cast lỗi)
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      // nếu chưa có user_roles row thì coi như null
      setRole(null);
      return;
    }

    setRole((data?.role as AppRole) ?? null);
  };

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

  // đổi search thì về trang 1
  useEffect(() => {
    setPage(1);
  }, [q]);

  useEffect(() => {
    fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, q]);

  const submitCustomer = async () => {
    const n = name.trim();
    if (!n) return alert("Nhập tên khách");

    const payload = {
      name: n,
      phone: phone.trim() || null,
      address: address.trim() || null,
      note: note.trim() || null,
    };

    if (!editingId) {
      // CREATE
      const { error } = await supabase.from("customers").insert(payload);
      if (error) return alert(error.message);

      resetForm();
      setPage(1);
      await fetchRows();
      return;
    }

    // UPDATE
    const { error } = await supabase
      .from("customers")
      .update(payload)
      .eq("id", editingId);

    if (error) return alert(error.message);

    resetForm();
    await fetchRows();
  };

  const onEdit = (c: Customer) => {
    setEditingId(c.id);
    setName(c.name ?? "");
    setPhone(c.phone ?? "");
    setAddress(c.address ?? "");
    setNote(c.note ?? "");
    // scroll lên form cho dễ thao tác
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const onDelete = async (c: Customer) => {
    if (!canDelete) {
      alert("Chỉ admin mới được xoá khách hàng.");
      return;
    }
    const ok = confirm(
      `Xoá khách "${c.name}"?\n(Hành động này không thể hoàn tác)`
    );
    if (!ok) return;

    const { error } = await supabase.from("customers").delete().eq("id", c.id);
    if (error) return alert(error.message);

    // nếu xoá xong trang hiện tại bị trống, lùi trang (optional)
    const newTotal = Math.max(0, total - 1);
    const maxPage = Math.max(1, Math.ceil(newTotal / pageSize));
    if (page > maxPage) setPage(maxPage);

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

      {/* CREATE / EDIT */}
      <div className="card" style={{ marginTop: 14 }}>
        <div className="card-h">
          <div>
            <h2 className="h2">
              {isEditing ? "Sửa khách hàng" : "Thêm khách hàng"}
            </h2>
            <p className="p">Tên + SĐT + địa chỉ để tạo đơn nhanh.</p>
            {role && (
              <p className="p" style={{ marginTop: 6 }}>
                Role hiện tại: <b>{role}</b>
              </p>
            )}
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

            <div
              style={{
                gridColumn: "span 12",
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <button className="btn primary" onClick={submitCustomer}>
                {isEditing ? "✓ Cập nhật" : "+ Thêm khách"}
              </button>

              {isEditing && (
                <button className="btn" onClick={resetForm}>
                  Huỷ
                </button>
              )}
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
                  <th style={{ width: 160 }}>Thao tác</th>
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
                    <td>
                      <div
                        style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
                      >
                        <button className="btn" onClick={() => onEdit(c)}>
                          Sửa
                        </button>
                        {canDelete ? (
                          <button
                            className="btn danger"
                            onClick={() => onDelete(c)}
                          >
                            Xoá
                          </button>
                        ) : (
                          <span className="muted" style={{ fontSize: 12 }}>
                            (Admin mới xoá)
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}

                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="muted">
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
