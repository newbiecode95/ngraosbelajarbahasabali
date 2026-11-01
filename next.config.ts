import type { NextConfig } from "next";
const config: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  async headers() {
    return [{
      source: '/audio/:path*',
      headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
    }];
  },
  serverExternalPackages: ["pg"],
  outputFileTracingExcludes: {
    "*": [
      ".env",
      ".env.*",
      ".data/**",
      "work/**",
      "test-results/**",
      "playwright-report/**",
      "**/*.pem",
      "**/*.key",
      "**/id_rsa*",
      "**/id_ed25519*",
    ],
  },
  experimental: { serverActions: { bodySizeLimit: "10mb" } },
};
export default config;
