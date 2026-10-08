import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Support the loopback address used by local browser checks and preview links.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
