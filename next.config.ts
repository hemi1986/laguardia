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
  // On that dev server Next.js' indicator would cover what sits in the bottom-left corner of a 360 px page – a test's
  // click then never arrives (ST-041). Errors are still shown.
  ...(process.env.NEXT_DIST_DIR ? { devIndicators: false as const } : {}),
  experimental: {
    // Photos arrive downscaled (≤ 1 MB, ST-002); the server check allows 2 MB – leave room for multipart overhead.
    serverActions: { bodySizeLimit: "3mb" },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
