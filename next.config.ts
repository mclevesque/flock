import type { NextConfig } from "next";
import { createRequire } from "module";
const require = createRequire(import.meta.url);

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.1.213"],
  // Bake build timestamp into the client bundle — readable on mclevesque's profile
  env: {
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
  },
  // Empty turbopack config silences the webpack/turbopack mismatch warning
  turbopack: {},
  /**
   * Kept out of the server bundle and required at runtime instead.
   *
   * The AWS SDK is a large package with its own dynamic internals. Turbopack
   * tried to bundle it and rewrote the specifier to a hashed name that does
   * not exist — "Cannot find module '@aws-sdk/client-s3-ecbef8e33fd0b8f0'" —
   * which killed the portrait upload function. Because the webpack block
   * below is ignored under Turbopack (Next 16 defaults to it), there was
   * nothing marking these external for the bundler that actually runs.
   */
  serverExternalPackages: ["@aws-sdk/client-s3", "@aws-sdk/s3-request-presigner"],
  // Exclude heavy client-only packages from server-side bundle analysis
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Phaser is browser-only, used via dynamic import with ssr:false — skip server analysis
      config.externals = [...(Array.isArray(config.externals) ? config.externals : []), "phaser"];
    }
    // nsfwjs uses buffer/ — polyfill for both server and client builds
    config.resolve.fallback = {
      ...config.resolve.fallback,
      buffer: require.resolve("buffer/"),
    };
    return config;
  },
};

export default nextConfig;
