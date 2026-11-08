import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  // Keep auth/API traffic off the cache — always hit the network.
  extendDefaultRuntimeCaching: true,
  workboxOptions: {
    disableDevLogs: true,
    runtimeCaching: [
      {
        urlPattern: ({ url }: { url: URL }) =>
          url.pathname.startsWith("/api/") ||
          url.pathname.startsWith("/api/auth"),
        handler: "NetworkOnly",
      },
    ],
  },
});

const nextConfig: NextConfig = {
  reactCompiler: true,
  // next-pwa injects a webpack config; Next 16 defaults `next dev` to
  // Turbopack and errors unless turbopack is acknowledged. PWA stays
  // disabled in development; production builds use `next build --webpack`.
  turbopack: {},
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default withPWA(nextConfig);
