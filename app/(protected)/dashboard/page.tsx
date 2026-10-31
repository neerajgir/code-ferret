import type { Metadata } from "next";
import Link from "next/link";
// The default phosphor entry uses React context and breaks in RSC —
// server components must use the SSR build.
import { PlugIcon } from "@phosphor-icons/react/ssr";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DashboardHeader } from "@/features/dashboard/components/dashboard-header";
import { DASHBOARD_ROUTES } from "@/features/dashboard/lib/routes";
import { requiredAuth } from "@/features/auth/actions";
import { getOverview } from "@/features/overview/server/get-overview";
import { ActivityFeed } from "@/features/overview/components/activity-feed";
import { OverviewStats } from "@/features/overview/components/overview-stats";
import { RepoSummaryCard } from "@/features/overview/components/repo-summary-card";

export const metadata: Metadata = {
  title: "Overview · Dashboard",
};

function OverviewNotConnected() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PlugIcon className="size-4" />
            Connect GitHub
          </CardTitle>
          <CardDescription>
            Install the Code Ferret GitHub App to see review stats, codebase
            sync progress, and recent activity on this overview.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            render={<Link href={DASHBOARD_ROUTES.github} />}
            nativeButton={false}
          >
            Go to GitHub App
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Dashboard overview, driven entirely by live data: GitHub App
 * installation status, repository + sync summary, review statistics,
 * and the merged activity timeline.
 */
export default async function DashboardOverviewPage() {
  const session = await requiredAuth();
  const overview = await getOverview(session.user.id);

  const header = (
    <DashboardHeader
      title="Overview"
      description="Live status of your GitHub App, reviews, and codebase syncs."
    />
  );

  if (!overview.repos) {
    return (
      <>
        {header}
        <OverviewNotConnected />
      </>
    );
  }

  const { repos, pullRequests, activity } = overview;

  return (
    <>
      {header}
      <div className="flex flex-1 flex-col gap-6 p-6">
        <OverviewStats repos={repos} pullRequests={pullRequests} />
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <ActivityFeed activities={activity} />
          <RepoSummaryCard summary={repos} />
        </div>
      </div>
    </>
  );
}
