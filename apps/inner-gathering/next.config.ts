import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@elkdonis/db", "@elkdonis/email", "@elkdonis/types", "@elkdonis/ui"],

  // Production: Enable standalone output for Docker
  output: process.env.NODE_ENV === 'production' ? 'standalone' : undefined,

  images: {
    // Allow the Nextcloud media proxy route (query-string URLs)
    localPatterns: [
      // Nextcloud media proxy (query-string URLs)
      {
        pathname: '/api/media/file',
        search: '**',
      },
      // All public-folder static assets
      {
        pathname: '/**',
      },
    ],
    // Also allow absolute Nextcloud URLs if ever used directly
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '8080',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.elkdonis-arts.org',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
