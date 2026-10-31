import { DASHBOARD_ROUTES } from "@/features/dashboard/lib/routes";
import {
  isPullRequestStatus,
  PULL_REQUEST_STATUS_LABEL,
  type PullRequestStatus,
} from "@/features/pull-requests/lib/status";
import { prisma } from "@/lib/db";

export type OverviewActivityKind =
  | "app_installed"
  | "repo_synced"
  | "repo_sync_failed"
  | "review_completed"
  | "review_processing"
  | "review_queued"
  | "review_rate_limited";

/** One entry in the "Recent activity" timeline on the overview page. */
export type OverviewActivity = {
  id: string;
  kind: OverviewActivityKind;
  title: string;
  description: string;
  /** Internal dashboard link, or `null` when there is nothing to link to. */
  href: string | null;
  /** ISO timestamp used for sorting and relative-time display. */
  at: string;
};

/** Map the current review status of a PR onto its activity kind. */
const REVIEW_ACTIVITY_KIND: Record<PullRequestStatus, OverviewActivityKind> = {
  pending: "review_queued",
  processing: "review_processing",
  reviewed: "review_completed",
  rate_limited: "review_rate_limited",
};

/** How many pull requests and syncs to consider before trimming to `limit`. */
const RECENT_PULL_REQUEST_SCAN = 12;
const RECENT_SYNC_SCAN = 6;

/**
 * Build the merged "Recent activity" timeline for one installation.
 *
 * Combines pull request review updates, codebase sync results, and the
 * original app installation into a single feed sorted by most recent
 * first. Each pull request contributes exactly one entry reflecting its
 * current state.
 *
 * @param installationId - The GitHub App installation id for the user.
 * @param installedAt - ISO timestamp of the app installation, if any.
 * @param limit - Maximum number of entries to return.
 */
export async function getRecentActivity(
  installationId: number,
  installedAt: string | null,
  limit = 8
): Promise<OverviewActivity[]> {
  const [pullRequests, repoSyncs] = await Promise.all([
    prisma.pullRequest.findMany({
      where: { installationId },
      orderBy: { updatedAt: "desc" },
      take: RECENT_PULL_REQUEST_SCAN,
      select: {
        id: true,
        repoFullName: true,
        prNumber: true,
        title: true,
        status: true,
        reviewedAt: true,
        updatedAt: true,
      },
    }),
    prisma.repoSync.findMany({
      where: { installationId },
      orderBy: { updatedAt: "desc" },
      take: RECENT_SYNC_SCAN,
      select: {
        id: true,
        repoFullName: true,
        branch: true,
        status: true,
        syncedAt: true,
        updatedAt: true,
      },
    }),
  ]);

  const activities: OverviewActivity[] = [];

  for (const pullRequest of pullRequests) {
    // The status column is untyped in the database — degrade unknown
    // values to "pending" instead of leaking them into the UI.
    const status = isPullRequestStatus(pullRequest.status)
      ? pullRequest.status
      : "pending";

    activities.push({
      id: `pull-request-${pullRequest.id}`,
      kind: REVIEW_ACTIVITY_KIND[status],
      title: pullRequest.title,
      description: `${pullRequest.repoFullName} · #${pullRequest.prNumber} · ${PULL_REQUEST_STATUS_LABEL[status]}`,
      href: `${DASHBOARD_ROUTES.pullRequest}/${pullRequest.id}`,
      at: (pullRequest.reviewedAt ?? pullRequest.updatedAt).toISOString(),
    });
  }

  for (const sync of repoSyncs) {
    const failed = sync.status === "failed";

    activities.push({
      id: `repo-sync-${sync.id}`,
      kind: failed ? "repo_sync_failed" : "repo_synced",
      title: failed ? "Codebase sync failed" : "Codebase synced",
      description: `${sync.repoFullName} · ${sync.branch}`,
      href: DASHBOARD_ROUTES.repos,
      at: (sync.syncedAt ?? sync.updatedAt).toISOString(),
    });
  }

  if (installedAt) {
    activities.push({
      id: "github-app-installed",
      kind: "app_installed",
      title: "GitHub App installed",
      description: "Code Ferret can now review pull requests.",
      href: DASHBOARD_ROUTES.github,
      at: installedAt,
    });
  }

  activities.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return activities.slice(0, limit);
}
