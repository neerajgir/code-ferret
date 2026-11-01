"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { statusButtonClass } from "@/features/dashboard/lib/status-style";
import { startProSubscription } from "@/lib/billing";
import { cn } from "@/lib/utils";

type UpgradeButtonProps = {
  disabled?: boolean;
};

/**
 * Starts a Polar checkout from a server action, then hands the browser over to
 * the hosted checkout page. Polar returns the user to Settings when done.
 */
export function UpgradeButton({ disabled = false }: UpgradeButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleUpgrade() {
    setLoading(true);

    try {
      const result = await startProSubscription();

      if (!result.ok) {
        toast.error(result.error);
        setLoading(false);
        return;
      }

      // Leave `loading` set: the page is navigating away.
      window.location.assign(result.url);
    } catch (error) {
      console.error("[billing] Checkout request failed:", error);
      toast.error("Could not open checkout. Please try again.");
      setLoading(false);
    }
  }

  return (
    <Button
      onClick={handleUpgrade}
      disabled={disabled || loading}
      className={cn(statusButtonClass.success)}
    >
      {loading ? "Opening checkout…" : "Upgrade to Pro"}
    </Button>
  );
}
