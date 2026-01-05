import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  try {
    const sb = supabaseAdmin();
    const { data, error } = await sb.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (error)
      return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({
      users: (data?.users || []).map((u) => ({
        id: u.id,
        email: u.email,
        created_at: u.created_at,
      })),
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}
