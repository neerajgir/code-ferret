import { getInstallationReposPage } from "@/features/github/server/repos";
import { prisma } from "@/lib/db";

export type RepoLanguageSummary = {
  name: string;
  count: number;
};

/**
 * Live repository summary for the dashboard overview: GitHub's view of the
 * installation's repositories plus codebase sync progress from the database.
 */
export type RepoSummary = {
  /** Total repositories visible to the GitHub App. */
  totalRepos: number;
  publicRepos: number;
  privateRepos: number;
  /** Top languages across the sampled repositories, most common first. */
  languages: RepoLanguageSummary[];
  /** Repos whose codebase has been indexed into Pinecone. */
  syncedRepos: number;
  /** Repos queued or currently indexing. */
  syncingRepos: number;
  failedRepos: number;
  /** ISO timestamp of the most recent successful sync. */
  lastSyncedAt: string | null;
};

/** How many of the most common languages to surface on the overview. */
const TOP_LANGUAGE_COUNT = 5;

/**
 * Build the repository summary for one installation.
 *
 * Visibility and language stats are computed from GitHub's first repo page
 * (up to 100 repos) so the overview stays a single cheap API call; totals
 * and sync counts are always exact. Resilient by design: if the GitHub API
 * is unreachable, the summary falls back to database-derived numbers
 * instead of failing the whole overview.
 *
 * @param installationId - The GitHub App installation id for the user.
 */
export async function getRepoSummary(
  installationId: number
): Promise<RepoSummary> {
  const [syncStats, repoPage] = await Promise.all([
    prisma.repoSync.groupBy({
      by: ["status"],
      where: { installationId },
      _count: { _all: true },
    }),
    // A GitHub outage should degrade the overview, not break it.
    getInstallationReposPage(installationId, 1).catch(() => null),
  ]);

  let syncedRepos = 0;
  let syncingRepos = 0;
  let failedRepos = 0;

  for (const stat of syncStats) {
    const count = stat._count._all;

    if (stat.status === "synced") {
      syncedRepos += count;
    } else if (stat.status === "failed") {
      failedRepos += count;
    } else {
      // "pending" and "syncing" both mean the codebase is not indexed yet.
      syncingRepos += count;
    }
  }

  const lastSync = await prisma.repoSync.findFirst({
    where: { installationId, status: "synced" },
    orderBy: { syncedAt: "desc" },
    select: { syncedAt: true },
  });

  let publicRepos = 0;
  let privateRepos = 0;
  const languageCounts = new Map<string, number>();

  for (const repo of repoPage?.repos ?? []) {
    if (repo.visibility === "public") {
      publicRepos += 1;
    } else {
      privateRepos += 1;
    }

    const language = repo.language ?? "Other";
    languageCounts.set(language, (languageCounts.get(language) ?? 0) + 1);
  }

  const languages = [...languageCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, TOP_LANGUAGE_COUNT);

  const knownRepos = publicRepos + privateRepos;

  return {
    // When the GitHub call failed, fall back to the repos we have synced.
    totalRepos: repoPage?.totalCount ?? knownRepos + syncingRepos + failedRepos,
    publicRepos,
    privateRepos,
    languages,
    syncedRepos,
    syncingRepos,
    failedRepos,
    lastSyncedAt: lastSync?.syncedAt?.toISOString() ?? null,
  };
}
