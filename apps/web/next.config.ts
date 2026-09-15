import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@aes/shared"],
  reactStrictMode: true,
};

export default nextConfig;
