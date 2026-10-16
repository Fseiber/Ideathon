import { createFileRoute } from "@tanstack/react-router";
import { HeroAI } from "@/components/hero-ai";
import { FlowStrip } from "@/components/flow-strip";
import { PaddyScene } from "@/components/welcome/paddy-scene";
import { TokenJourney } from "@/components/welcome/token-journey";
import { LiveStats } from "@/components/welcome/live-stats";
import { RoleCards } from "@/components/welcome/role-cards";

export const Route = createFileRoute("/bienvenida")({
  component: Bienvenida,
});

function Bienvenida() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Hero Section */}
      <section className="relative h-[72vh] min-h-[480px] overflow-hidden">
        <HeroAI />
        <FlowStrip />
      </section>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-8 space-y-12">
        <PaddyScene />
        <TokenJourney />
        <LiveStats />
        <RoleCards />
      </main>
    </div>
  );
}
