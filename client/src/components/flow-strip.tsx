import React from "react";

export function FlowStrip() {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Simple decorative flow stripe */}
      <svg viewBox="0 0 1440 200" className="w-full h-full" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 100 Q 720 0 1440 100 L1440 200 L0 200 Z" fill="var(--color-harvest)" opacity="0.2" />
      </svg>
    </div>
  );
}
