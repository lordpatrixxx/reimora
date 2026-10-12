import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const claimSelect = "*, students(id, full_name, prn, department, year, division, email), expenses(id, category, amount_paise, approved_paise), scopes:scope_id(name, kind)";

export function useClaims() {
  return useQuery({
    queryKey: ["claims"],
    queryFn: async () => {
      const { data, error } = await supabase.from("claims").select(claimSelect).order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}
export type ClaimRow = NonNullable<ReturnType<typeof useClaims>["data"]>[number];

export function useStudents() {
  return useQuery({
    queryKey: ["students"],
    queryFn: async () => {
      const { data, error } = await supabase.from("students").select("*, beneficiaries(*)").order("full_name");
      if (error) throw error;
      return data;
    },
  });
}

export function usePaymentsAll() {
  return useQuery({
    queryKey: ["payments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("payments").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useAdvances() {
  return useQuery({
    queryKey: ["advances"],
    queryFn: async () => {
      const { data, error } = await supabase.from("advances").select("*, students(full_name, prn)").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function sumPayments(payments: { claim_id: string; direction: string; amount_paise: number }[], claimId: string) {
  let to = 0, from = 0;
  for (const p of payments) if (p.claim_id === claimId) p.direction === "to_student" ? (to += p.amount_paise) : (from += p.amount_paise);
  return { to, from };
}
