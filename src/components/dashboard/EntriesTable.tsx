import { useState } from "react";

import type { DashboardEntry } from "./types";
import { ExternalLinkIcon } from "./icons";

type EntriesTableProps = {
  entries: DashboardEntry[];
  totalEntries: number;
  selectedEntryId: string;
  onSelectEntry: (entryId: string) => void;
};

export function EntriesTable({ entries, totalEntries, selectedEntryId, onSelectEntry }: EntriesTableProps) {
  const pageSize = 8;
  const [requestedPage, setRequestedPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(entries.length / pageSize));
  const currentPage = Math.min(requestedPage, pageCount - 1);
  const start = currentPage * pageSize;
  const visibleEntries = entries.slice(start, start + pageSize);
  const pageNumbers = Array.from(
    new Set(
      pageCount <= 5
        ? Array.from({ length: pageCount }, (_, index) => index)
        : [0, currentPage - 1, currentPage, currentPage + 1, pageCount - 1],
    ),
  )
    .filter((page) => page >= 0 && page < pageCount)
    .sort((left, right) => left - right);

  return (
    <section className="entries-section" aria-labelledby="entries-heading">
      <div className="entries-heading-row">
        <h2 id="entries-heading">Open entries</h2>
        <a href="https://dev.to/t/weekendchallenge" target="_blank" rel="noreferrer">
          View all {totalEntries} on DEV <ExternalLinkIcon size={15} />
        </a>
      </div>

      <div className="entries-table-wrap">
        <table className="entries-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Builder</th>
              <th>Archetype</th>
              <th>Technologies</th>
              <th>Reactions</th>
              <th>Submitted</th>
              <th><span className="sr-only">Open on DEV</span></th>
            </tr>
          </thead>
          <tbody>
            {visibleEntries.map((entry) => (
              <tr key={entry.id} className={entry.id === selectedEntryId ? "is-selected" : undefined}>
                <td className="entry-title-cell">
                  <button type="button" onClick={() => onSelectEntry(entry.id)}>{entry.title}</button>
                </td>
                <td className="entry-builder-cell">{entry.builder}</td>
                <td className="entry-archetype-cell">
                  <i style={{ backgroundColor: entry.archetypeColor }} />
                  <span>{entry.archetype}</span>
                </td>
                <td className="entry-tech-cell">{entry.technologies.slice(0, 3).join(", ")}</td>
                <td className="entry-reactions-cell">{entry.reactions} <span aria-label="reactions">♥</span></td>
                <td className="entry-time-cell">{entry.submittedLabel}</td>
                <td className="entry-link-cell">
                  <a href={entry.url} target="_blank" rel="noreferrer" aria-label={`Open ${entry.title} on DEV`}>
                    <ExternalLinkIcon size={15} />
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {visibleEntries.length === 0 ? <p className="entries-empty">No entries match these filters.</p> : null}
      </div>

      <div className="entries-footer">
        <span className="desktop-range">{entries.length ? start + 1 : 0}–{start + visibleEntries.length} of {entries.length || totalEntries}</span>
        <span className="mobile-range">{entries.length ? start + 1 : 0}–{start + Math.min(5, visibleEntries.length)} of {entries.length || totalEntries}</span>
        <nav aria-label="Entry pages">
          <button className="pagination-previous" type="button" disabled={currentPage === 0} onClick={() => setRequestedPage(currentPage - 1)} aria-label="Previous page">‹</button>
          {pageNumbers.map((page, index) => (
            <span className="pagination-item" key={page}>
              {index > 0 && page - pageNumbers[index - 1] > 1 ? <i aria-hidden="true">…</i> : null}
              <button
                className={`pagination-page${page === currentPage ? " is-current" : ""}`}
                type="button"
                onClick={() => setRequestedPage(page)}
                aria-current={page === currentPage ? "page" : undefined}
                aria-label={`Page ${page + 1}`}
              >
                {page + 1}
              </button>
            </span>
          ))}
          <button className="pagination-next" type="button" disabled={currentPage >= pageCount - 1} onClick={() => setRequestedPage(currentPage + 1)} aria-label="Next page">›</button>
        </nav>
      </div>
    </section>
  );
}
