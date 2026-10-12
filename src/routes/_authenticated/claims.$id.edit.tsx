import { createFileRoute } from "@tanstack/react-router";
import { ClaimWizard } from "@/components/app/claim-wizard";

export const Route = createFileRoute("/_authenticated/claims/$id/edit")({
  head: () => ({ meta: [{ title: "Edit claim — CampusSettle" }, { name: "description", content: "Claim wizard." }] }),
  component: () => {
    const { id } = Route.useParams();
    return <ClaimWizard claimId={id} />;
  },
});
