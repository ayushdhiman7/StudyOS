import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev often opens via 127.0.0.1 while Next binds as localhost — unlock HMR/CSS.
  allowedDevOrigins: ["127.0.0.1", "localhost", "10.69.95.60"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
