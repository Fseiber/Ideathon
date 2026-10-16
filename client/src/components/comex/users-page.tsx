import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { USER_ROLES, canManageUsers, type UserRole } from "@/lib/comex-api";
import { Card, PageHeader, StatusBadge } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";

const inp = "h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm";

export function ComexUsersPage() {
  const { user, client } = useAuth();
  const queryClient = useQueryClient();
  const allowed = canManageUsers(user);
  const usersQuery = useQuery({ queryKey: ["comex", "users"], queryFn: client.listUsers, enabled: allowed });
  const [form, setForm] = useState({ email: "", name: "", password: "" });
  const [roles, setRoles] = useState<UserRole[]>(["COMEX"]);
  const [error, setError] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: () => client.createUser({ ...form, roles }),
    onSuccess: async (created) => { toast.success(`Usuario creado: ${created.email}`); setForm({ email: "", name: "", password: "" }); setError(null); await queryClient.invalidateQueries({ queryKey: ["comex", "users"] }); },
    onError: (e) => setError(e instanceof ApiError ? e.message : "No se pudo crear el usuario"),
  });

  if (!allowed) return <Card><p className="text-sm">Sólo los administradores pueden gestionar usuarios.</p></Card>;

  const submit = (event: FormEvent) => { event.preventDefault(); if (form.password.length < 10) { setError("La contraseña debe tener al menos 10 caracteres"); return; } create.mutate(); };
  const toggle = (role: UserRole) => setRoles((current) => current.includes(role) ? current.filter((r) => r !== role) : [...current, role]);

  return (
    <div>
      <PageHeader titulo="Usuarios internos" descripcion="Cuentas con acceso al módulo COMEX. Los permisos se verifican en el backend." />
      <div className="grid gap-6 xl:grid-cols-[340px_1fr]">
        <Card>
          <h2 className="mb-4 text-base font-semibold">Nuevo usuario</h2>
          <form onSubmit={submit} className="space-y-3">
            <label className="block space-y-1 text-sm"><span>Email</span><input className={inp} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label>
            <label className="block space-y-1 text-sm"><span>Nombre</span><input className={inp} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required minLength={2} maxLength={120} /></label>
            <label className="block space-y-1 text-sm"><span>Contraseña (mín. 10)</span><input className={inp} type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></label>
            <fieldset className="space-y-1 text-sm"><legend>Roles</legend><div className="flex flex-wrap gap-3">{USER_ROLES.map((role) => <label key={role} className="flex items-center gap-1"><input type="checkbox" checked={roles.includes(role)} onChange={() => toggle(role)} />{role}</label>)}</div></fieldset>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={create.isPending || roles.length === 0}>Crear usuario</Button>
          </form>
        </Card>
        <Card>
          <h2 className="mb-4 text-base font-semibold">Usuarios</h2>
          {usersQuery.isError && <p className="text-sm text-destructive">No se pudieron cargar los usuarios.</p>}
          <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-xs text-muted-foreground"><th className="py-2 pr-3">Nombre</th><th className="py-2 pr-3">Email</th><th className="py-2 pr-3">Roles</th><th className="py-2">Estado</th></tr></thead><tbody>{usersQuery.data?.map((u) => <tr key={u.id} className="border-b border-border/60"><td className="py-2 pr-3">{u.name}</td><td className="pr-3">{u.email}</td><td className="pr-3">{u.roles.join(", ")}</td><td><StatusBadge tono={u.active === false ? "neutral" : "success"}>{u.active === false ? "Inactivo" : "Activo"}</StatusBadge></td></tr>)}</tbody></table></div>
        </Card>
      </div>
    </div>
  );
}
