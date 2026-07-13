import { useMemo, useState } from "react";

import type { DashboardEntry, DashboardStat } from "./types";

type ConstellationMapProps = {
  entries: DashboardEntry[];
  archetypeStats: DashboardStat[];
  selectedEntryId: string;
  onSelectEntry: (entryId: string) => void;
  visibleEntryIds: Set<string>;
};

type ClusterSpec = {
  x: number;
  y: number;
  rx: number;
  ry: number;
  labelX: number;
  labelY: number;
  anchor: "start" | "middle" | "end";
};

const clusterSpecs: Record<string, ClusterSpec> = {
  "Competition": { x: 130, y: 158, rx: 67, ry: 60, labelX: 83, labelY: 86, anchor: "middle" },
  "Building & Coding": { x: 332, y: 147, rx: 91, ry: 78, labelX: 332, labelY: 56, anchor: "middle" },
  "Creative Craft": { x: 515, y: 160, rx: 67, ry: 58, labelX: 520, labelY: 88, anchor: "middle" },
  "Community": { x: 152, y: 327, rx: 62, ry: 52, labelX: 72, labelY: 324, anchor: "end" },
  "Family & Legacy": { x: 515, y: 330, rx: 58, ry: 53, labelX: 578, labelY: 328, anchor: "start" },
  "Fandom": { x: 137, y: 475, rx: 57, ry: 50, labelX: 86, labelY: 527, anchor: "middle" },
  "Self-Improvement": { x: 327, y: 492, rx: 78, ry: 59, labelX: 327, labelY: 563, anchor: "middle" },
  "Exploration": { x: 510, y: 468, rx: 58, ry: 52, labelX: 575, labelY: 488, anchor: "start" },
};

const clusterLinks: Array<[string, string]> = [
  ["Competition", "Building & Coding"],
  ["Competition", "Community"],
  ["Building & Coding", "Creative Craft"],
  ["Building & Coding", "Community"],
  ["Building & Coding", "Family & Legacy"],
  ["Building & Coding", "Self-Improvement"],
  ["Creative Craft", "Family & Legacy"],
  ["Community", "Family & Legacy"],
  ["Community", "Fandom"],
  ["Community", "Self-Improvement"],
  ["Family & Legacy", "Exploration"],
  ["Fandom", "Self-Improvement"],
  ["Self-Improvement", "Exploration"],
];

const stars = Array.from({ length: 78 }, (_, index) => ({
  x: 14 + ((index * 83) % 585),
  y: 21 + ((index * 137) % 536),
  radius: index % 11 === 0 ? 1.2 : index % 4 === 0 ? 0.8 : 0.5,
  opacity: 0.18 + (index % 5) * 0.08,
}));

function makeClusterPoints(spec: ClusterSpec, count: number) {
  const safeCount = Math.max(3, count);
  return Array.from({ length: safeCount }, (_, index) => {
    const angle = (Math.PI * 2 * index) / safeCount + (index % 2) * 0.22;
    const ring = index % 5 === 0 ? 0.22 : index % 3 === 0 ? 0.57 : 0.8;
    return {
      x: spec.x + Math.cos(angle) * spec.rx * ring,
      y: spec.y + Math.sin(angle) * spec.ry * ring,
      radius: index % 7 === 0 ? 6 : index % 3 === 0 ? 4.5 : 3.5,
    };
  });
}

