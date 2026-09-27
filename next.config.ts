import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Photos arrive downscaled (≤ 1 MB, ST-002); the server check allows 2 MB – leave room for multipart overhead.
    serverActions: { bodySizeLimit: "3mb" },
  },
};

export default nextConfig;
