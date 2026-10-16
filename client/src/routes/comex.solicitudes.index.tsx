import { createFileRoute } from "@tanstack/react-router";

import { RequireAuth } from "@/lib/auth";
import { pageHead } from "@/lib/seo";
import { ComexRequestsPage } from "@/components/comex/requests-page";

export const Route = createFileRoute("/comex/solicitudes/")({
  head: () => pageHead("Solicitudes COMEX", "Solicitudes de compra persistentes y Matching multilote."),
  component: () => <RequireAuth><ComexRequestsPage /></RequireAuth>,
});
