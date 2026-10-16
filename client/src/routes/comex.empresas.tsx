import { createFileRoute } from "@tanstack/react-router";

import { RequireAuth } from "@/lib/auth";
import { pageHead } from "@/lib/seo";
import { ComexCompaniesPage } from "@/components/comex/companies-page";

export const Route = createFileRoute("/comex/empresas")({
  head: () => pageHead("Empresas", "Directorio de empresas y contactos del módulo COMEX."),
  component: () => <RequireAuth><ComexCompaniesPage /></RequireAuth>,
});
