import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Role = "student" | "faculty" | "finance" | "super_admin";

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data: u, error: ue } = await supabase.auth.getUser();
      if (ue && ue.name !== "AuthSessionMissingError") throw ue;
      const user = u.user;
      if (!user) return null;
      const [rolesR, profileR, studentR, statusR, reqR, scopesR] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user.id),
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        supabase.from("students").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("account_status").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("access_requests").select("*, scopes:scope_id(name, kind)").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("approver_scopes").select("scope_id, scopes(name, kind)").eq("user_id", user.id),
      ]);
      const failed = [rolesR, profileR, statusR, reqR].find((r) => r.error);
      if (failed?.error) throw failed.error;
      const r = (rolesR.data ?? []).map((x) => x.role as Role);
      const suspended = !!statusR.data?.suspended;
      const isSuperAdmin = !suspended && r.includes("super_admin");
      const has = (x: Role) => !suspended && (r.includes(x) || isSuperAdmin);
      return {
        user,
        profile: profileR.data,
        student: studentR.data,
        roles: r,
        suspended,
        suspendedReason: statusR.data?.reason ?? null,
        requests: reqR.data ?? [],
        approverScopes: scopesR.data ?? [],
        hasAccess: !suspended && r.length > 0,
        isSuperAdmin,
        isStudent: !suspended && r.includes("student"),
        isFaculty: has("faculty"),
        isFinance: has("finance"),
        isStaff: has("faculty") || has("finance"),
        primaryRole: (isSuperAdmin ? "super_admin" : r.includes("finance") ? "finance" : r.includes("faculty") ? "faculty" : "student") as Role,
      };
    },
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    retry: 1,
  });
}

export type Me = NonNullable<ReturnType<typeof useMe>["data"]>;

export const roleLabel: Record<string, string> = {
  student: "Student",
  faculty: "Faculty / Club Approver",
  finance: "Finance",
  super_admin: "Super administrator",
};
