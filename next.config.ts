import type { NextConfig } from "next";

/**
 * Security headers (ST-003). A full Content Security Policy for scripts needs per-request nonces and follows
 * separately; until then the policy only forbids framing.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "Permissions-Policy", value: "geolocation=(), microphone=(), payment=(), usb=()" },
];

const nextConfig: NextConfig = {
  experimental: {
    // Photos arrive downscaled (≤ 1 MB, ST-002); the server check allows 2 MB – leave room for multipart overhead.
    serverActions: { bodySizeLimit: "3mb" },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
