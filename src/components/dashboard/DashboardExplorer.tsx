"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Analytics } from "./Analytics";
import { AudioPlayer } from "./AudioPlayer";
import { ConstellationMap } from "./ConstellationMap";
import { EntriesTable } from "./EntriesTable";
import { EntryDetail } from "./EntryDetail";
import { BrandMark, ChevronIcon, RefreshIcon } from "./icons";
import type { DashboardData } from "./types";

export type DashboardExplorerProps = {
  initialData: DashboardData;
};

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="filter-select">
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="all">All {label.toLowerCase()}</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
      <ChevronIcon />
    </label>
  );
}

export function DashboardExplorer({ initialData }: DashboardExplorerProps) {
  const router = useRouter();
  const data = initialData;
  const [isRefreshing, startRefresh] = useTransition();
  const [archetypeFilter, setArchetypeFilter] = useState("all");
  const [technologyFilter, setTechnologyFilter] = useState("all");
  const [selectedEntryId, setSelectedEntryId] = useState(
    data.entries[0]?.id ?? "",
  );

  const archetypes = useMemo(
    () => data.archetypeStats.map((stat) => stat.label),
    [data.archetypeStats],
  );
  const technologies = useMemo(
    () => data.technologyFilterOptions,
    [data.technologyFilterOptions],
  );
  const filteredEntries = useMemo(
    () => data.entries.filter((entry) => {
      const matchesArchetype = archetypeFilter === "all" || entry.archetype === archetypeFilter;
      const matchesTechnology = technologyFilter === "all" || entry.technologies.includes(technologyFilter);
      return matchesArchetype && matchesTechnology;
    }),
    [archetypeFilter, data.entries, technologyFilter],
  );
  const visibleEntryIds = useMemo(() => new Set(filteredEntries.map((entry) => entry.id)), [filteredEntries]);
  const selectedEntry = filteredEntries.find((entry) => entry.id === selectedEntryId)
    ?? filteredEntries[0]
    ?? data.entries[0];

  const refresh = () => {
    startRefresh(() => router.refresh());
  };

  return (
    <div className="dashboard-app">
      <header className="site-header">
        <div className="brand-lockup">
          <BrandMark className="brand-mark" />
          <strong>Passion Broadcast</strong>
        </div>
        <div className="update-meta">
          <span>
            Updated {data.updatedAt} · {data.metrics.analyzedEntries ?? data.metrics.entries}/{data.metrics.entries} analyzed
          </span>
          <button type="button" onClick={refresh} disabled={isRefreshing}>
            <RefreshIcon />
            {isRefreshing ? "Refreshing" : "Refresh"}
          </button>
        </div>
      </header>

      <main className="dashboard-main">
        <section className="dashboard-hero" aria-labelledby="page-title">
          <h1 id="page-title">What does DEV care enough<br className="desktop-break" /> to build this weekend?</h1>
          <p>A live, source-backed map of the projects, people, and<br className="desktop-break" /> motivations shaping Passion Edition.</p>

          <dl className="metric-strip">
            <div><dt>{data.metrics.entries}</dt><dd>entries</dd></div>
            <div><dt>{data.metrics.builders}</dt><dd>builders</dd></div>
            <div><dt>{data.metrics.archetypes}</dt><dd>archetypes</dd></div>
            <div><dt>{data.metrics.reactions}</dt><dd>reactions</dd></div>
          </dl>
        </section>

        <section className="dashboard-filters" aria-label="Filter entries">
          <FilterSelect label="Archetypes" value={archetypeFilter} options={archetypes} onChange={setArchetypeFilter} />
          <FilterSelect label="Technologies" value={technologyFilter} options={technologies} onChange={setTechnologyFilter} />
          <button className="filter-refresh" type="button" onClick={refresh} disabled={isRefreshing}>
            <RefreshIcon />
            {isRefreshing ? "Refreshing" : "Refresh"}
          </button>
        </section>

        <section className="passion-section" aria-labelledby="passion-map-heading">
          <h2 id="passion-map-heading">The passion map</h2>
          <div className="passion-layout">
            <ConstellationMap
              entries={data.entries}
              archetypeStats={data.archetypeStats}
              selectedEntryId={selectedEntry?.id ?? ""}
              onSelectEntry={setSelectedEntryId}
              visibleEntryIds={visibleEntryIds}
            />
            {selectedEntry ? <EntryDetail entry={selectedEntry} /> : null}
          </div>
        </section>

        <Analytics
          timeline={data.timeline}
          archetypes={data.archetypeStats}
          technologies={data.technologyStats}
        />

        <EntriesTable
          key={`${archetypeFilter}:${technologyFilter}`}
          entries={filteredEntries}
          totalEntries={data.metrics.entries}
          selectedEntryId={selectedEntry?.id ?? ""}
          onSelectEntry={setSelectedEntryId}
        />
      </main>

      <AudioPlayer
        key={data.broadcast.generatedAt ?? data.broadcast.audioUrl ?? data.broadcast.transcript}
        broadcast={data.broadcast}
      />
    </div>
  );
}
