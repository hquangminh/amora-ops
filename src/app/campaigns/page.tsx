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
  const [role, setRole] = useState<"admin" | "sales" | null>(null);
  const [rows, setRows] = useState<Campaign[]>([]);

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
  }, []);

  const createCampaign = async () => {
    if (role !== "admin") return alert("Chỉ admin mới được tạo campaign.");
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

    setName("");
    setChannel("Facebook");
    setStart(new Date().toISOString().slice(0, 10));
    setEnd("");
    setNote("");
    await refresh();
  };

  const toggleActive = async (id: string, next: boolean) => {
    if (role !== "admin") return alert("Chỉ admin mới được bật/tắt campaign.");
    const { error } = await supabase
      .from("ad_campaigns")
      .update({ is_active: next })
      .eq("id", id);
    if (error) return alert(error.message);
    await refresh();
  };

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (onlyActive && !r.is_active) return false;
      if (!qq) return true;
      return (
        r.name.toLowerCase().includes(qq) ||
        (r.channel ?? "").toLowerCase().includes(qq) ||
        (r.note ?? "").toLowerCase().includes(qq)
      );
    });
  }, [rows, q, onlyActive]);

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
      // OR: name / channel / note
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

  useEffect(() => {
    fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

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

      <div className="card" style={{ marginTop: 14 }}>
        <div className="card-h">
          <div>
            <h2 className="h2">Tạo campaign</h2>
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
              />
            </div>

            <div className="field" style={{ gridColumn: "span 3" }}>
              <div className="label">Kênh</div>
              <input
                className="input"
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                placeholder="Facebook / Shopee / Tiktok..."
              />
            </div>

            <div className="field" style={{ gridColumn: "span 2" }}>
              <div className="label">Start</div>
              <input
                className="input"
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>

            <div className="field" style={{ gridColumn: "span 2" }}>
              <div className="label">End (tuỳ chọn)</div>
              <input
                className="input"
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
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
              <button
                className="btn primary"
                onClick={createCampaign}
                disabled={role !== "admin"}
              >
                + Tạo campaign
              </button>
              {role !== "admin" && (
                <span className="muted" style={{ marginLeft: 10 }}>
                  Sales chỉ xem.
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="card-h">
          <div>
            <h2 className="h2">Danh sách</h2>
            <p className="p">{filtered.length} campaign</p>
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
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
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
                          disabled={role !== "admin"}
                        >
                          Active
                        </button>
                      ) : (
                        <button
                          className="btn"
                          onClick={() => toggleActive(r.id, true)}
                          disabled={role !== "admin"}
                        >
                          Inactive
                        </button>
                      )}
                    </td>
                  </tr>
                ))}

                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="muted">
                      Chưa có campaign.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            total={total}
            pageSize={pageSize}
            onPage={setPage}
          />
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
