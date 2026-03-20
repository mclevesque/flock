import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Bake build timestamp into the client bundle — readable on mclevesque's profile
  env: {
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
  },
  // Empty turbopack config silences the webpack/turbopack mismatch warning
  turbopack: {},
  // Exclude heavy client-only packages from server-side bundle analysis
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Phaser is browser-only, used via dynamic import with ssr:false — skip server analysis
      config.externals = [...(Array.isArray(config.externals) ? config.externals : []), "phaser"];
    }
    return config;
  },
};

export default nextConfig;
