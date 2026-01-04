"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Topbar from "@/app/_components/Topbar";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const onLogin = async () => {
    setMsg("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (error) setMsg("Sai email hoặc mật khẩu. Vui lòng nhập lại.");
    else window.location.href = "/dashboard";
  };

  return (
    <div className="container" style={{ maxWidth: 680, paddingTop: 26 }}>
      <Topbar title="Đăng nhập" />

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-h">
          <div>
            <h1 className="h1">Đăng nhập</h1>
            <p className="p">
              Nhập email & mật khẩu để vào quản lý đơn hàng và tồn kho.
            </p>
          </div>
          <span className="badge">Amora Ops</span>
        </div>

        <div className="card-b">
          <div className="grid" style={{ gap: 14 }}>
            <div className="field" style={{ gridColumn: "span 12" }}>
              <div className="label">Email</div>
              <input
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vd: amora@yourmail.com"
                inputMode="email"
              />
            </div>

            <div className="field" style={{ gridColumn: "span 12" }}>
              <div className="label">Mật khẩu</div>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            <div style={{ gridColumn: "span 12" }}>
              <button
                className="btn primary"
                onClick={onLogin}
                disabled={loading}
                style={{ width: "100%", padding: "14px 16px", fontSize: 18 }}
              >
                {loading ? "Đang đăng nhập..." : "Đăng nhập"}
              </button>

              {msg && (
                <p className="msgErr" style={{ marginTop: 12, fontSize: 16 }}>
                  {msg}
                </p>
              )}

              <p className="p" style={{ marginTop: 14 }}>
                Mẹo: nếu quên mật khẩu, nhắn admin để cấp lại.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
