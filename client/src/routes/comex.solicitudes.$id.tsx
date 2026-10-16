import { createFileRoute } from "@tanstack/react-router";

import { RequireAuth } from "@/lib/auth";
import { pageHead } from "@/lib/seo";
import { ComexRequestDetailPage } from "@/components/comex/request-detail-page";

export const Route = createFileRoute("/comex/solicitudes/$id")({
  head: () => pageHead("Solicitud COMEX", "Requisitos, Matching y propuesta de abastecimiento multilote."),
  component: RequestDetail,
});

function RequestDetail() {
  const { id } = Route.useParams();
  return <RequireAuth><ComexRequestDetailPage id={Number(id)} /></RequireAuth>;
}
