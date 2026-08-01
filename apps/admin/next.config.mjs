const supabaseUrl = new URL(
  process.env.SUPABASE_URL ?? "https://placeholder.supabase.co",
);

/** @type {import("next").NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@buildanta/api"],

  /**
   * The admin app talks to the API from client components, so the URL has to reach
   * the browser. `NEXT_PUBLIC_*` is the only way Next exposes a value to the bundle;
   * this indirection keeps the single root `.env` as the one place it is configured.
   */
  env: {
    NEXT_PUBLIC_API_URL: process.env.API_URL ?? "http://localhost:4000",
  },

  /**
   * See the matching note in apps/storefront/next.config.mjs: webpack does not apply
   * TypeScript's `.js` → `.ts` resolution inside a transpiled workspace package.
   */
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
      ".mjs": [".mts", ".mjs"],
    };
    return config;
  },

  images: {
    // Only the configured Supabase project's storage CDN is allowed. A wildcard
    // here would let any host proxy images through this app's optimizer.
    remotePatterns: [
      {
        protocol: supabaseUrl.protocol.replace(":", ""),
        hostname: supabaseUrl.hostname,
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          // The admin must never be indexed, and must not leak an admin URL as a
          // referrer to an external site.
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
};

export default nextConfig;
