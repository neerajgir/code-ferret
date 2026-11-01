import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { Webhooks } from "@polar-sh/nextjs";
import type { models, webhooks } from "@polar-sh/sdk/2026-10";

import { prisma } from "@/lib/db";

type Subscription = models.Subscription;
type SubscriptionPayload = { data: Subscription };
type CustomerPayload = { data: models.Customer };

/**
 * Polar is the source of truth for billing. Every webhook only mirrors the
 * state we need for access checks into the user row — no pricing or invoice
 * data is duplicated here.
 */

/** Our user id, carried on the subscription as `external_customer_id`. */
function resolveUserId(subscription: Subscription): string | null {
  const externalId = subscription.customer?.external_id;

  if (externalId) {
    return externalId;
  }

  const metadataUserId = subscription.metadata?.userId;

  return typeof metadataUserId === "string" ? metadataUserId : null;
}

type PlanState = {
  plan: "free" | "pro";
  subscriptionStatus: "active" | "trialing" | "canceled" | "past_due";
  subscriptionRenewsAt: Date | null;
};

function periodEnd(subscription: Subscription): Date | null {
  if (!subscription.current_period_end) {
    return null;
  }

  const date = new Date(subscription.current_period_end);

  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Maps a Polar subscription status onto the two states the app cares about:
 * "can this user review without a limit" and "when does that stop".
 */
function toPlanState(subscription: Subscription): PlanState {
  const renewsAt = periodEnd(subscription);

  switch (subscription.status) {
    case "active":
    case "trialing":
      return { plan: "pro", subscriptionStatus: subscription.status, subscriptionRenewsAt: renewsAt };

    // Polar retries the payment; access continues while it does.
    case "past_due":
      return { plan: "pro", subscriptionStatus: "past_due", subscriptionRenewsAt: renewsAt };

    // Canceled at period end: Pro stays until the paid period runs out.
    case "canceled":
      return { plan: "pro", subscriptionStatus: "canceled", subscriptionRenewsAt: renewsAt };

    // incomplete, unpaid, paused, incomplete_expired
    default:
      return { plan: "free", subscriptionStatus: "canceled", subscriptionRenewsAt: null };
  }
}

async function applySubscriptionState(userId: string, subscription: Subscription) {
  const state = toPlanState(subscription);
  const customerId = subscription.customer?.id;

  const result = await prisma.user.updateMany({
    where: { id: userId },
    data: {
      ...state,
      polarSubscriptionId: subscription.id,
      // Never clear a known customer id because one payload omitted it.
      ...(customerId ? { polarCustomerId: customerId } : {}),
    },
  });

  if (result.count === 0) {
    console.warn(
      `[polar] Subscription ${subscription.id} points at unknown user ${userId}; nothing to update.`
    );
  }
}

async function syncSubscription(payload: SubscriptionPayload) {
  const subscription = payload.data;
  const userId = resolveUserId(subscription);

  if (!userId) {
    console.warn(`[polar] Subscription ${subscription.id} has no external customer id.`);
    return;
  }

  await applySubscriptionState(userId, subscription);
}

/** Revoked means the paid period is over: access ends now, not at renewal. */
async function revokeSubscription(payload: SubscriptionPayload) {
  const subscription = payload.data;
  const userId = resolveUserId(subscription);

  if (!userId) {
    return;
  }

  await prisma.user.updateMany({
    where: { id: userId },
    data: {
      plan: "free",
      subscriptionStatus: "canceled",
      subscriptionRenewsAt: null,
      polarSubscriptionId: null,
    },
  });
}

async function syncCustomer(payload: CustomerPayload) {
  const customer = payload.data;
  const userId = customer.external_id;

  if (!userId) {
    return;
  }

  await prisma.user.updateMany({
    where: { id: userId },
    data: { polarCustomerId: customer.id },
  });
}

export async function handlePolarWebhook(request: NextRequest) {
  const webhookSecret = process.env.POLAR_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("[polar] POLAR_WEBHOOK_SECRET is not configured; rejecting webhook.");
    return NextResponse.json(
      { error: "Polar webhook is not configured." },
      { status: 500 }
    );
  }

  const handler = Webhooks({
    webhookSecret,
    onSubscriptionCreated: syncSubscription,
    onSubscriptionActive: syncSubscription,
    onSubscriptionUpdated: syncSubscription,
    onSubscriptionUncanceled: syncSubscription,
    onSubscriptionCycled: syncSubscription,
    onSubscriptionCanceled: syncSubscription,
    onSubscriptionPastDue: syncSubscription,
    onSubscriptionPaused: revokeSubscription,
    onSubscriptionResumed: syncSubscription,
    onSubscriptionRevoked: revokeSubscription,
    onCustomerCreated: syncCustomer,
    onCustomerUpdated: syncCustomer,
  });

  try {
    return await handler(request);
  } catch (error) {
    console.error("[polar] Webhook handling failed:", error);
    return NextResponse.json(
      { error: "Webhook could not be processed." },
      { status: 500 }
    );
  }
}

/** Re-exported so the route file stays a one-liner. */
export type PolarWebhookPayload = webhooks.WebhookPayload;
