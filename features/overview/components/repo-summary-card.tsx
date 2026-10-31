import { formatDistanceToNow } from "date-fns";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { statusBadge } from "@/features/dashboard/lib/status-style";
import type { RepoSummary } from "@/features/overview/server/repo-summary";

type RepoSummaryCardProps = {
  summary: RepoSummary;
};

/**
 * Codebase overview for the dashboard: how much of the installation's
 * code is indexed into Pinecone, which languages dominate, and when the
 * last successful sync ran.
 */
export function RepoSummaryCard({ summary }: RepoSummaryCardProps) {
  const indexProgress =
    summary.totalRepos > 0
      ? Math.round((summary.syncedRepos / summary.totalRepos) * 100)
      : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Codebase index</CardTitle>
        <CardDescription>
          Sync progress across repositories visible to the GitHub App.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Indexed repositories</span>
            <span className="font-medium">
              {summary.syncedRepos} / {summary.totalRepos} ({indexProgress}%)
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-none bg-muted">
            <div
              className="h-full bg-green-500 transition-all"
              style={{ width: `${indexProgress}%` }}
            />
          </div>
          {summary.syncingRepos > 0 || summary.failedRepos > 0 ? (
            <p className="text-xs text-muted-foreground">
              {summary.syncingRepos} syncing · {summary.failedRepos} failed
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-xs text-muted-foreground">
            Top languages
          </span>
          {summary.languages.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No repository data yet.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {summary.languages.map((language) => (
                <li
                  key={language.name}
                  className="flex items-center justify-between text-xs"
                >
                  <span>{language.name}</span>
                  <span className="text-muted-foreground">
                    {language.count}{" "}
                    {language.count === 1 ? "repo" : "repos"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border pt-3 text-xs">
          <span className="text-muted-foreground">Last successful sync</span>
          {summary.lastSyncedAt ? (
            <span className={statusBadge("success")}>
              {formatDistanceToNow(new Date(summary.lastSyncedAt), {
                addSuffix: true,
              })}
            </span>
          ) : (
            <span className={statusBadge("neutral")}>Never</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