export function ConstellationMap({
  entries,
  archetypeStats,
  selectedEntryId,
  onSelectEntry,
  visibleEntryIds,
}: ConstellationMapProps) {
  const [zoom, setZoom] = useState(1);
  const selectedEntry = entries.find((entry) => entry.id === selectedEntryId) ?? entries[0];

  const mappedClusters = useMemo(
    () =>
      archetypeStats
        .filter((stat) => clusterSpecs[stat.label])
        .map((stat) => {
          const spec = clusterSpecs[stat.label];
          const clusterEntries = entries.filter((entry) => entry.archetype === stat.label);
          return {
            ...stat,
            spec,
            entries: clusterEntries,
            points: makeClusterPoints(spec, stat.count),
          };
        }),
    [archetypeStats, entries],
  );

  const selectedPoint = useMemo(() => {
    if (!selectedEntry) return undefined;
    if (selectedEntry.constellation) return selectedEntry.constellation;
    const cluster = mappedClusters.find((candidate) => candidate.label === selectedEntry.archetype);
    if (!cluster) return undefined;
    const index = cluster.entries.findIndex((entry) => entry.id === selectedEntry.id);
    if (index < 0) return undefined;
    return cluster.points[index % cluster.points.length];
  }, [mappedClusters, selectedEntry]);

  return (
    <div className="constellation-shell">
      <svg
        className="constellation-map"
        viewBox="0 0 620 590"
        role="img"
        aria-label="Interactive constellation map of challenge passion archetypes"
      >
        <g className="constellation-stars" aria-hidden="true">
          {stars.map((star, index) => (
            <circle
              key={index}
              cx={star.x}
              cy={star.y}
              r={star.radius}
              fill="#55bed2"
              opacity={star.opacity}
            />
          ))}
        </g>

        <g transform={`translate(${310 * (1 - zoom)} ${292 * (1 - zoom)}) scale(${zoom})`}>
          <g aria-hidden="true">
            {clusterLinks.map(([from, to]) => {
              const start = clusterSpecs[from];
              const end = clusterSpecs[to];
              return (
                <line
                  key={`${from}-${to}`}
                  x1={start.x}
                  y1={start.y}
                  x2={end.x}
                  y2={end.y}
                  stroke="#56b6c9"
                  strokeWidth="1"
                  opacity=".58"
                />
              );
            })}
            {clusterLinks.flatMap(([from, to], index) => {
              const start = clusterSpecs[from];
              const end = clusterSpecs[to];
              const x = start.x + (end.x - start.x) * (index % 2 === 0 ? 0.42 : 0.68);
              const y = start.y + (end.y - start.y) * (index % 2 === 0 ? 0.42 : 0.68);
              return <circle key={`${from}-${to}-junction`} cx={x} cy={y} r="3" fill="#6ec8d5" />;
            })}
          </g>

          {mappedClusters.map((cluster) => {
            const clusterVisible = cluster.entries.length === 0 || cluster.entries.some((entry) => visibleEntryIds.has(entry.id));
            return (
              <g key={cluster.label} opacity={clusterVisible ? 1 : 0.22}>
                <ellipse
                  cx={cluster.spec.x}
                  cy={cluster.spec.y}
                  rx={cluster.spec.rx}
                  ry={cluster.spec.ry}
                  fill="#061b29"
                  stroke="#35bfd0"
                  strokeWidth="1.25"
                  strokeDasharray="2.5 3"
                />
                <text
                  x={cluster.spec.labelX}
                  y={cluster.spec.labelY}
                  fill="#f1e9dd"
                  fontSize="15"
                  fontWeight="500"
                  textAnchor={cluster.spec.anchor}
                >
                  {cluster.label === "Family & Legacy" ? (
                    <>
                      <tspan x={cluster.spec.labelX} dy="0">Family &</tspan>
                      <tspan x={cluster.spec.labelX} dy="17">Legacy</tspan>
                    </>
                  ) : cluster.label}
                </text>
                <g aria-hidden="true">
                  {cluster.points.slice(1).map((point, index) => {
                    const previous = cluster.points[index];
                    const cross = cluster.points[(index * 3 + 2) % cluster.points.length];
                    return (
                      <g key={index}>
                        <line
                          x1={previous.x}
                          y1={previous.y}
                          x2={point.x}
                          y2={point.y}
                          stroke="#e8785f"
                          strokeWidth=".8"
                          opacity=".57"
                        />
                        {index % 2 === 0 ? (
                          <line
                            x1={point.x}
                            y1={point.y}
                            x2={cross.x}
                            y2={cross.y}
                            stroke="#628696"
                            strokeWidth=".7"
                            opacity=".5"
                          />
                        ) : null}
                      </g>
                    );
                  })}
                </g>

                {cluster.entries.map((entry, index) => {
                  const fallbackPoint = cluster.points[index % cluster.points.length];
                  const point = entry.constellation ?? fallbackPoint;
                  const isSelected = entry.id === selectedEntryId;
                  const isVisible = visibleEntryIds.has(entry.id);
                  return (
                    <circle
                      key={entry.id}
                      cx={point.x}
                      cy={point.y}
                      r={isSelected ? 11 : Math.min(8, 4 + entry.reactions / 9)}
                      fill="#fb684e"
                      stroke={isSelected ? "#f5eee3" : "#ff9b7f"}
                      strokeWidth={isSelected ? 3 : 1}
                      opacity={isVisible ? 1 : 0.25}
                      role="button"
                      tabIndex={isVisible ? 0 : -1}
                      aria-label={`Select ${entry.title}`}
                      onClick={() => isVisible && onSelectEntry(entry.id)}
                      onKeyDown={(event) => {
                        if (isVisible && (event.key === "Enter" || event.key === " ")) {
                          event.preventDefault();
                          onSelectEntry(entry.id);
                        }
                      }}
                    />
                  );
                })}
              </g>
            );
          })}

          {selectedPoint ? (
            <g aria-hidden="true" className="selection-halo">
              <circle
                cx={selectedPoint.x}
                cy={selectedPoint.y}
                r="17"
                fill="none"
                stroke="#ff6047"
                strokeWidth="1.5"
                opacity=".85"
              />
              <circle
                cx={selectedPoint.x}
                cy={selectedPoint.y}
                r="24"
                fill="none"
                stroke="#ff6047"
                strokeWidth="1"
                strokeDasharray="3 5"
                opacity=".45"
              />
            </g>
          ) : null}
        </g>
      </svg>

      <div className="constellation-legend" aria-label="Constellation node legend">
        <span><i className="legend-dot legend-dot-large" />More reactions</span>
        <span><i className="legend-dot" />Fewer reactions</span>
      </div>

      <div className="map-zoom" aria-label="Map zoom controls">
        <button
          type="button"
          aria-label="Zoom out"
          onClick={() => setZoom((current) => Math.max(0.85, Number((current - 0.05).toFixed(2))))}
          disabled={zoom <= 0.85}
        >
          −
        </button>
        <output aria-live="polite">{Math.round(zoom * 100)}%</output>
        <button
          type="button"
          aria-label="Zoom in"
          onClick={() => setZoom((current) => Math.min(1.15, Number((current + 0.05).toFixed(2))))}
          disabled={zoom >= 1.15}
        >
          +
        </button>
      </div>
    </div>
  );
}
