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
  // The local browser tests run their own `next dev` beside the developer's (ST-083): Next.js allows one dev server
  // per distDir. Unset everywhere else – Vercel builds and `npm run dev` use `.next`.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  experimental: {
    // Photos arrive downscaled (≤ 1 MB, ST-002); the server check allows 2 MB – leave room for multipart overhead.
    serverActions: { bodySizeLimit: "3mb" },
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // The QR address (ST-010, ST-011): always current, and never a team member's page for a visitor or vice versa –
      // so never stored by a shared cache.
      { source: "/m/:path*", headers: [{ key: "Cache-Control", value: "private, no-store" }] },
    ];
  },
};

export default nextConfig;
