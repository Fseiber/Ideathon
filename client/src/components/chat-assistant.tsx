import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Bot, Send, Sparkles } from "lucide-react";

import { ApiError, sendChat, type ApiOrder, type ChatMessage } from "@/lib/api";
import { errorMessage } from "@/lib/order-flow";
import { useAppStore } from "@/lib/store";
import { QuoteCard } from "@/components/quote-card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";

type ChatEntry = ChatMessage & { order?: ApiOrder | null; agent?: "gemini" | "stub"; error?: boolean };
type ChatContextValue = { open: (initialText?: string, lotId?: number) => void };
const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatAssistantProvider({ children }: { children: ReactNode }) {
  const [openState, setOpenState] = useState(false);
  const [initialText, setInitialText] = useState("");
  const [initialLotId, setInitialLotId] = useState<number | undefined>(undefined);
  const open = (text = "", lotId?: number) => { setInitialText(text); setInitialLotId(lotId); setOpenState(true); };
  return <ChatContext.Provider value={{ open }}>{children}<ChatAssistant open={openState} initialText={initialText} initialLotId={initialLotId} onOpenChange={setOpenState} /></ChatContext.Provider>;
}

export function useChatAssistant() {
  const context = useContext(ChatContext);
  if (!context) throw new Error("useChatAssistant debe usarse dentro de ChatAssistantProvider");
  return context;
}

function ChatAssistant({ open, initialText, initialLotId, onOpenChange }: { open: boolean; initialText: string; initialLotId: number | undefined; onOpenChange: (open: boolean) => void }) {
  const { state, dispatch } = useAppStore();
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [lastQuoteIndex, setLastQuoteIndex] = useState<number | null>(null);
  const [selectedLot, setSelectedLot] = useState<{ id: number } | null>(null);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const sending = useRef(false);

  useEffect(() => {
    if (open && initialText) setInput(initialText.slice(0, 1000));
    if (open) setSelectedLot(initialLotId === undefined ? null : { id: initialLotId });
  }, [open, initialText, initialLotId]);

  function handleOpenChange(value: boolean) {
    if (value && initialText) setInput(initialText.slice(0, 1000));
    onOpenChange(value);
  }

  async function submit() {
    const content = input.trim();
    if (!content || sending.current || state.rol !== "comprador") return;
    const userMessage: ChatEntry = { role: "user", content: content.slice(0, 1000) };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    sending.current = true;
    setThinking(true);
    try {
      const context = lastQuoteIndex === null ? nextMessages : nextMessages.slice(lastQuoteIndex + 1);
      const chatMessages = context.slice(-30).map(({ role, content: text }) => ({ role, content: text }));
      const response = selectedLot ? await sendChat(chatMessages, selectedLot.id) : await sendChat(chatMessages);
      if (response.order) { setLastQuoteIndex(nextMessages.length); setSelectedLot(null); }
      setMessages((current) => [...current, { role: "assistant", content: response.reply, order: response.order, agent: response.agent }]);
      if (response.order) await queryClient.invalidateQueries({ queryKey: ["orders"] });
    } catch (error) {
      setMessages((current) => [...current, { role: "assistant", content: error instanceof ApiError ? errorMessage(error) : "No se pudo procesar el mensaje.", error: true }]);
    } finally {
      sending.current = false;
      setThinking(false);
    }
  }

  return <Sheet open={open} onOpenChange={handleOpenChange}><SheetContent className="flex w-full flex-col p-0 sm:max-w-lg"><SheetHeader className="border-b border-border px-5 py-4 text-left"><SheetTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" />Asistente comercial</SheetTitle><SheetDescription>AgroFlow · cotizaciones de arroz</SheetDescription></SheetHeader><ScrollArea className="min-h-0 flex-1 px-5"><div className="space-y-4 py-5"><div className="flex gap-2"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Bot className="h-4 w-4" /></div><p className="max-w-[85%] rounded-xl rounded-tl-none bg-muted px-3 py-2 text-sm">Hola, soy el asistente de AgroFlow. Decime cuántas toneladas, destino e Incoterm (FOB o CFR).</p></div>{messages.map((message, index) => <div key={`${message.role}-${index}`} className={message.role === "user" ? "flex justify-end" : "flex gap-2"}>{message.role === "assistant" && <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Bot className="h-4 w-4" /></div>}<div className={message.role === "user" ? "max-w-[85%] rounded-xl rounded-tr-none bg-primary px-3 py-2 text-sm text-primary-foreground" : `max-w-[85%] ${message.error ? "rounded-xl rounded-tl-none border border-destructive/30 bg-danger-muted px-3 py-2 text-sm text-destructive" : ""}`}><p className="whitespace-pre-wrap">{message.content}</p>{message.role === "assistant" && !message.error && message.agent && <span className="mt-2 inline-flex rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">{message.agent === "gemini" ? "Gemini" : "Modo básico"}</span>}{message.role === "assistant" && message.order && <QuoteCard order={message.order} />}</div></div>)}</div></ScrollArea>{state.rol !== "comprador" ? <div className="border-t border-border p-5"><p className="mb-3 text-sm text-muted-foreground">El asistente es para compradores</p><Button onClick={() => dispatch({ type: "setRol", rol: "comprador" })}>Cambiar a Comprador / Importador</Button></div> : <div className="border-t border-border p-4">{selectedLot && <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs text-primary">Cotizando lote #{selectedLot.id}<button type="button" aria-label="Quitar lote" onClick={() => setSelectedLot(null)} className="font-bold hover:text-foreground">×</button></div>}<Textarea value={input} maxLength={1000} disabled={thinking} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void submit(); } }} placeholder="Ej.: 20 toneladas a Asunción, CFR" className="min-h-[72px] resize-none" /><div className="mt-2 flex items-center justify-between gap-3"><span className="text-xs text-muted-foreground">{input.length}/1000</span><Button onClick={() => void submit()} disabled={thinking || !input.trim()} size="sm">{thinking ? "Pensando…" : <>Enviar <Send className="h-4 w-4" /></>}</Button></div></div>}</SheetContent></Sheet>;
}
