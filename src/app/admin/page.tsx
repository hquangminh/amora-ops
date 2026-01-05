"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import BottomNav from "@/app/_components/BottomNav";
import { supabase } from "@/lib/supabaseClient";
import { getMyRole, type AppRole } from "@/lib/getRole";

type UserRoleRow = {
  user_id: string;
  role: "admin" | "sales" | "accountant";
  created_at: string;
};

export default function AdminPage() {
  const [role, setRole] = useState<AppRole | null>(null);
  const [rows, setRows] = useState<UserRoleRow[]>([]);
  const [userId, setUserId] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "sales" | "accountant">(
    "sales"
  );

  const refresh = async () => {
    const { data, error } = await supabase
      .from("user_roles")
      .select("user_id,role,created_at")
      .order("created_at", { ascending: false });

    if (error) return alert(error.message);
    setRows((data as any) ?? []);
  };

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return (window.location.href = "/login");
      const r = await getMyRole();
      setRole(r);
      if (r !== "admin") return;
      await refresh();
    });
  }, []);

  const upsertRole = async () => {
    if (role !== "admin") return alert("Chỉ admin mới vào được trang này.");

    const uid = userId.trim();
    if (!uid) return alert("Dán user_id (UID) vào");

    const { error } = await supabase.from("user_roles").upsert({
      user_id: uid,
      role: newRole,
    });

    if (error) return alert(error.message);
    setUserId("");
    await refresh();
  };

  if (role !== "admin") {
    return (
      <div className="container">
        <div className="topbar">
          <div className="brand">
            <span>Admin</span>
            <span className="badge">RBAC</span>
          </div>
          <Link className="btn" href="/dashboard">
            ← Dashboard
          </Link>
        </div>

        <div className="card" style={{ marginTop: 14 }}>
          <div className="card-b">
            <b>Không có quyền.</b>
            <div className="muted" style={{ marginTop: 8 }}>
              Trang này chỉ dành cho Admin.
            </div>
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
          <span>Admin</span>
          <span className="badge">Users</span>
        </div>
        <div className="row">
          <Link className="btn" href="/dashboard">
            ← Dashboard
          </Link>
          <button className="btn" onClick={refresh}>
            ↻
          </button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="card-h">
          <div>
            <h2 className="h2">Gán role</h2>
            <p className="p">
              Dán UID từ Supabase Auth → Users. Role: admin / sales / accountant
            </p>
          </div>
          <span className="muted" style={{ fontSize: 13 }}>
            Role: <b>{role}</b>
          </span>
        </div>

        <div className="card-b">
          <div className="grid">
            <div className="field" style={{ gridColumn: "span 8" }}>
              <div className="label">User ID (UID)</div>
              <input
                className="input"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="dán user_id (uuid) ở đây"
              />
            </div>

            <div className="field" style={{ gridColumn: "span 4" }}>
              <div className="label">Role</div>
              <select
                className="select"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as any)}
              >
                <option value="sales">sales</option>
                <option value="accountant">accountant</option>
                <option value="admin">admin</option>
              </select>
            </div>

            <div style={{ gridColumn: "span 12" }}>
              <button className="btn primary" onClick={upsertRole}>
                Lưu role
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="card-h">
          <div>
            <h2 className="h2">Danh sách user_roles</h2>
            <p className="p">{rows.length} user</p>
          </div>
        </div>

        <div className="card-b" style={{ padding: 0 }}>
          <div className="tableWrap">
            <table className="table">
              <thead>
                <tr>
                  <th>User ID</th>
                  <th>Role</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.user_id}>
                    <td className="muted">{r.user_id}</td>
                    <td>
                      <b>{r.role}</b>
                    </td>
                    <td className="muted">
                      {new Date(r.created_at).toLocaleString("vi-VN")}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={3} className="muted">
                      Chưa có dữ liệu.
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
