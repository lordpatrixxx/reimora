import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Role = "student" | "faculty" | "finance";

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const user = u.user;
      if (!user) return null;
      const [{ data: roles }, { data: profile }, { data: student }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user.id),
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        supabase.from("students").select("*").eq("user_id", user.id).maybeSingle(),
      ]);
      const r = (roles ?? []).map((x) => x.role as Role);
      return {
        user,
        profile,
        student,
        roles: r,
        isStudent: r.includes("student"),
        isFaculty: r.includes("faculty"),
        isFinance: r.includes("finance"),
        isStaff: r.includes("faculty") || r.includes("finance"),
        primaryRole: (r.includes("finance") ? "finance" : r.includes("faculty") ? "faculty" : "student") as Role,
      };
    },
    staleTime: 30_000,
  });
}

export type Me = NonNullable<ReturnType<typeof useMe>["data"]>;
