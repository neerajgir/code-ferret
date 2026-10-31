import { formatDistanceToNow } from "date-fns";
// The default phosphor entry uses React context and breaks in RSC —
// server components must use the SSR build.
import {
  ArrowClockwiseIcon,
  GitBranchIcon,
  CheckCircleIcon,
  ClockIcon,
} from "@phosphor-icons/react/ssr";

import { Card, CardContent } from "@/components/ui/card";
import type {
  OverviewPullRequestStats,
} from "@/features/overview/server/get-overview";
import type { RepoSummary } from "@/features/overview/server/repo-summary";

type OverviewStatsProps = {
  repos: RepoSummary;
  pullRequests: OverviewPullRequestStats;
};

type StatTileProps = {
  label: string;
  value: number;
  hint: string;
  icon: React.ReactNode;
};

function StatTile({ label, value, hint, icon }: StatTileProps) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-xs text-muted-foreground">{label}</span>
          <span className="text-2xl leading-none font-medium">{value}</span>
          <span className="truncate text-xs text-muted-foreground">{hint}</span>
        </div>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-none border border-border bg-muted text-muted-foreground [&_svg]:size-4">
          {icon}
        </span>
      </CardContent>
    </Card>
  );
}

/**
 * The four headline numbers of the dashboard: repositories visible to the
 * app, indexed codebases, completed reviews, and reviews still in flight.
 */
export function OverviewStats({ repos, pullRequests }: OverviewStatsProps) {
  const awaitingReview =
    pullRequests.pending + pullRequests.processing + pullRequests.rateLimited;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatTile
        label="Repositories"
        value={repos.totalRepos}
        hint={`${repos.publicRepos} public · ${repos.privateRepos} private`}
        icon={<GitBranchIcon />}
      />
      <StatTile
        label="Codebase synced"
        value={repos.syncedRepos}
        hint={
          repos.lastSyncedAt
            ? `Last sync ${formatDistanceToNow(new Date(repos.lastSyncedAt), {
                addSuffix: true,
              })}`
            : "No sync completed yet"
        }
        icon={<ArrowClockwiseIcon />}
      />
      <StatTile
        label="Reviews completed"
        value={pullRequests.reviewed}
        hint={
          pullRequests.total > 0
            ? `Out of ${pullRequests.total} pull requests`
            : "No pull requests yet"
        }
        icon={<CheckCircleIcon />}
      />
      <StatTile
        label="Awaiting review"
        value={awaitingReview}
        hint={`${pullRequests.processing} reviewing · ${pullRequests.pending} queued`}
        icon={<ClockIcon />}
      />
    </div>
  );
}
