import type { NextConfig } from "next";

// React's dev-mode tooling (Fast Refresh, cross-environment stack traces)
// requires eval() — it's never used in production builds, so unsafe-eval
// is only needed here, not on the deployed site.
const scriptSrc = process.env.NODE_ENV === "production" ? "'self' 'unsafe-inline'" : "'self' 'unsafe-inline' 'unsafe-eval'";

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: `default-src 'self'; script-src ${scriptSrc}; style-src 'self' 'unsafe-inline'; font-src 'self' fonts.gstatic.com; img-src 'self' data: blob:; media-src 'self'; connect-src 'self' https://*.supabase.co;`,
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()",
  },
];

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
