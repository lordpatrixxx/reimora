import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-auth";
import { errMsg } from "@/components/app/ui-bits";
import { StudentOnboarding } from "@/components/app/student-onboarding";
import { ClaimWizard } from "@/components/app/claim-wizard";

export const Route = createFileRoute("/_authenticated/claims/new")({
  head: () => ({ meta: [{ title: "New claim — CampusSettle" }, { name: "description", content: "Create a reimbursement claim." }] }),
  component: NewClaim,
});

function NewClaim() {
  const { data: me } = useMe();
  const nav = useNavigate();
  const started = useRef(false);

  // Students get a draft immediately linked to their own record.
  useEffect(() => {
    if (!me || me.isFinance || !me.student || started.current) return;
    started.current = true;
    supabase.from("claims").insert({ title: "Untitled claim", student_id: me.student.id, created_by: me.user.id }).select("id").single()
      .then(({ data, error }) => {
        if (error) return toast.error(errMsg(error));
        nav({ to: "/claims/$id/edit", params: { id: data.id }, replace: true });
      });
  }, [me, nav]);

  if (!me) return null;
  if (!me.isFinance && !me.student) return <StudentOnboarding />;
  if (me.isFinance) return <ClaimWizard claimId={null} />;
  return <p className="text-sm text-muted-foreground">Creating your draft…</p>;
}
