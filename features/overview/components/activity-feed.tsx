import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
// The default phosphor entry uses React context and breaks in RSC —
// server components must use the SSR build.
import {
  ArrowClockwiseIcon,
  CheckCircleIcon,
  ClockIcon,
  GithubLogoIcon,
  SpinnerIcon,
  WarningIcon,
  WarningOctagonIcon,
} from "@phosphor-icons/react/ssr";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import type {
  OverviewActivity,
  OverviewActivityKind,
} from "@/features/overview/server/activity";

type ActivityFeedProps = {
  /** Server-fetched activity timeline, most recent first. */
  activities: OverviewActivity[];
};

const ACTIVITY_ICON: Record<OverviewActivityKind, React.ReactNode> = {
  app_installed: <GithubLogoIcon />,
  repo_synced: <ArrowClockwiseIcon />,
  repo_sync_failed: <WarningOctagonIcon />,
  review_completed: <CheckCircleIcon />,
  review_processing: <SpinnerIcon className="animate-spin" />,
  review_queued: <ClockIcon />,
  review_rate_limited: <WarningIcon />,
};

/**
 * "Recent activity" timeline merging review updates, codebase syncs, and
 * the app installation into one live feed.
 */
export function ActivityFeed({ activities }: ActivityFeedProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent activity</CardTitle>
        <CardDescription>
          Reviews and codebase syncs across your workspace.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <Empty className="border-border py-8">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ClockIcon />
              </EmptyMedia>
              <EmptyTitle>No activity yet</EmptyTitle>
              <EmptyDescription>
                Open a pull request or sync a codebase and updates will show
                up here.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {activities.map((activity) => (
              <ActivityRow key={activity.id} activity={activity} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function ActivityRow({ activity }: { activity: OverviewActivity }) {
  const icon = ACTIVITY_ICON[activity.kind];

  const body = (
    <>
      <span className="flex size-7 shrink-0 items-center justify-center rounded-none border border-border bg-muted text-muted-foreground [&_svg]:size-3.5">
        {icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span
          className={
            activity.href
              ? "truncate text-xs font-medium group-hover:underline"
              : "truncate text-xs font-medium"
          }
        >
          {activity.title}
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {activity.description}
        </span>
      </span>
      <span className="shrink-0 text-xs whitespace-nowrap text-muted-foreground">
        {formatDistanceToNow(new Date(activity.at), { addSuffix: true })}
      </span>
    </>
  );

  return (
    <li>
      {activity.href ? (
        <Link
          href={activity.href}
          className="group flex w-full items-start gap-3 py-3"
        >
          {body}
        </Link>
      ) : (
        <div className="flex w-full items-start gap-3 py-3">{body}</div>
      )}
    </li>
  );
}
