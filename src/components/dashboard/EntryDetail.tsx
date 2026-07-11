import type { DashboardEntry } from "./types";
import { ExternalLinkIcon } from "./icons";

export function EntryDetail({ entry }: { entry: DashboardEntry }) {
  const initials = entry.builder
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <article className="entry-detail" aria-labelledby="selected-entry-title">
      <p className="section-kicker">
        <span>From the community</span>
        <small>AI confidence {Math.round(entry.confidence * 100)}%</small>
      </p>
      <h3 id="selected-entry-title">{entry.title}</h3>

      <div className="builder-identity">
        <span className="builder-avatar" aria-hidden="true">{initials}</span>
        <span>
          <strong>{entry.builder}</strong>
          <small>{entry.handle}</small>
        </span>
      </div>

      <p className="entry-summary">{entry.summary}</p>

      <div className="entry-facts">
        <div>
          <h4>Motivation</h4>
          <p>{entry.motivation}</p>
        </div>
        <div>
          <h4>Emotional tone</h4>
          <p>{entry.emotionalTone}</p>
        </div>
        <div>
          <h4>Technology</h4>
          <p>{entry.technologies.join(", ")}</p>
        </div>
      </div>

      <a className="dev-link" href={entry.url} target="_blank" rel="noreferrer">
        Read on DEV <ExternalLinkIcon size={16} />
      </a>
    </article>
  );
}
