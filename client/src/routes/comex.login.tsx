import { createFileRoute } from "@tanstack/react-router";

import { pageHead } from "@/lib/seo";
import { ComexLoginPage } from "@/components/comex/login-page";

export const Route = createFileRoute("/comex/login")({
  head: () => pageHead("Ingreso COMEX", "Acceso de usuarios internos al módulo COMEX de AgroFlow."),
  component: ComexLoginPage,
});
