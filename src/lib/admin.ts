import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Role } from "@/hooks/use-auth";

export function usePeople() {
  return useQuery({
    queryKey: ["admin-people"],
    queryFn: async () => {
      const [p, r, s, a] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at"),
        supabase.from("user_roles").select("*"),
        supabase.from("account_status").select("*"),
        supabase.from("approver_scopes").select("*, scopes(name, kind)"),
      ]);
      const err = [p, r, s, a].find((x) => x.error)?.error;
      if (err) throw err;
      return (p.data ?? []).map((x) => ({
        ...x,
        roles: (r.data ?? []).filter((y) => y.user_id === x.id).map((y) => y.role as Role),
        suspended: !!(s.data ?? []).find((y) => y.user_id === x.id)?.suspended,
        suspendedReason: (s.data ?? []).find((y) => y.user_id === x.id)?.reason ?? null,
        scopes: (a.data ?? []).filter((y) => y.user_id === x.id),
      }));
    },
  });
}
export type Person = NonNullable<ReturnType<typeof usePeople>["data"]>[number];

export function useScopes(all = false) {
  return useQuery({
    queryKey: ["scopes", all],
    queryFn: async () => {
      let q = supabase.from("scopes").select("*").order("kind").order("name");
      if (!all) q = q.eq("active", true);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
}
