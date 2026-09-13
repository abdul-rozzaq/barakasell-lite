import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Docker runtime stage — see
  // apps/admin/Dockerfile.
  output: "standalone",
};

export default nextConfig;
