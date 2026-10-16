import React from "react";

export function HeroAI() {
  return (
    <section className="relative h-[72vh] min-h-[480px] overflow-hidden">
      {/* Background sky */}
      <div className="absolute inset-0 bg-gradient-to-b from-sky-200 to-sky-400" />
      {/* Sun */}
      <svg className="absolute inset-0" viewBox="0 0 1440 640" aria-hidden="true">
        <circle cx="1080" cy="330" r="55" fill="var(--color-warning)" />
      </svg>
      {/* Content overlay */}
      <div className="relative z-10 flex h-full items-center justify-center">
        <h1 className="text-5xl font-display text-foreground text-center">
          Bienvenido al campo correntino tokenizado
        </h1>
      </div>
    </section>
  );
}
