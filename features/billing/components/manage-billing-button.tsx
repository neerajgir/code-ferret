"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { openBillingPortal } from "@/lib/billing";

type ManageBillingButtonProps = {
  disabled?: boolean;
};

/**
 * Opens Polar's customer portal, where the user updates their payment method,
 * downloads invoices, or cancels. Cancellation is not duplicated in the app —
 * one place to change billing means one place to look when something is wrong.
 */
export function ManageBillingButton({ disabled = false }: ManageBillingButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleOpenPortal() {
    setLoading(true);

    try {
      const result = await openBillingPortal();

      if (!result.ok) {
        toast.error(result.error);
        setLoading(false);
        return;
      }

      // Leave `loading` set: the page is navigating away.
      window.location.assign(result.url);
    } catch (error) {
      console.error("[billing] Portal request failed:", error);
      toast.error("Could not open the billing portal. Please try again.");
      setLoading(false);
    }
  }

  return (
    <Button
      variant="outline"
      onClick={handleOpenPortal}
      disabled={disabled || loading}
    >
      {loading ? "Opening portal…" : "Manage billing"}
    </Button>
  );
}
