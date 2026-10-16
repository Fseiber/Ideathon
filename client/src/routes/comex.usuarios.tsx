import { createFileRoute } from "@tanstack/react-router";

import { RequireAuth } from "@/lib/auth";
import { pageHead } from "@/lib/seo";
import { ComexUsersPage } from "@/components/comex/users-page";

export const Route = createFileRoute("/comex/usuarios")({
  head: () => pageHead("Usuarios", "Gestión de usuarios internos del módulo COMEX."),
  component: () => <RequireAuth><ComexUsersPage /></RequireAuth>,
});
