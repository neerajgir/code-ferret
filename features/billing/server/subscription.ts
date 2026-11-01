import type { UserSubscription } from "@/features/dashboard/lib/types";
import { prisma } from "@/lib/db";
import { getAppUrl, getPolar, getProProductId } from "@/features/billing/lib/polar";

/**
 * Resolves the billing state shown in the app from the columns the Polar
 * webhook keeps up to date. Nothing here calls Polar — reads stay fast and
 * survive a Polar outage.
 */
export async function getUserSubscription(
  userId: string
): Promise<UserSubscription> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      plan: true,
      subscriptionStatus: true,
      subscriptionRenewsAt: true,
    },
  });

  if (!user) {
    return {
      plan: "free",
      status: "active",
      renewsAt: null,
      cancelAtPeriodEnd: false,
    };
  }

  const renewsAt = user.subscriptionRenewsAt?.toISOString() ?? null;

  if (user.plan !== "pro") {
    return {
      plan: "free",
      status: "active",
      renewsAt,
      cancelAtPeriodEnd: false,
    };
  }

  if (user.subscriptionStatus === "trialing") {
    return { plan: "pro", status: "trialing", renewsAt, cancelAtPeriodEnd: false };
  }

  // Polar retries failed payments before revoking access; keep Pro meanwhile.
  if (user.subscriptionStatus === "past_due") {
    return { plan: "pro", status: "active", renewsAt, cancelAtPeriodEnd: false };
  }

  if (user.subscriptionStatus === "canceled") {
    const stillActive =
      user.subscriptionRenewsAt !== null && user.subscriptionRenewsAt > new Date();

    if (stillActive) {
      return {
        plan: "pro",
        status: "canceled",
        renewsAt,
        cancelAtPeriodEnd: true,
      };
    }

    return {
      plan: "free",
      status: "canceled",
      renewsAt,
      cancelAtPeriodEnd: false,
    };
  }

  if (user.subscriptionStatus === "active") {
    return { plan: "pro", status: "active", renewsAt, cancelAtPeriodEnd: false };
  }

  return { plan: "free", status: "canceled", renewsAt, cancelAtPeriodEnd: false };
}

/**
 * Creates a hosted Polar checkout for the Pro product and returns its URL.
 *
 * The user is identified to Polar by our own user id (`external_customer_id`),
 * so webhooks can map a subscription back to a row without a lookup table and
 * the customer portal works before we have stored a Polar customer id.
 */
export async function createCheckoutUrl(user: {
  id: string;
  name: string;
}): Promise<string> {
  const subscription = await getUserSubscription(user.id);

  if (subscription.plan === "pro") {
    throw new Error("You already have an active Pro subscription.");
  }

  const appUrl = getAppUrl();

  // No `customer_email`: Polar rejects GitHub's noreply addresses
  // (users.noreply.github.com) as invalid, and the customer record created
  // from external_customer_id already carries the real billing email — the
  // customer edits it on the hosted checkout page.
  const checkout = await getPolar().checkouts.create({
    products: [getProProductId()],
    external_customer_id: user.id,
    customer_name: user.name || null,
    metadata: { userId: user.id },
    success_url: `${appUrl}/dashboard/settings?checkout=success`,
    return_url: `${appUrl}/dashboard/settings`,
  });

  return checkout.url;
}

/** Opens Polar's customer portal — plan changes, invoices and cancellation. */
export async function createPortalUrl(userId: string): Promise<string> {
  const session = await getPolar().customerSessions.create({
    external_customer_id: userId,
    return_url: `${getAppUrl()}/dashboard/settings`,
  });

  return session.customer_portal_url;
}

export type ProPlanPrice = {
  /** Price in the smallest currency unit (e.g. cents). */
  amount: number;
  currency: string;
  interval: string | null;
  intervalCount: number | null;
};

let priceCache: { value: ProPlanPrice | null; expiresAt: number } | null = null;

/**
 * Reads the live Pro price from Polar so the marketing page never drifts from
 * what the checkout actually charges. Returns null when billing is not
 * configured or Polar is unreachable — callers then omit the number.
 */
export async function getProPlanPrice(): Promise<ProPlanPrice | null> {
  const cached = priceCache;

  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const value = await fetchProPlanPrice();

  // Ten minutes is short enough to pick up a price change, long enough that
  // the landing page never waits on Polar per request.
  priceCache = { value, expiresAt: Date.now() + 10 * 60 * 1000 };

  return value;
}

async function fetchProPlanPrice(): Promise<ProPlanPrice | null> {
  if (!process.env.POLAR_ACCESS_TOKEN || !process.env.POLAR_PRO_PRODUCT_ID) {
    return null;
  }

  try {
    const product = await getPolar().products.get(getProProductId());
    const price = product.prices.find((item) => item.amount_type === "fixed");

    if (!price || price.amount_type !== "fixed") {
      return null;
    }

    return {
      amount: price.price_amount,
      currency: price.price_currency,
      interval: product.recurring_interval,
      intervalCount: product.recurring_interval_count,
    };
  } catch (error) {
    console.error("[billing] Could not load the Pro price from Polar:", error);
    return null;
  }
}
