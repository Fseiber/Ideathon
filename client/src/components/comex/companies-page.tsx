import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { ApiError, getLots } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { COMPANY_ROLES, canWriteCompanies, type Company, type CompanyRole } from "@/lib/comex-api";
import { Card, PageHeader, StatusBadge } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const inp = "h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm";
const errorText = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);

type Draft = { name: string; taxId: string; country: string; province: string; notes: string; roles: CompanyRole[] };
const emptyDraft: Draft = { name: "", taxId: "", country: "Argentina", province: "", notes: "", roles: ["COMPRADOR"] };
const toDraft = (c: Company): Draft => ({ name: c.name, taxId: c.taxId ?? "", country: c.country, province: c.province ?? "", notes: c.notes ?? "", roles: c.roles });

export function ComexCompaniesPage() {
  const { user, client } = useAuth();
  const canWrite = canWriteCompanies(user);
  const [role, setRole] = useState<CompanyRole | "">("");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Company | "new" | null>(null);
  const companiesQuery = useQuery({ queryKey: ["comex", "companies", role, q], queryFn: () => client.listCompanies({ role, q }) });
  const selected = editing && editing !== "new" ? companiesQuery.data?.find((c) => c.id === editing.id) ?? editing : null;

  return (
    <div>
      <PageHeader titulo="Empresas" descripcion="Directorio de molinos, compradores, exportadores e intermediarios con sus contactos." acciones={canWrite && <Button size="sm" onClick={() => setEditing("new")}><Plus className="mr-1 h-4 w-4" />Nueva empresa</Button>} />
      <Card className="mb-4">
        <div className="flex flex-wrap gap-3">
          <select aria-label="Filtrar por rol" className={`${inp} max-w-[200px]`} value={role} onChange={(e) => setRole(e.target.value as CompanyRole | "")}>
            <option value="">Todos los roles</option>
            {COMPANY_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <input aria-label="Buscar empresa" className={`${inp} max-w-sm`} placeholder="Buscar por nombre o CUIT…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </Card>
      {companiesQuery.isError && <p className="mb-4 rounded-lg border border-warning/40 bg-warning-muted/50 p-3 text-sm text-warning-foreground">No se pudieron cargar las empresas.</p>}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead><tr className="border-b text-xs text-muted-foreground"><th className="py-2 pr-3">Empresa</th><th className="py-2 pr-3">Roles</th><th className="py-2 pr-3">Ubicación</th><th className="py-2 pr-3">Contactos</th><th className="py-2" /></tr></thead>
            <tbody>
              {companiesQuery.data?.map((c) => (
                <tr key={c.id} className="border-b border-border/60">
                  <td className="py-2 pr-3"><p className="font-medium">{c.name}</p>{c.taxId && <p className="text-xs text-muted-foreground">{c.taxId}</p>}</td>
                  <td className="pr-3"><div className="flex flex-wrap gap-1">{c.roles.map((r) => <StatusBadge key={r} tono={r === "MOLINO" ? "success" : "info"}>{r}</StatusBadge>)}</div></td>
                  <td className="pr-3">{[c.province, c.country].filter(Boolean).join(", ")}</td>
                  <td className="pr-3">{c.contacts.length}</td>
                  <td><Button size="sm" variant="outline" onClick={() => setEditing(c)}>{canWrite ? "Editar" : "Ver"}</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {companiesQuery.data?.length === 0 && <p className="py-4 text-sm text-muted-foreground">No hay empresas que coincidan.</p>}
        </div>
      </Card>
      <Sheet open={editing !== null} onOpenChange={(open) => { if (!open) setEditing(null); }}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{selected ? selected.name : "Nueva empresa"}</SheetTitle>
            <SheetDescription>{canWrite ? "Los cambios quedan registrados en la auditoría." : "Sólo lectura para tu rol."}</SheetDescription>
          </SheetHeader>
          {editing !== null && <CompanyForm key={selected?.id ?? "new"} company={selected} readOnly={!canWrite} onSaved={(c) => setEditing(c)} />}
          {selected && <ContactsSection company={selected} readOnly={!canWrite} />}
          {selected?.roles.includes("MOLINO") && canWrite && <LotLinkSection company={selected} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function CompanyForm({ company, readOnly, onSaved }: { company: Company | null; readOnly: boolean; onSaved: (c: Company) => void }) {
  const { client } = useAuth();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft>(company ? toDraft(company) : emptyDraft);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (company) setDraft(toDraft(company)); }, [company]);
  const save = useMutation({
    mutationFn: () => {
      const body = { name: draft.name, country: draft.country, roles: draft.roles, taxId: draft.taxId || null, province: draft.province || null, notes: draft.notes || null };
      return company ? client.updateCompany(company.id, body) : client.createCompany(body);
    },
    onSuccess: async (saved) => { toast.success(company ? "Empresa actualizada" : "Empresa creada"); setError(null); await queryClient.invalidateQueries({ queryKey: ["comex", "companies"] }); onSaved(saved); },
    onError: (e) => setError(errorText(e, "No se pudo guardar la empresa")),
  });
  const set = (field: keyof Omit<Draft, "roles">) => (e: { target: { value: string } }) => setDraft({ ...draft, [field]: e.target.value });
  const toggle = (r: CompanyRole) => setDraft({ ...draft, roles: draft.roles.includes(r) ? draft.roles.filter((x) => x !== r) : [...draft.roles, r] });
  const submit = (e: FormEvent) => { e.preventDefault(); if (draft.roles.length === 0) { setError("Elegí al menos un rol"); return; } save.mutate(); };

  return (
    <form onSubmit={submit} className="space-y-3 px-4 pb-4">
      <fieldset disabled={readOnly} className="space-y-3">
        <label className="block space-y-1 text-sm"><span>Razón social</span><input className={inp} value={draft.name} onChange={set("name")} required minLength={2} maxLength={120} /></label>
        <label className="block space-y-1 text-sm"><span>CUIT / Tax ID</span><input className={inp} value={draft.taxId} onChange={set("taxId")} maxLength={40} /></label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block space-y-1 text-sm"><span>País</span><input className={inp} value={draft.country} onChange={set("country")} required minLength={2} maxLength={60} /></label>
          <label className="block space-y-1 text-sm"><span>Provincia</span><input className={inp} value={draft.province} onChange={set("province")} maxLength={60} /></label>
        </div>
        <fieldset className="space-y-1 text-sm"><legend>Roles</legend><div className="flex flex-wrap gap-3">{COMPANY_ROLES.map((r) => <label key={r} className="flex items-center gap-1"><input type="checkbox" checked={draft.roles.includes(r)} onChange={() => toggle(r)} />{r}</label>)}</div></fieldset>
        <label className="block space-y-1 text-sm"><span>Notas</span><textarea className={`${inp} h-20 py-2`} value={draft.notes} onChange={set("notes")} maxLength={2000} /></label>
      </fieldset>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {!readOnly && <Button type="submit" className="w-full" disabled={save.isPending}>{company ? "Guardar cambios" : "Crear empresa"}</Button>}
    </form>
  );
}

function ContactsSection({ company, readOnly }: { company: Company; readOnly: boolean }) {
  const { client } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: "", email: "", phone: "", position: "" });
  const [error, setError] = useState<string | null>(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["comex", "companies"] });
  const add = useMutation({
    mutationFn: () => client.addContact(company.id, { name: form.name, email: form.email || null, phone: form.phone || null, position: form.position || null }),
    onSuccess: async () => { setForm({ name: "", email: "", phone: "", position: "" }); setError(null); await refresh(); },
    onError: (e) => setError(errorText(e, "No se pudo agregar el contacto")),
  });
  const remove = useMutation({ mutationFn: client.deleteContact, onSuccess: refresh, onError: (e) => toast.error(errorText(e, "No se pudo borrar el contacto")) });

  return (
    <div className="border-t border-border px-4 py-4">
      <h3 className="mb-2 text-sm font-semibold">Contactos</h3>
      {company.contacts.length === 0 && <p className="mb-2 text-sm text-muted-foreground">Sin contactos.</p>}
      <ul className="mb-3 space-y-2">
        {company.contacts.map((c) => (
          <li key={c.id} className="flex items-start justify-between gap-2 rounded-md border border-border p-2 text-sm">
            <div><p className="font-medium">{c.name}{c.position && <span className="font-normal text-muted-foreground"> · {c.position}</span>}</p><p className="text-xs text-muted-foreground">{[c.email, c.phone].filter(Boolean).join(" · ")}</p></div>
            {!readOnly && <button type="button" aria-label={`Borrar contacto ${c.name}`} className="text-muted-foreground hover:text-destructive" onClick={() => remove.mutate(c.id)}><Trash2 className="h-4 w-4" /></button>}
          </li>
        ))}
      </ul>
      {!readOnly && (
        <form onSubmit={(e) => { e.preventDefault(); add.mutate(); }} className="grid grid-cols-2 gap-2">
          <input aria-label="Nombre del contacto" className={inp} placeholder="Nombre" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required minLength={2} />
          <input aria-label="Cargo" className={inp} placeholder="Cargo" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} />
          <input aria-label="Email del contacto" className={inp} type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input aria-label="Teléfono" className={inp} placeholder="Teléfono" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          {error && <p role="alert" className="col-span-2 text-sm text-destructive">{error}</p>}
          <Button type="submit" size="sm" variant="outline" className="col-span-2" disabled={add.isPending}>Agregar contacto</Button>
        </form>
      )}
    </div>
  );
}

function LotLinkSection({ company }: { company: Company }) {
  const { client } = useAuth();
  const queryClient = useQueryClient();
  const lotsQuery = useQuery({ queryKey: ["lots"], queryFn: getLots });
  const [lotId, setLotId] = useState("");
  const link = useMutation({
    mutationFn: (args: { lotId: number; supplierCompanyId: number | null }) => client.linkLotSupplier(args.lotId, args.supplierCompanyId),
    onSuccess: async (r) => { toast.success(r.supplier ? `Lote #${r.lotId} vinculado a ${r.supplier.name}` : `Lote #${r.lotId} desvinculado`); setLotId(""); await queryClient.invalidateQueries({ queryKey: ["lots"] }); },
    onError: (e) => toast.error(errorText(e, "No se pudo vincular el lote")),
  });
  const linked = lotsQuery.data?.filter((l) => l.supplier?.id === company.id) ?? [];

  return (
    <div className="border-t border-border px-4 py-4">
      <h3 className="mb-2 text-sm font-semibold">Lotes provistos por este molino</h3>
      {lotsQuery.isError && <p className="text-sm text-muted-foreground">No se pudieron cargar los lotes.</p>}
      <ul className="mb-3 space-y-1 text-sm">
        {linked.length === 0 && <li className="text-muted-foreground">Ningún lote vinculado.</li>}
        {linked.map((l) => <li key={l.id} className="flex items-center justify-between"><span>Lote #{l.id} · {l.product}</span><button type="button" className="text-xs text-muted-foreground hover:text-destructive" onClick={() => link.mutate({ lotId: l.id, supplierCompanyId: null })}>Desvincular</button></li>)}
      </ul>
      <div className="flex gap-2">
        <select aria-label="Lote a vincular" className={inp} value={lotId} onChange={(e) => setLotId(e.target.value)}>
          <option value="">Elegir lote…</option>
          {lotsQuery.data?.filter((l) => l.supplier?.id !== company.id).map((l) => <option key={l.id} value={l.id}>Lote #{l.id} · {l.product}{l.supplier ? ` (hoy: ${l.supplier.name})` : ""}</option>)}
        </select>
        <Button size="sm" disabled={!lotId || link.isPending} onClick={() => link.mutate({ lotId: Number(lotId), supplierCompanyId: company.id })}>Vincular</Button>
      </div>
    </div>
  );
}
