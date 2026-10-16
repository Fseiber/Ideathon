import React from "react";

export function PaddyScene() {
  return (
    <svg
      viewBox="0 0 1440 640"
      className="w-full h-auto"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Escena de arrozal y cielo"
    >
      {/* Sky */}
      <rect y="0" width="1440" height="360" fill="var(--color-info)" />
      {/* Sun */}
      <circle cx="1080" cy="330" r="55" fill="var(--color-warning)" />
      {/* Mountain */}
      <path
        d="M0,370 C200,340 400,340 600,370 L1440,370 L1440,640 L0,640 Z"
        fill="var(--color-primary)"
      />
      {/* Rice fields bands */}
      <g fill="var(--color-field)">
        <rect y="370" width="1440" height="30" />
        <rect y="410" width="1440" height="40" />
        <rect y="460" width="1440" height="55" />
        <rect y="525" width="1440" height="70" />
        <rect y="610" width="1440" height="30" />
      </g>
      {/* Water lines */}
      <g stroke="white" strokeOpacity="0.35" strokeWidth="2">
        <line x1="0" y1="380" x2="1440" y2="380" />
        <line x1="0" y1="395" x2="1440" y2="395" />
        <line x1="0" y1="410" x2="1440" y2="410" />
      </g>
    </svg>
  );
}
