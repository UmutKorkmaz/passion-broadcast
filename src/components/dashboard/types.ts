export type DashboardEntry = {
  id: string;
  title: string;
  builder: string;
  handle: string;
  archetype: string;
  archetypeColor: string;
  technologies: string[];
  reactions: number;
  submittedAt: string;
  submittedLabel: string;
  url: string;
  summary: string;
  motivation: string;
  emotionalTone: string;
  confidence: number;
  constellation?: {
    x: number;
    y: number;
  };
};

export type DashboardStat = {
  label: string;
  count: number;
  percentage?: number;
};

export type TimelinePoint = {
  label: string;
  count: number;
};

export type Broadcast = {
  title: string;
  transcript: string;
  durationSeconds: number;
  audioUrl?: string;
  generatedAt?: string;
};

export type DashboardData = {
  updatedAt: string;
  metrics: {
    entries: number;
    builders: number;
    archetypes: number;
    reactions: number;
    analyzedEntries?: number;
  };
  entries: DashboardEntry[];
  archetypeStats: DashboardStat[];
  technologyStats: DashboardStat[];
  technologyFilterOptions: string[];
  timeline: TimelinePoint[];
  broadcast: Broadcast;
};
