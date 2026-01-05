import { supabase } from "@/lib/supabaseClient";
import type { AppRole } from "@/lib/roles";

export type { AppRole }; // ✅ để nơi khác import từ getRole cũng được

export async function getMyRole(): Promise<AppRole> {
  const { data: u } = await supabase.auth.getUser();
  const user = u.user;
  if (!user) return "sales";

  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) return "sales";
  return (data?.role as AppRole) || "sales";
}
