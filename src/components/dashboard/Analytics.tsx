import type { DashboardStat, TimelinePoint } from "./types";

type AnalyticsProps = {
  timeline: TimelinePoint[];
  archetypes: DashboardStat[];
  technologies: DashboardStat[];
};

function TimelineChart({ points }: { points: TimelinePoint[] }) {
  const width = 330;
  const height = 190;
  const padding = { top: 18, right: 12, bottom: 31, left: 30 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const maximumValue = Math.max(0, ...points.map((point) => point.count));
  const max = Math.max(20, Math.ceil(maximumValue / 20) * 20);
  const ticks = [0, 1 / 3, 2 / 3, 1].map((ratio) =>
    Math.round(max * ratio),
  );
  const coordinates = points.map((point, index) => ({
    ...point,
    x: padding.left + (points.length === 1 ? innerWidth / 2 : (index / (points.length - 1)) * innerWidth),
    y: padding.top + innerHeight - (point.count / max) * innerHeight,
  }));
  const path = coordinates.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const latest = coordinates.at(-1);
  const rangeLabel = points.length
    ? `${points[0].label} to ${points.at(-1)?.label}`
    : "the challenge window";

  return (
    <section className="analytics-panel timeline-panel" aria-labelledby="timeline-heading">
      <h3 id="timeline-heading">Submissions over time</h3>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Cumulative challenge submissions from ${rangeLabel}`}>
        {ticks.map((tick) => {
          const y = padding.top + innerHeight - (tick / max) * innerHeight;
          return (
            <g key={tick}>
              <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="#173443" strokeWidth="1" />
              <text x="4" y={y + 4} fill="#9daab0" fontSize="11">{tick}</text>
            </g>
          );
        })}
        <path d={path} fill="none" stroke="#ff674d" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        {coordinates.map((point) => (
          <g key={point.label}>
            <circle cx={point.x} cy={point.y} r="4" fill="#ff674d" />
            <text x={point.x} y={height - 7} fill="#9daab0" fontSize="10.5" textAnchor="middle">{point.label}</text>
          </g>
        ))}
        {latest ? (
          <g className="timeline-callout">
            <rect x={latest.x - 61} y={latest.y + 10} width="59" height="45" rx="2" fill="#071725" stroke="#43515b" />
            <text x={latest.x - 52} y={latest.y + 28} fill="#d9d9d4" fontSize="11">{latest.label}</text>
            <text x={latest.x - 52} y={latest.y + 43} fill="#d9d9d4" fontSize="11">{latest.count} entries</text>
          </g>
        ) : null}
      </svg>
    </section>
  );
}

function HorizontalBars({
  id,
  title,
  stats,
  color,
}: {
  id: string;
  title: string;
  stats: DashboardStat[];
  color: string;
}) {
  const max = Math.max(1, ...stats.map((stat) => stat.count));

  return (
    <section className="analytics-panel bar-panel" aria-labelledby={id}>
      <h3 id={id}>{title}</h3>
      <div className="bar-list">
        {stats.map((stat) => (
          <div className="bar-row" key={stat.label}>
            <span className="bar-label">{stat.label}</span>
            <span className="bar-track" aria-hidden="true">
              <i style={{ width: `${(stat.count / max) * 100}%`, backgroundColor: color }} />
            </span>
            <span className="bar-value">
              {stat.count} <small>({stat.percentage ?? Math.round((stat.count / max) * 100)}%)</small>
            </span>
          </div>
        ))}
      </div>
      <div className="bar-axis" aria-hidden="true">
        <span>0</span>
        <span>{Math.round(max / 2)}</span>
        <span>{max < 10 ? 10 : Math.ceil(max / 10) * 10}</span>
        <small>Entries</small>
      </div>
    </section>
  );
}

export function Analytics({ timeline, archetypes, technologies }: AnalyticsProps) {
  return (
    <div className="analytics-strip">
      <TimelineChart points={timeline} />
      <HorizontalBars id="archetype-heading" title="Passion archetypes" stats={archetypes} color="#fb684e" />
      <HorizontalBars id="technology-heading" title="Sponsor technology" stats={technologies.slice(0, 8)} color="#4ea8c3" />
    </div>
  );
}
