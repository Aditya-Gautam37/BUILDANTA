import type { MetadataRoute } from "next";

/**
 * The live prototype serves no robots.txt at all (it 404s), so crawlers get no
 * guidance and no pointer to a sitemap. This generates both.
 */
export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // The quote basket and its form are per-visitor and have nothing to index.
        // `/api/` is the browser proxy to the API, not content.
        disallow: ["/quote", "/api/"],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
