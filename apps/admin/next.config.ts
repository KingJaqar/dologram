import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@dologram/shared", "@dologram/admin-core"],
  poweredByHeader: false,
};

export default nextConfig;
