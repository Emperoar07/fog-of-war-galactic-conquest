import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: {
      "@sdk": path.resolve(__dirname, "../sdk/index.ts"),
      "@sdk/*": path.resolve(__dirname, "../sdk/*"),
    },
  },
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      os: false,
      path: false,
      crypto: false,
    };
    config.resolve.alias = {
      ...config.resolve.alias,
      "@sdk": path.resolve(__dirname, "../sdk"),
    };
    return config;
  },
};

export default nextConfig;
