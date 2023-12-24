import * as React from "react";

const CloseIcon = ({
  width = 13,
  height = 12,
  scale = 1,
  className,
  onClick,
}: {
  width?: number;
  height?: number;
  scale?: number;
  className?: string;
  onClick?: () => void;
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={width}
    height={height}
    viewBox="0 0 13 12"
    fill="none"
    className={className}
    onClick={onClick}
  >
    <g transform={`scale(${scale})`}>
      <path
        fill="#000"
        d="m8.043 6 4.828-4.457a.383.383 0 0 0 0-.572L11.95.119a.458.458 0 0 0-.31-.119.458.458 0 0 0-.31.119L6.5 4.576 1.672.119A.458.458 0 0 0 1.362 0a.458.458 0 0 0-.31.119L.128.97a.383.383 0 0 0 0 .572L4.957 6 .129 10.457a.383.383 0 0 0 0 .572l.923.853a.458.458 0 0 0 .31.118.458.458 0 0 0 .31-.118L6.5 7.425l4.828 4.457a.458.458 0 0 0 .31.118.458.458 0 0 0 .31-.118l.923-.853a.383.383 0 0 0 0-.572L8.043 6Z"
      />
    </g>
  </svg>
);

export default CloseIcon;
