import { prisma } from "@/lib/db";
import { getUserInstallationId } from "@/features/github/server/installation";
import type { PullRequest as PullRequestRow } from "@/lib/generated/prisma/client";
import {
  isPullRequestStatus,
  type PullRequestStatus,
} from "@/features/pull-requests/lib/status";

/**
 * A pull request row as shown in the review history table.
 * Dates are ISO strings so the shape stays serializable across
 * the server → client component boundary.
 */
export type PullRequestListItem = {
  id: string;
  repoFullName: string;
  prNumber: number;
  title: string;
  authorLogin: string | null;
  baseBranch: string;
  status: PullRequestStatus;
  createdAt: string | null;
  reviewedAt: string | null;
};

/** A single pull request with everything the detail page needs. */
export type PullRequestDetail = PullRequestListItem & {
  headSha: string;
  /** AI-generated markdown review, present once the review finished. */
  reviewComment: string | null;
  updatedAt: string;
};

/**
 * The `status` column is a plain string in the database, so guard against
 * unexpected values instead of casting. Anything unknown is treated as
 * still awaiting review rather than crashing the UI.
 */
function normalizeStatus(status: string): PullRequestStatus {
  return isPullRequestStatus(status) ? status : "pending";
}

function toListItem(row: PullRequestRow): PullRequestListItem {
  return {
    id: row.id,
    repoFullName: row.repoFullName,
    prNumber: row.prNumber,
    title: row.title,
    authorLogin: row.authorLogin,
    baseBranch: row.baseBranch,
    status: normalizeStatus(row.status),
    createdAt: row.createdAt?.toISOString() ?? null,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
  };
}

function toDetail(row: PullRequestRow): PullRequestDetail {
  return {
    ...toListItem(row),
    headSha: row.headSha,
    reviewComment: row.reviewComment,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Fetch every pull request belonging to the user's GitHub App installation,
 * newest first.
 *
 * @param userId - The authenticated user id (session user).
 * @returns The user's pull request history, or an empty list when the
 *          GitHub App is not connected yet.
 */
export async function getPullRequests(
  userId: string
): Promise<PullRequestListItem[]> {
  const installationId = await getUserInstallationId(userId);

  if (!installationId) {
    return [];
  }

  const rows = await prisma.pullRequest.findMany({
    where: { installationId },
    orderBy: { createdAt: "desc" },
  });

  return rows.map(toListItem);
}

/**
 * Fetch a single pull request by its database id, scoped to the user's
 * installation so one customer can never read another's review data.
 *
 * @param userId - The authenticated user id (session user).
 * @param pullRequestId - The `pull_request.id` cuid.
 * @returns The pull request, or `null` when it does not exist or belongs
 *          to a different installation.
 */
export async function getPullRequestById(
  userId: string,
  pullRequestId: string
): Promise<PullRequestDetail | null> {
  const installationId = await getUserInstallationId(userId);

  if (!installationId) {
    return null;
  }

  const row = await prisma.pullRequest.findFirst({
    where: { id: pullRequestId, installationId },
  });

  if (!row) {
    return null;
  }

  return toDetail(row);
}
