export const challengeArticleSummary = {
  id: 4117067,
  type_of: "article",
  title: "My Abandoned Cricket Kit Confronted Me. So I Built It a Voice",
  description:
    "This is a submission for the DEV Weekend Challenge: Passion Edition.",
  url: "https://dev.to/himanshu_748/my-abandoned-cricket-kit-confronted-me-so-i-built-it-a-voice-ph1",
  canonical_url:
    "https://dev.to/himanshu_748/my-abandoned-cricket-kit-confronted-me-so-i-built-it-a-voice-ph1",
  published_at: "2026-07-11T03:10:15Z",
  published_timestamp: "2026-07-11T03:10:15Z",
  edited_at: "2026-07-11T06:02:11Z",
  tag_list: ["devchallenge", "weekendchallenge", "AI", "solana"],
  cover_image: "https://images.example.dev/cricket-cover.png",
  social_image: "https://images.example.dev/cricket-social.png",
  reading_time_minutes: 3,
  comments_count: 2,
  public_reactions_count: 11,
  positive_reactions_count: 11,
  user: {
    name: "Himanshu Kumar",
    username: "himanshu_748",
    user_id: 3226847,
    profile_image: "https://images.example.dev/himanshu.png",
    profile_image_90: "https://images.example.dev/himanshu-90.png",
  },
  organization: null,
};

export const challengeArticleDetail = {
  ...challengeArticleSummary,
  tag_list: "devchallenge, weekendchallenge, AI, solana",
  tags: ["devchallenge", "weekendchallenge", "AI", "solana"],
  title:
    "  My Abandoned Cricket Kit Confronted Me.  So I Built It a Voice  ",
  description:
    "This is a submission for the DEV Weekend Challenge:\nPassion Edition.",
  body_markdown:
    "# The spark\r\n\r\nMy cricket kit had been waiting for a voice.\r\n",
};

export function makeSummary(
  id: number,
  publishedAt: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    ...challengeArticleSummary,
    id,
    title: `Passion project ${id}`,
    url: `https://dev.to/builder/passion-project-${id}`,
    canonical_url: `https://dev.to/builder/passion-project-${id}`,
    published_at: publishedAt,
    published_timestamp: publishedAt,
    edited_at: null,
    user: {
      ...challengeArticleSummary.user,
      name: "Weekend Builder",
      username: "builder",
    },
    ...overrides,
  };
}

export function makeDetail(summary: ReturnType<typeof makeSummary>) {
  return {
    ...summary,
    tag_list: Array.isArray(summary.tag_list)
      ? summary.tag_list.join(", ")
      : summary.tag_list,
    tags: Array.isArray(summary.tag_list) ? summary.tag_list : [],
    body_markdown: `# ${summary.title}\n\nA detailed passion story.`,
  };
}
