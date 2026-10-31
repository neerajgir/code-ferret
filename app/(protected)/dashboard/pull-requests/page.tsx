import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { DashboardHeader } from "@/features/dashboard/components/dashboard-header";
import { DASHBOARD_ROUTES } from "@/features/dashboard/lib/routes";
import { requiredAuth } from "@/features/auth/actions";
import { getInstallationStatus } from "@/features/github/server/installation";
import { getPullRequests } from "@/features/pull-requests/server/get-pull-requests";
import { PullRequestsList } from "@/features/pull-requests/components/pull-requests-list";

export const metadata: Metadata = {
  title: "Pull Requests · Dashboard",
};

function PullRequestsNotConnected() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
      <p className="text-sm text-muted-foreground">
        Install the GitHub App first to see your pull request review history.
      </p>
      <Button nativeButton={false} render={<Link href={DASHBOARD_ROUTES.github} />}>
        Go to GitHub App
      </Button>
    </div>
  );
}

/**
 * Pull request review history page.
 *
 * Server component: authenticates, guards on GitHub App installation, and
 * fetches the review history before handing the serializable list to the
 * interactive client table.
 */
export default async function DashboardPullRequestsPage() {
  const session = await requiredAuth();
  const installation = await getInstallationStatus(session.user.id);

  const header = (
    <DashboardHeader
      title="Pull Requests"
      description="AI review history for pull requests in your connected repositories."
    />
  );

  if (!installation.connected) {
    return (
      <>
        {header}
        <PullRequestsNotConnected />
      </>
    );
  }

  const pullRequests = await getPullRequests(session.user.id);

  return (
    <>
      {header}
      <PullRequestsList pullRequests={pullRequests} />
    </>
  );
}
