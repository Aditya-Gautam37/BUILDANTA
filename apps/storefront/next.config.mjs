/**
 * Storefront configuration.
 *
 * `@buildanta/api` is consumed as TypeScript source from the workspace rather than
 * as a build artefact, so Next has to transpile it. That is what makes the shared
 * router types work with no build step between edits.
 */
const supabaseUrl = new URL(
  process.env.SUPABASE_URL ?? "https://placeholder.supabase.co",
);

/** @type {import("next").NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@buildanta/api"],

  env: {
    // The canonical origin, used by sitemap.ts and robots.ts. Absolute URLs are
    // required in a sitemap, and guessing at request time gets it wrong behind a
    // proxy.
    NEXT_PUBLIC_SITE_URL: process.env.SITE_URL ?? "http://localhost:3000",
  },

  /**
   * `@buildanta/api` is an ESM TypeScript package, so its internal imports carry
   * `.js` extensions — required by `apps/api`, which compiles under NodeNext.
   * TypeScript maps those to `.ts` when resolving; webpack does not, and reports
   * "Can't resolve './schemas.js'". This teaches it the same mapping.
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
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
