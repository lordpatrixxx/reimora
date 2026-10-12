import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useMe } from "@/hooks/use-auth";
import { Empty } from "@/components/app/ui-bits";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const { data: me } = useMe();
  if (!me?.isSuperAdmin) return <Empty title="Administrator area" body="This section is only available to the Reimora administrator." />;
  return <Outlet />;
}
