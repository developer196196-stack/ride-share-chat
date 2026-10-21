import type { NextConfig } from "next";

const allowedDevOrigins = ["127.0.0.1"];

for (const domain of [
  process.env.REPLIT_DEV_DOMAIN,
  process.env.REPLIT_EXPO_DEV_DOMAIN,
]) {
  if (domain) {
    allowedDevOrigins.push(domain);
  }
}

// Local api-nest runs on 5001 (see artifacts/api-nest/env.template); Replit serves it on 8080.
const apiPort = process.env.API_PORT || (process.env.REPLIT_DEV_DOMAIN ? "8080" : "5001");

const nextConfig: NextConfig = {
  basePath: "/admin",
  allowedDevOrigins,
  env: {
    NEXT_PUBLIC_ADMIN_BASE_PATH: "/admin",
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `http://localhost:${apiPort}/api/:path*`, // Proxy to NestJS (api-nest)
      },
    ];
  },
};

export default nextConfig;
