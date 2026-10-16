import { Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export function HashChip({ hash, href }: { hash: string; href?: string }) {
  const short = `${hash.slice(0, 8)}…${hash.slice(-8)}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(hash);
      toast.success("Hash copiado");
    } catch (e) {
      toast.error("No se pudo copiar el hash");
    }
  };

  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 font-mono text-xs">
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          aria-label={`Abrir hash ${hash}`}
          className="text-primary hover:underline"
        >
          {short}
        </a>
      ) : (
        <span>{short}</span>
      )}
      <button
        type="button"
        onClick={copy}
        aria-label="Copiar hash"
        className="text-muted-foreground hover:text-foreground"
      >
        <Copy className="h-3 w-3" />
      </button>
      {href && (
        <a href={href} target="_blank" rel="noreferrer" aria-label="Abrir hash en nueva pestaña">
          <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </span>
  );
}
