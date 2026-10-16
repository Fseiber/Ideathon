import React from "react";
import { useAppStore } from "@/lib/store";
import { ROLES, type Rol } from "@/data/demo";
import { useNavigate } from "@tanstack/react-router";
import { useChatAssistant } from "@/components/chat-assistant";

export function RoleCards() {
  const { dispatch } = useAppStore();
  const navigate = useNavigate();
  const { open } = useChatAssistant();

  const handleSelect = (rol: Rol) => {
    dispatch({ type: "setRol", rol });
    navigate({ to: "/marketplace" });
    open();
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6" role="list">
      {ROLES.map((r) => (
        <button
          key={r.id}
          className="rounded-lg border border-border bg-card p-6 text-left hover:bg-card/80"
          onClick={() => handleSelect(r.id)}
          role="listitem"
        >
          <h2 className="text-xl font-bold text-foreground">{r.label}</h2>
          <p className="mt-2 text-muted-foreground">{r.descripcion}</p>
        </button>
      ))}
    </div>
  );
}
