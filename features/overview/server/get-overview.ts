import { prisma } from "@/lib/db";
import {
  getInstallationStatus,
  getUserInstallationId,
} from "@/features/github/server/installation";
import type { GithubInstallationStatus } from "@/features/dashboard/lib/types";
import {
  getRecentActivity,
  type OverviewActivity,
} from "@/features/overview/server/activity";
import { getRepoSummary, type RepoSummary } from "@/features/overview/server/repo-summary";

/** Pull request review counts broken down by status. */
export type OverviewPullRequestStats = {
  total: number;
  reviewed: number;
  pending: number;
  processing: number;
  rateLimited: number;
};

/**
 * Everything the dashboard overview needs, fetched live on the server and
 * serialized straight into the page — no mock data.
 */
export type DashboardOverview = {
  installation: GithubInstallationStatus;
  pullRequests: OverviewPullRequestStats;
  /** `null` until the GitHub App is connected. */
  repos: RepoSummary | null;
  activity: OverviewActivity[];
};

const EMPTY_PULL_REQUEST_STATS: OverviewPullRequestStats = {
  total: 0,
  reviewed: 0,
  pending: 0,
  processing: 0,
  rateLimited: 0,
};

/**
 * Aggregate the real dashboard overview for one user: GitHub App
 * installation status, repository + sync summary, review statistics, and
 * the recent activity timeline.
 *
 * All independent queries run in parallel. Returns an empty-but-valid
 * overview when the GitHub App is not connected yet, so the page can
 * render a connect prompt instead of an error state.
 *
 * @param userId - The authenticated user id (session user).
 */
export async function getOverview(userId: string): Promise<DashboardOverview> {
  const [installation, installationId] = await Promise.all([
    getInstallationStatus(userId),
    getUserInstallationId(userId),
  ]);

  if (!installation.connected || !installationId) {
    return {
      installation,
      pullRequests: { ...EMPTY_PULL_REQUEST_STATS },
      repos: null,
      activity: [],
    };
  }

  const [statusCounts, repos, activity] = await Promise.all([
    prisma.pullRequest.groupBy({
      by: ["status"],
      where: { installationId },
      _count: { _all: true },
    }),
    getRepoSummary(installationId),
    getRecentActivity(installationId, installation.installedAt),
  ]);

  const pullRequests: OverviewPullRequestStats = {
    ...EMPTY_PULL_REQUEST_STATS,
  };

  for (const row of statusCounts) {
    const count = row._count._all;
    pullRequests.total += count;

    if (row.status === "reviewed") {
      pullRequests.reviewed += count;
    } else if (row.status === "processing") {
      pullRequests.processing += count;
    } else if (row.status === "rate_limited") {
      pullRequests.rateLimited += count;
    } else {
      // "pending" plus any unknown value still counts as awaiting review.
      pullRequests.pending += count;
    }
  }

  return { installation, pullRequests, repos, activity };
}
