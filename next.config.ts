import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  /**
   * Dev only: allow HMR / `/_next/*` when opening the site by LAN IP (not just localhost).
   * Next.js 16 blocks cross-origin dev assets by default.
   * Add your machine’s current Network URL host(s); APIPA (169.254.x.x) may change if DHCP fixes.
   */
  allowedDevOrigins: ["169.254.83.107"],
};

export default nextConfig;
