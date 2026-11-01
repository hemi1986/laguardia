import type { NextConfig } from "next";

/**
 * Security headers (ST-003). The Content Security Policy is not here: it carries a nonce per request and is set by
 * `src/proxy.ts` (ST-070) – a second one here would be combined with it by the browser.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "geolocation=(), microphone=(), payment=(), usb=()" },
];

const nextConfig: NextConfig = {
  // The local browser tests run their own `next dev` beside the developer's (ST-083): Next.js allows one dev server
  // per distDir. Unset everywhere else – Vercel builds and `npm run dev` use `.next`.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // On that dev server Next.js' indicator would cover what sits in the bottom-left corner of a 360 px page – a test's
  // click then never arrives (ST-041). Errors are still shown.
  ...(process.env.NEXT_DIST_DIR ? { devIndicators: false as const } : {}),
  // ST-105 spike (throw-away): pdfjs and the native canvas stay outside the bundle; the worker, fonts and cmaps are traced.
  serverExternalPackages: ["pdfjs-dist", "@napi-rs/canvas"],
  outputFileTracingIncludes: {
    "/api/st-105-measure": [
      "./node_modules/pdfjs-dist/legacy/build/**",
      "./node_modules/pdfjs-dist/standard_fonts/**",
      "./node_modules/pdfjs-dist/cmaps/**",
      "./node_modules/pdfjs-dist/wasm/**",
      "./node_modules/pdfjs-dist/iccs/**",
    ],
  },
  experimental: {
    // Photos arrive downscaled (≤ 1 MB, ST-002; ≤ 600 KB each of a work log entry's 5, ST-032); the server check allows
    // 2 MB per photo – leave room for multipart overhead, below Vercel's 4.5 MB request body.
    serverActions: { bodySizeLimit: "4mb" },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
