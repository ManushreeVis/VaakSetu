import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Allow the sandbox preview proxy to fetch dev assets without a CORS warning.
  allowedDevOrigins: ["*.space-z.ai"],
};

export default nextConfig;
