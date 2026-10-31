"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";
import {
  CheckCircleIcon,
  ClockIcon,
  GitPullRequestIcon,
  MagnifyingGlassIcon,
  SpinnerIcon,
  WarningIcon,
} from "@phosphor-icons/react";

import { Input } from "@/components/ui/input";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DASHBOARD_ROUTES } from "@/features/dashboard/lib/routes";
import { statusBadge } from "@/features/dashboard/lib/status-style";
import type { PullRequestListItem } from "../server/get-pull-requests";
import {
  PULL_REQUEST_STATUS_LABEL,
  pullRequestStatusTone,
  type PullRequestStatus,
} from "../lib/status";

type Filter = "all" | PullRequestStatus;

type PullRequestsListProps = {
  /** Server-fetched pull request history for the current installation. */
  pullRequests: PullRequestListItem[];
};

const STATUS_FILTER_LABEL: Record<Filter, string> = {
  all: "All",
  pending: "Pending",
  processing: "Reviewing",
  reviewed: "Reviewed",
  rate_limited: "Rate limited",
};

function pullRequestStatusIcon(status: PullRequestStatus) {
  const iconClass = "size-3";

  switch (status) {
    case "reviewed":
      return <CheckCircleIcon className={iconClass} />;
    case "processing":
      return <SpinnerIcon className={`${iconClass} animate-spin`} />;
    case "rate_limited":
      return <WarningIcon className={iconClass} />;
    case "pending":
      return <ClockIcon className={iconClass} />;
  }
}

function relativeTime(value: string | null): string {
  if (!value) {
    return "—";
  }

  return formatDistanceToNow(new Date(value), { addSuffix: true });
}

/**
 * Interactive review history table: filter by review status, search by
 * title/repository/author, and jump into a pull request's detail page.
 */
export function PullRequestsList({ pullRequests }: PullRequestsListProps) {
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");

  if (pullRequests.length === 0) {
    return <PullRequestsEmpty />;
  }

  const counts: Record<Filter, number> = {
    all: pullRequests.length,
    pending: 0,
    processing: 0,
    reviewed: 0,
    rate_limited: 0,
  };

  for (const pullRequest of pullRequests) {
    counts[pullRequest.status] += 1;
  }

  const query = search.trim().toLowerCase();

  const visiblePullRequests = pullRequests.filter((pullRequest) => {
    if (filter !== "all" && pullRequest.status !== filter) {
      return false;
    }

    if (!query) {
      return true;
    }

    return (
      pullRequest.title.toLowerCase().includes(query) ||
      pullRequest.repoFullName.toLowerCase().includes(query) ||
      pullRequest.authorLogin?.toLowerCase().includes(query) ||
      String(pullRequest.prNumber).includes(query)
    );
  });

  let rows: React.ReactNode;

  if (visiblePullRequests.length === 0) {
    rows = (
      <TableRow>
        <TableCell colSpan={5} className="text-center text-muted-foreground">
          No pull requests match your filters.
        </TableCell>
      </TableRow>
    );
  } else {
    rows = visiblePullRequests.map((pullRequest) => (
      <PullRequestRow key={pullRequest.id} pullRequest={pullRequest} />
    ));
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          value={filter}
          onValueChange={(value) => setFilter(value as Filter)}
        >
          <TabsList>
            {(Object.keys(STATUS_FILTER_LABEL) as Filter[]).map((key) => (
              <TabsTrigger key={key} value={key}>
                {STATUS_FILTER_LABEL[key]} ({counts[key]})
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="relative sm:max-w-xs sm:w-full">
          <MagnifyingGlassIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search pull requests…"
            className="pl-8"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </div>

      <div className="rounded-none border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pull request</TableHead>
              <TableHead>Author</TableHead>
              <TableHead>Base</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>{rows}</TableBody>
        </Table>
      </div>

      <p className="py-1 text-center text-sm text-muted-foreground">
        Showing {visiblePullRequests.length} of {pullRequests.length} pull
        requests
      </p>
    </div>
  );
}

function PullRequestRow({ pullRequest }: { pullRequest: PullRequestListItem }) {
  const detailHref = `${DASHBOARD_ROUTES.pullRequest}/${pullRequest.id}`;

  return (
    <TableRow>
      <TableCell>
        <div className="flex flex-col">
          <Link
            href={detailHref}
            className="truncate font-medium hover:underline"
          >
            {pullRequest.title}
          </Link>
          <span className="truncate text-xs text-muted-foreground">
            {pullRequest.repoFullName} · #{pullRequest.prNumber}
          </span>
        </div>
      </TableCell>
      <TableCell className="text-muted-foreground">
        {pullRequest.authorLogin ?? "—"}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {pullRequest.baseBranch}
      </TableCell>
      <TableCell>
        <span
          className={statusBadge(pullRequestStatusTone(pullRequest.status), "gap-1")}
        >
          {pullRequestStatusIcon(pullRequest.status)}
          {PULL_REQUEST_STATUS_LABEL[pullRequest.status]}
        </span>
      </TableCell>
      <TableCell className="text-right whitespace-nowrap text-muted-foreground">
        {relativeTime(pullRequest.reviewedAt ?? pullRequest.createdAt)}
      </TableCell>
    </TableRow>
  );
}

function PullRequestsEmpty() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
      <Empty className="max-w-md border-border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <GitPullRequestIcon />
          </EmptyMedia>
          <EmptyTitle>No pull requests yet</EmptyTitle>
          <EmptyDescription>
            Open a pull request in a connected repository — Code Ferret will
            review it and list the result here.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    </div>
  );
}
