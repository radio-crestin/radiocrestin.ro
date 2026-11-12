import React from "react";

const svgProps = {
  width: 26,
  height: 26,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export const MessageIcon = () => (
  <svg {...svgProps}>
    <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" />
    <path d="M8.5 10.5h7M8.5 13.5h4.5" />
  </svg>
);

export const RadioIcon = () => (
  <svg {...svgProps}>
    <rect x="3" y="8" width="18" height="12" rx="2.5" />
    <path d="m7 8 10-4.5" />
    <circle cx="15.5" cy="14" r="2.5" />
    <path d="M6.5 12.5h3M6.5 15.5h3" />
  </svg>
);

export const MegaphoneIcon = () => (
  <svg {...svgProps}>
    <path d="M3 10v4a1 1 0 0 0 1 1h3l6 4V5L7 9H4a1 1 0 0 0-1 1Z" />
    <path d="M17 9a4 4 0 0 1 0 6M7 15l1.5 5h2.5l-1-4.5" />
  </svg>
);

export const BulbIcon = () => (
  <svg {...svgProps}>
    <path d="M9 18h6M10 21h4" />
    <path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1 2V16h5.2v-.2c0-.8.4-1.5 1-2A6 6 0 0 0 12 3Z" />
  </svg>
);

export const AlertIcon = () => (
  <svg {...svgProps}>
    <path d="M10.3 4.2 2.7 17.5A2 2 0 0 0 4.4 20.5h15.2a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0Z" />
    <path d="M12 9.5v4M12 17h.01" />
  </svg>
);

export const CameraIcon = () => (
  <svg {...svgProps} width={20} height={20}>
    <path d="M4 8h3l1.5-2.5h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
    <circle cx="12" cy="13" r="3.5" />
  </svg>
);

export const CheckIcon = () => (
  <svg {...svgProps} width={36} height={36} strokeWidth={2.2}>
    <circle cx="12" cy="12" r="9.5" />
    <path d="m8 12.5 2.8 2.8L16.5 9.5" />
  </svg>
);
