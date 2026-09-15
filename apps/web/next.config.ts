import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@aes/shared"],
  reactStrictMode: true,
  output: "standalone",
};

export default nextConfig;
