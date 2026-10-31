import type { statusBadgeClass } from "@/features/dashboard/lib/status-style";

/**
 * Every status a pull request row can hold.
 * Mirrors the `pull_request.status` column (see `prisma/schema.prisma`).
 */
export const PULL_REQUEST_STATUSES = [
  "pending",
  "processing",
  "reviewed",
  "rate_limited",
] as const;

export type PullRequestStatus = (typeof PULL_REQUEST_STATUSES)[number];

/**
 * Narrow an arbitrary string (e.g. the untyped `status` column coming back
 * from Postgres) to a known status. Unknown values are handled gracefully
 * by the callers instead of leaking `string` into the UI layer.
 */
export function isPullRequestStatus(value: string): value is PullRequestStatus {
  return (PULL_REQUEST_STATUSES as readonly string[]).includes(value);
}

/** Human-readable label for each review status. */
export const PULL_REQUEST_STATUS_LABEL: Record<PullRequestStatus, string> = {
  pending: "Pending",
  processing: "Reviewing",
  reviewed: "Reviewed",
  rate_limited: "Rate limited",
};

/**
 * Map a review status onto the shared badge color palette.
 *
 * @param status - A known pull request status.
 * @returns A semantic tone from `statusBadgeClass`.
 */
export function pullRequestStatusTone(
  status: PullRequestStatus
): keyof typeof statusBadgeClass {
  // Exhaustive switch: adding a status without a tone becomes a type error.
  switch (status) {
    case "reviewed":
      return "success";
    case "processing":
      return "info";
    case "rate_limited":
      return "warning";
    case "pending":
      return "neutral";
  }
}
