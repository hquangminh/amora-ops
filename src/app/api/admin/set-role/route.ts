import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type Body = { user_id: string; role: "admin" | "sales" | "accountant" };

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    if (!body?.user_id || !body?.role) {
      return NextResponse.json(
        { error: "Missing user_id/role" },
        { status: 400 }
      );
    }

    const sb = supabaseAdmin();

    // upsert role
    const { error } = await sb
      .from("user_roles")
      .upsert(
        { user_id: body.user_id, role: body.role },
        { onConflict: "user_id" }
      );

    if (error)
      return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}
