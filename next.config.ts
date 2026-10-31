import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Hostname only (no protocol/trailing slash) so Next matches the ngrok
  // tunnel origin and allows HMR/dev assets through it.
  allowedDevOrigins: ['vastly-rift-shading.ngrok-free.dev']
};

export default nextConfig;
