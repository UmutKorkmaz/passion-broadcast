import "server-only";

import type { DashboardData } from "@/components/dashboard/types";
import type { DashboardSnapshot } from "@/lib/types";

const archetypeColors: Record<string, string> = {
  "Building & Coding": "#ff704f",
  Competition: "#f7ad37",
  "Creative Craft": "#9e7de8",
  Community: "#61c7ca",
  "Family & Legacy": "#a6d98b",
  Fandom: "#e679ad",
  "Self-Improvement": "#a7dd83",
  Exploration: "#70ade6",
};

function formatInIstanbul(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.valueOf())) return timestamp;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/Istanbul",
  }).format(date);
}

export function toDashboardData(snapshot: DashboardSnapshot): DashboardData {
  return {
    updatedAt: `${formatInIstanbul(snapshot.sourceUpdatedAt)} TRT`,
    metrics: snapshot.metrics,
    archetypeStats: snapshot.archetypes,
    technologyStats: snapshot.sponsorTechnologies,
    technologyFilterOptions: snapshot.technologies
      .slice(0, 30)
      .map((technology) => technology.label),
    timeline: snapshot.timeline,
    entries: snapshot.entries.map((entry) => ({
      id: String(entry.articleId),
      title: entry.title,
      builder: entry.authorName,
      handle: `@${entry.authorUsername}`,
      archetype: entry.archetype,
      archetypeColor: archetypeColors[entry.archetype] ?? "#6bbfc8",
      technologies: entry.technologies,
      reactions: entry.positiveReactions,
      submittedAt: entry.publishedAt,
      submittedLabel: formatInIstanbul(entry.publishedAt),
      url: entry.url,
      summary: entry.groundedSummary || entry.description,
      motivation: entry.motivation,
      emotionalTone: entry.emotionalTone,
      confidence: entry.confidence,
    })),
    broadcast: snapshot.latestBroadcast ?? {
      title: "State of Passion",
      durationSeconds: 0,
      transcript:
        "The latest State of Passion broadcast is being prepared from the current challenge snapshot.",
    },
  };
}
