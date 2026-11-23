import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build autonom (server.js + node_modules minime) — rulat pe cPanel prin „Setup Node.js App”.
  output: "standalone",
  poweredByHeader: false,
  // Fără sharp pe server: imaginile se servesc direct.
  images: { unoptimized: true },
  // mysql2 rămâne în node_modules (nu în bundle), ca să-l poată folosi și scripts/migrate.mjs pe server.
  serverExternalPackages: ["mysql2", "unpdf"],
};

export default nextConfig;
