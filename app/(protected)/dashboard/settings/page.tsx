import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { requiredAuth } from "@/features/auth/actions";
import { ManageBillingButton } from "@/features/billing/components/manage-billing-button";
import { UpgradeButton } from "@/features/billing/components/upgrade-button";
import { DashboardHeader } from "@/features/dashboard/components/dashboard-header";
import { statusBadgeClass } from "@/features/dashboard/lib/status-style";
import { PLAN_DETAILS } from "@/features/settings/lib/plan-details";
import { getUserSettings } from "@/features/settings/server/get-settings";

export const metadata: Metadata = {
  title: "Settings · Dashboard",
};

const STATUS_LABEL = {
  active: "Active",
  trialing: "Trial",
  canceled: "Canceled",
  past_due: "Past Due",
} as const;

const STATUS_TONE = {
  active: statusBadgeClass.success,
  trialing: statusBadgeClass.info,
  canceled: statusBadgeClass.warning,
  past_due: statusBadgeClass.warning,
} as const;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function BillingSummary({
  plan,
  status,
  renewsAt,
  cancelAtPeriodEnd,
}: {
  plan: "free" | "pro";
  status: "active" | "trialing" | "canceled" | "past_due";
  renewsAt: string | null;
  cancelAtPeriodEnd: boolean;
}) {
  if (plan === "pro" && status === "trialing") {
    return <>Trial ends {renewsAt ? formatDate(renewsAt) : "soon"}.</>;
  }

  if (plan === "pro" && cancelAtPeriodEnd) {
    return (
      <>
        Canceled — Pro access ends {renewsAt ? formatDate(renewsAt) : "at the end of the paid period"}.
      </>
    );
  }

  if (plan === "pro" && status === "past_due") {
    return (
      <>
        Past Due — Pro access continues while payment is retried.{renewsAt ? ` Renews on ${formatDate(renewsAt)}.` : ""}
      </>
    );
  }

  if (plan === "pro" && renewsAt) {
    return <>Renews on {formatDate(renewsAt)}.</>;
  }

  if (plan === "pro") {
    return <>Active — no renewal date on file.</>;
  }

  if (status === "canceled") {
    return <>Your Pro access has ended. Reviews are back to the monthly cap.</>;
  }

  return <>No renewal — the Free plan does not expire.</>;
}

function UsageMeter({ used, limit }: { used: number; limit: number | null }) {
  if (limit === null) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm">Unlimited reviews this month.</p>
        <p className="text-xs text-muted-foreground">
          {used} {used === 1 ? "review" : "reviews"} run so far.
        </p>
      </div>
    );
  }

  const percent = Math.min(100, Math.round((used / limit) * 100));

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm">
        {used} of {limit} reviews used this month.
      </p>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={used}
        aria-label="Monthly review usage"
      >
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {used >= limit
          ? "Cap reached. Upgrade to keep reviews running this month."
          : `${limit - used} left before the cap.`}
      </p>
    </div>
  );
}

type SettingsPageProps = {
  searchParams: Promise<{ checkout?: string }>;
};

/**
 * Account settings. Billing reads the mirrored Polar state, so the page renders
 * without calling Polar; every change goes through the hosted checkout or
 * customer portal.
 */
export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const session = await requiredAuth();
  const [{ checkout }, settings] = await Promise.all([
    searchParams,
    getUserSettings(session.user.id),
  ]);

  const { profile, subscription, usage } = settings;
  const planDetails = PLAN_DETAILS[subscription.plan];
  const checkoutCompleted = checkout === "success";

  return (
    <>
      <DashboardHeader
        title="Settings"
        description="Your account, plan, and review usage."
      />

      <div className="flex flex-1 flex-col gap-6 p-6">
        {checkoutCompleted ? (
          <div
            role="status"
            className="rounded-lg border border-green-500/40 bg-green-500/10 px-4 py-3 text-sm text-green-800 dark:text-green-400"
          >
            Checkout complete. Polar confirms the payment in a moment, then this
            page shows the new plan — refresh if it still says Free.
          </div>
        ) : null}

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <Card>
            <CardHeader>
              <CardTitle>Plan and usage</CardTitle>
              <CardDescription>
                Billing runs through Polar. Cancel or change payment details in
                the customer portal.
              </CardDescription>
            </CardHeader>

            <CardContent className="flex flex-col gap-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{planDetails.label} plan</span>
                <Badge className={STATUS_TONE[subscription.status]}>
                  {STATUS_LABEL[subscription.status]}
                </Badge>
              </div>

              <p className="text-sm text-muted-foreground">
                <BillingSummary
                  plan={subscription.plan}
                  status={subscription.status}
                  renewsAt={subscription.renewsAt}
                  cancelAtPeriodEnd={subscription.cancelAtPeriodEnd}
                />
              </p>

              <Separator />

              <UsageMeter used={usage.used} limit={usage.limit} />

              <Separator />

              <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
                {planDetails.features.map((feature) => (
                  <li key={feature} className="flex gap-2">
                    <span aria-hidden="true" className="text-green-600 dark:text-green-400">
                      ✓
                    </span>
                    {feature}
                  </li>
                ))}
              </ul>
            </CardContent>

            <CardFooter className="justify-end gap-2">
              {subscription.plan === "pro" ? (
                <ManageBillingButton />
              ) : (
                <UpgradeButton />
              )}
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>Pulled from your GitHub account.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">Name</span>
                <span className="font-medium">{profile.name}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">Email</span>
                <span className="break-all">{profile.email}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">Member since</span>
                <span>{formatDate(profile.memberSince)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
