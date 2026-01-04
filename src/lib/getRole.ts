import { supabase } from "@/lib/supabaseClient";

export async function getMyRole(): Promise<"admin" | "sales" | null> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;

  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", u.user.id)
    .single();

  if (error) return null;
  return (data.role as any) ?? null;
}
