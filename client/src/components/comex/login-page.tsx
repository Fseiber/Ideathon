import { useNavigate } from "@tanstack/react-router";
import { LockKeyhole } from "lucide-react";
import { useState, type FormEvent } from "react";

import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";

const inp = "h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm";

export function ComexLoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      await login(email, password);
      setPassword("");
      await navigate({ to: "/comex/empresas" });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo iniciar sesión");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm py-10">
      <Card>
        <div className="mb-4 flex items-center gap-2">
          <LockKeyhole className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold">Ingreso COMEX</h1>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">Acceso para usuarios internos. No reemplaza el selector de rol demostrativo del flujo Stellar.</p>
        {user && <p className="mb-3 text-sm">Sesión activa: <strong>{user.name}</strong></p>}
        <form onSubmit={submit} className="space-y-3">
          <label className="block space-y-1 text-sm"><span>Email</span><input className={inp} type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
          <label className="block space-y-1 text-sm"><span>Contraseña</span><input className={inp} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={pending}>{pending ? "Ingresando…" : "Iniciar sesión"}</Button>
        </form>
      </Card>
    </div>
  );
}
