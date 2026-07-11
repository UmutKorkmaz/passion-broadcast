import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & {
  size?: number;
};

const baseProps = (size: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  xmlns: "http://www.w3.org/2000/svg",
  "aria-hidden": true,
});

export function RefreshIcon({ size = 18, ...props }: IconProps) {
  return (
    <svg {...baseProps(size)} {...props}>
      <path
        d="M20 6.7V3.5m0 0h-3.2M20 3.5l-2.3 2.2a8 8 0 1 0 2 7.8"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ExternalLinkIcon({ size = 16, ...props }: IconProps) {
  return (
    <svg {...baseProps(size)} {...props}>
      <path
        d="M14 5h5v5m0-5-8.2 8.2M19 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ChevronIcon({ size = 18, ...props }: IconProps) {
  return (
    <svg {...baseProps(size)} {...props}>
      <path
        d="m7 9 5 5 5-5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function DocumentIcon({ size = 21, ...props }: IconProps) {
  return (
    <svg {...baseProps(size)} {...props}>
      <path
        d="M7 3.5h6.5L18 8v12.5H7V3.5Zm6.5 0V8H18M9.5 12h6m-6 3h6m-6 3h4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SkipBackIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg {...baseProps(size)} {...props}>
      <path d="M6 5v14M19 6l-9 6 9 6V6Z" fill="currentColor" />
    </svg>
  );
}

export function SkipForwardIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg {...baseProps(size)} {...props}>
      <path d="M18 5v14M5 6l9 6-9 6V6Z" fill="currentColor" />
    </svg>
  );
}

export function ReplayIcon({ size = 27, ...props }: IconProps) {
  return (
    <svg {...baseProps(size)} {...props}>
      <path
        d="M8 6H4m0 0v4m0-4 2.2 2.2a7 7 0 1 1-.8 8.8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <text x="8.2" y="15.2" fill="currentColor" fontSize="7.5" fontWeight="600">
        10
      </text>
    </svg>
  );
}

export function BrandMark({ className }: { className?: string }) {
  const nodes = [
    [11, 35], [18, 19], [24, 42], [29, 11], [36, 26], [42, 45], [48, 16],
    [55, 34], [62, 9], [69, 25], [75, 43], [82, 17], [90, 33],
  ];
  const lines = [
    [0, 1], [0, 2], [1, 3], [1, 4], [2, 4], [2, 5], [3, 4], [3, 6],
    [4, 5], [4, 6], [4, 7], [5, 7], [6, 7], [6, 8], [6, 9], [7, 9],
    [7, 10], [8, 9], [8, 11], [9, 10], [9, 11], [9, 12], [10, 12], [11, 12],
  ];

  return (
    <svg
      className={className}
      viewBox="0 0 100 54"
      role="img"
      aria-label="Passion Broadcast network mark"
    >
      {lines.map(([from, to], index) => (
        <line
          key={index}
          x1={nodes[from][0]}
          y1={nodes[from][1]}
          x2={nodes[to][0]}
          y2={nodes[to][1]}
          stroke="currentColor"
          strokeWidth="1"
          opacity=".56"
        />
      ))}
      {nodes.map(([x, y], index) => (
        <circle
          key={index}
          cx={x}
          cy={y}
          r={index % 4 === 0 ? 2.7 : 2}
          fill="currentColor"
        />
      ))}
    </svg>
  );
}
