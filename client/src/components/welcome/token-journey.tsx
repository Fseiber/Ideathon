import React from "react";

export function TokenJourney() {
  return (
    <div className="relative h-32 md:h-48 flex items-center justify-center">
      {/* Grain start */}
      <div className="absolute left-0 top-1/2 transform -translate-y-1/2">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="var(--color-harvest)"><circle cx="12" cy="12" r="10" /></svg>
      </div>
      {/* Dotted line (desktop only) */}
      <div className="hidden md:block absolute inset-y-0 left-8 right-8 border-b border-dashed border-gray-400" />
      {/* Token */}
      <div className="journey-token absolute top-1/2 -translate-y-1/2 hidden h-6 w-6 bg-harvest md:block rounded-full" />
      {/* Stellar target */}
      <div className="absolute right-0 top-1/2 transform -translate-y-1/2">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="var(--color-paddy)"><circle cx="12" cy="12" r="10" /></svg>
      </div>
    </div>
  );
}
