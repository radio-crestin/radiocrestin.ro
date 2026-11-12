import React from "react";

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const svg = (children: React.ReactNode, props: React.SVGProps<SVGSVGElement> = stroke) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
    {children}
  </svg>
);

export const CloseGlyph = () =>
  svg(<path d="M6 6l12 12M18 6 6 18" />, { ...stroke, strokeWidth: 2.4 });
export const PrevGlyph = () => svg(<path d="m15 6-6 6 6 6" />, { ...stroke, strokeWidth: 2.4 });
export const NextGlyph = () => svg(<path d="m9 6 6 6-6 6" />, { ...stroke, strokeWidth: 2.4 });
export const BellGlyph = () =>
  svg(<path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" />, {
    ...stroke,
    strokeWidth: 2.2,
  });
