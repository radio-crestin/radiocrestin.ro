import React from "react";

const SparklesStar = ({ width = 16, height = 16, ...props }: React.SVGProps<SVGSVGElement> & { width?: number; height?: number }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={width}
    height={height}
    viewBox="0 0 24 24"
    fill="currentColor"
    {...props}
  >
    <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8L12 2z" />
    <circle cx="20" cy="4" r="1.5" />
    <circle cx="4" cy="20" r="1" />
  </svg>
);

export default SparklesStar;
