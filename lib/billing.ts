"use server";

import { redirect } from "next/navigation";

import { getServerSession } from "@/features/auth/actions";
import { createCheckoutUrl, createPortalUrl } from "@/features/billing/server/subscription";

export type BillingActionResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

const SETTINGS_PATH = "/dashboard/settings";

export async function startProSubscription(): Promise<BillingActionResult> {
  const session = await requireSession();

  try {
    const url = await createCheckoutUrl({
      id: session.user.id,
      name: session.user.name,
    });

    return { ok: true, url };
  } catch (error) {
    console.error("[billing] Could not start a Polar checkout:", error);
    return { ok: false, error: toMessage(error) };
  }
}

export async function openBillingPortal(): Promise<BillingActionResult> {
  const session = await requireSession();

  try {
    const url = await createPortalUrl(session.user.id);

    return { ok: true, url };
  } catch (error) {
    console.error("[billing] Could not open the Polar customer portal:", error);
    return { ok: false, error: toMessage(error) };
  }
}

function toMessage(error: unknown): string {
  if (error instanceof Error && error.message.includes("is not configured")) {
    return "Billing is not set up yet. Add the Polar credentials and try again.";
  }

  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}

async function requireSession() {
  const session = await getServerSession();

  if (!session) {
    redirect("/sign-in?callbackUrl=" + SETTINGS_PATH);
  }

  return session;
}
