import { createPolar, type Environment } from "@polar-sh/sdk/2026-10";

/** Polar runs two independent environments; sandbox keeps test checkouts separate. */
export type PolarEnvironment = Environment;

export function getPolarEnvironment(): PolarEnvironment {
  return process.env.POLAR_SERVER === "sandbox" ? "sandbox" : "production";
}

let polarClient: ReturnType<typeof createPolar> | null = null;

/**
 * Lazily builds the Polar API client. Throws a readable error when the
 * access token is missing so billing failures are obvious in logs.
 */
export function getPolar() {
  const accessToken = process.env.POLAR_ACCESS_TOKEN;

  if (!accessToken) {
    throw new Error("POLAR_ACCESS_TOKEN is not configured.");
  }

  if (!polarClient) {
    polarClient = createPolar({
      accessToken,
      environment: getPolarEnvironment(),
    });
  }

  return polarClient;
}

/** The Polar product that grants the Pro plan. */
export function getProProductId(): string {
  const productId = process.env.POLAR_PRO_PRODUCT_ID;

  if (!productId) {
    throw new Error("POLAR_PRO_PRODUCT_ID is not configured.");
  }

  return productId;
}

/** Absolute app URL — Polar requires absolute success and return URLs. */
export function getAppUrl(): string {
  const url =
    process.env.BETTER_AUTH_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000";

  return url.replace(/\/$/, "");
}
