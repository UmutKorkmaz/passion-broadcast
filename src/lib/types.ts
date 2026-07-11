export interface DevChallengeEntry {
  devId: number;
  title: string;
  description: string;
  authorName: string;
  authorUsername: string;
  authorProfileImageUrl: string | null;
  organizationName: string | null;
  organizationUsername: string | null;
  url: string;
  canonicalUrl: string;
  publishedAt: string;
  editedAt: string | null;
  tags: string[];
  coverImageUrl: string | null;
  socialImageUrl: string | null;
  readingTimeMinutes: number;
  commentCount: number;
  reactionCount: number;
  bodyMarkdown: string;
  contentHash: string;
}

export interface ChallengeEntry {
  articleId: number;
  title: string;
  description: string;
  bodyExcerpt: string;
  url: string;
  authorName: string;
  authorUsername: string;
  tags: string[];
  publishedAt: string;
  positiveReactions: number;
  commentsCount: number;
  readingTimeMinutes: number;
  coverImage: string | null;
  contentHash: string;
  sourceFetchedAt: string;
}

export interface DashboardEntry extends ChallengeEntry {
  archetype: string;
  domain: string;
  motivation: string;
  emotionalTone: string;
  technologies: string[];
  sponsorTechnologies: string[];
  groundedSummary: string;
  confidence: number;
}

export interface BreakdownDatum {
  label: string;
  count: number;
  percentage?: number;
}

export interface TimelineDatum {
  label: string;
  count: number;
}

export interface DashboardMetrics {
  entries: number;
  builders: number;
  archetypes: number;
  reactions: number;
  analyzedEntries?: number;
  technologies?: number;
}

export interface AnalysisCoverage {
  analyzed: number;
  total: number;
  percentage: number;
}

export interface LatestBroadcast {
  title: string;
  transcript: string;
  durationSeconds: number;
  audioUrl?: string;
  generatedAt?: string;
}

export interface DashboardSnapshot {
  metrics: DashboardMetrics;
  entries: DashboardEntry[];
  archetypes: BreakdownDatum[];
  technologies: BreakdownDatum[];
  sponsorTechnologies: BreakdownDatum[];
  timeline: TimelineDatum[];
  analysisCoverage: AnalysisCoverage;
  generatedAt: string;
  sourceUpdatedAt: string;
  latestBroadcast?: LatestBroadcast;
}
