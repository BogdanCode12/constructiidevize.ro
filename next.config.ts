import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build autonom (server.js + node_modules minime) — rulat pe cPanel prin „Setup Node.js App”.
  output: "standalone",
  poweredByHeader: false,
  // Fără sharp pe server: imaginile se servesc direct.
  images: { unoptimized: true },
  // mysql2 rămâne în node_modules (nu în bundle), ca să-l poată folosi și scripts/migrate.mjs pe server.
  serverExternalPackages: ["mysql2", "unpdf"],
  // Pagina „Prețuri” a devenit „Abonamente”; linkurile vechi duc la pagina nouă.
  async redirects() {
    return [{ source: "/preturi", destination: "/abonamente", permanent: true }];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // camera e permisă pentru pozele din jurnalul de șantier
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
          ...(process.env.NODE_ENV === "production"
            ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
            : []),
        ],
      },
    ];
  },
};

export default nextConfig;
