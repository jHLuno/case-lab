import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()",
  },
];

const checkInSecurityHeaders = securityHeaders.map((header) =>
  header.key === "Permissions-Policy"
    ? { ...header, value: "accelerometer=(), camera=(self), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()" }
    : header,
);

const nextConfig: NextConfig = {
  trailingSlash: true,
  images: {
    qualities: [100, 75],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        source: "/crm/check-in/:path*",
        headers: checkInSecurityHeaders,
      },
    ];
  },
};

export default nextConfig;
