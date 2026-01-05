"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import BottomNav from "@/app/_components/BottomNav";
import { supabase } from "@/lib/supabaseClient";
import { getMyRole } from "@/lib/getRole";
import Pagination from "@/app/_components/Pagination";

type Campaign = {
  id: string;
  name: string;
  channel: string;
  start_date: string | null;
  end_date: string | null;
  note: string | null;
  is_active: boolean;
  created_at: string;
};

export default function CampaignsPage() {
  const [role, setRole] = useState<"admin" | "sales" | "accountant" | null>(
    null
  );
  const isAdmin = role === "admin";

  const [rows, setRows] = useState<Campaign[]>([]);

  // form (create + edit)
  const [editingId, setEditingId] = useState<string | null>(null);
  const isEditing = !!editingId;

  const [name, setName] = useState("");
  const [channel, setChannel] = useState("Facebook");
  const [start, setStart] = useState<string>(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [end, setEnd] = useState<string>("");
  const [note, setNote] = useState("");

  const [q, setQ] = useState("");
  const [onlyActive, setOnlyActive] = useState(true);

  const pageSize = 20;
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setChannel("Facebook");
    setStart(new Date().toISOString().slice(0, 10));
    setEnd("");
    setNote("");
  };

  const fetchRows = async (p = page) => {
    const from = (p - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from("ad_campaigns")
      .select("id,name,channel,start_date,end_date,note,is_active,created_at", {
        count: "exact",
      });

    if (onlyActive) query = query.eq("is_active", true);

    const qq = q.trim();
    if (qq) {
      query = query.or(
        `name.ilike.%${qq}%,channel.ilike.%${qq}%,note.ilike.%${qq}%`
      );
    }

    const { data, count, error } = await query
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) return alert(error.message);

    setRows((data as Campaign[]) ?? []);
    setTotal(count ?? 0);
  };

  const refresh = async () => {
    setPage(1);
    await fetchRows(1);
  };

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return (window.location.href = "/login");
      setRole(await getMyRole());
      await refresh();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // đổi search / onlyActive thì về trang 1 và fetch lại
  useEffect(() => {
    setPage(1);
    fetchRows(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, onlyActive]);

  useEffect(() => {
    fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const createCampaign = async () => {
    if (!isAdmin) return alert("Chỉ admin mới được tạo campaign.");
    const n = name.trim();
    if (!n) return alert("Nhập tên campaign");

    const payload: any = {
      name: n,
      channel: channel.trim() || "Facebook",
      start_date: start || null,
      end_date: end.trim() || null,
      note: note.trim() || null,
      is_active: true,
    };

    const { error } = await supabase.from("ad_campaigns").insert(payload);
    if (error) return alert(error.message);

    resetForm();
    await refresh();
  };

  const startEdit = (r: Campaign) => {
    if (!isAdmin) return alert("Chỉ admin mới được sửa campaign.");
    setEditingId(r.id);
    setName(r.name ?? "");
    setChannel(r.channel ?? "Facebook");
    setStart(r.start_date ?? new Date().toISOString().slice(0, 10));
    setEnd(r.end_date ?? "");
    setNote(r.note ?? "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const updateCampaign = async () => {
    if (!isAdmin) return alert("Chỉ admin mới được sửa campaign.");
    if (!editingId) return;

    const n = name.trim();
    if (!n) return alert("Nhập tên campaign");

    const payload: any = {
      name: n,
      channel: channel.trim() || "Facebook",
      start_date: start || null,
      end_date: end.trim() || null,
      note: note.trim() || null,
    };

    const { error } = await supabase
      .from("ad_campaigns")
      .update(payload)
      .eq("id", editingId);

    if (error) return alert(error.message);

    resetForm();
    await refresh();
  };

  const toggleActive = async (id: string, next: boolean) => {
    if (!isAdmin) return alert("Chỉ admin mới được bật/tắt campaign.");
    const { error } = await supabase
      .from("ad_campaigns")
      .update({ is_active: next })
      .eq("id", id);
    if (error) return alert(error.message);
    await refresh();
  };

  const deleteCampaign = async (id: string) => {
    if (!isAdmin) return alert("Chỉ admin mới được xoá campaign.");
    if (
      !confirm(
        "XOÁ THẬT campaign này? (không khôi phục). Nếu đã được link vào expense/order thì DB có thể chặn."
      )
    )
      return;

    const { error } = await supabase.from("ad_campaigns").delete().eq("id", id);
    if (error) return alert(error.message);

    // nếu đang sửa đúng cái bị xoá thì reset form
    if (editingId === id) resetForm();

    await refresh();
  };

  const listCountLabel = useMemo(() => {
    // total là count theo DB đã filter/ search
    return `${total} campaign`;
  }, [total]);

  return (
    <div className="container">
      <div className="topbar">
        <div className="brand">
          <span>Campaigns</span>
          <span className="badge">Ads</span>
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

      {/* CREATE / EDIT */}
      <div className="card" style={{ marginTop: 14 }}>
        <div className="card-h">
          <div>
            <h2 className="h2">
              {isEditing ? "Sửa campaign" : "Tạo campaign"}
            </h2>
            <p className="p">Ví dụ: “FB Ads Tết 2026”, “Chụp ảnh bộ 1/2026”.</p>
          </div>
          <span className="muted" style={{ fontSize: 13 }}>
            Role: <b>{role ?? "?"}</b>
          </span>
        </div>

        <div className="card-b">
          <div className="grid">
            <div className="field" style={{ gridColumn: "span 4" }}>
              <div className="label">Tên campaign</div>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!isAdmin}
              />
            </div>

            <div className="field" style={{ gridColumn: "span 3" }}>
              <div className="label">Kênh</div>
              <input
                className="input"
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                placeholder="Facebook / Shopee / Tiktok..."
                disabled={!isAdmin}
              />
            </div>

            <div className="field" style={{ gridColumn: "span 2" }}>
              <div className="label">Start</div>
              <input
                className="input"
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                disabled={!isAdmin}
              />
            </div>

            <div className="field" style={{ gridColumn: "span 2" }}>
              <div className="label">End (tuỳ chọn)</div>
              <input
                className="input"
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                disabled={!isAdmin}
              />
            </div>

            <div className="field" style={{ gridColumn: "span 12" }}>
              <div className="label">Ghi chú</div>
              <input
                className="input"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                disabled={!isAdmin}
              />
            </div>

            <div style={{ gridColumn: "span 12" }}>
              {!isEditing ? (
                <>
                  <button
                    className="btn primary"
                    onClick={createCampaign}
                    disabled={!isAdmin}
                  >
                    + Tạo campaign
                  </button>
                  {!isAdmin && (
                    <span className="muted" style={{ marginLeft: 10 }}>
                      Sales/Accountant chỉ xem.
                    </span>
                  )}
                </>
              ) : (
                <>
                  <button
                    className="btn primary"
                    onClick={updateCampaign}
                    disabled={!isAdmin}
                  >
                    ✓ Cập nhật
                  </button>
                  <button
                    className="btn"
                    onClick={resetForm}
                    style={{ marginLeft: 10 }}
                  >
                    Huỷ
                  </button>
                </>
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
            <p className="p">{listCountLabel}</p>
          </div>

          <div className="row" style={{ alignItems: "center" }}>
            <label className="muted" style={{ fontSize: 13 }}>
              <input
                type="checkbox"
                checked={onlyActive}
                onChange={(e) => setOnlyActive(e.target.checked)}
                style={{ marginRight: 6 }}
              />
              Chỉ Active
            </label>

            <input
              className="input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm tên/kênh/ghi chú..."
              style={{ maxWidth: 360 }}
            />
          </div>
        </div>

        <div className="card-b" style={{ padding: 0 }}>
          <div className="tableWrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Tên</th>
                  <th>Kênh</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Ghi chú</th>
                  <th className="right">Trạng thái</th>
                  <th style={{ width: 260 }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <b>{r.name}</b>
                    </td>
                    <td className="muted">{r.channel}</td>
                    <td className="muted">{r.start_date ?? "-"}</td>
                    <td className="muted">{r.end_date ?? "-"}</td>
                    <td className="muted">{r.note ?? "-"}</td>

                    <td className="right">
                      {r.is_active ? (
                        <button
                          className="btn"
                          onClick={() => toggleActive(r.id, false)}
                          disabled={!isAdmin}
                        >
                          Active
                        </button>
                      ) : (
                        <button
                          className="btn"
                          onClick={() => toggleActive(r.id, true)}
                          disabled={!isAdmin}
                        >
                          Inactive
                        </button>
                      )}
                    </td>

                    <td>
                      <div
                        style={{ display: "flex", gap: 10, flexWrap: "wrap" }}
                      >
                        <button
                          className="btn"
                          onClick={() => startEdit(r)}
                          disabled={!isAdmin}
                        >
                          Sửa
                        </button>

                        {/* Nếu bạn muốn ẨN delete hoàn toàn: xoá block này */}
                        <button
                          className="btn"
                          onClick={() => deleteCampaign(r.id)}
                          disabled={!isAdmin}
                        >
                          Xoá
                        </button>
                      </div>

                      {!isAdmin && (
                        <span
                          className="muted"
                          style={{ marginLeft: 10, fontSize: 12 }}
                        >
                          (Chỉ admin)
                        </span>
                      )}
                    </td>
                  </tr>
                ))}

                {rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="muted">
                      Chưa có campaign.
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
