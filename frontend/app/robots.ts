import type { MetadataRoute } from "next";
import { publicBaseURL } from "@/lib/seo/public-url";

export default function robots(): MetadataRoute.Robots {
  const base = publicBaseURL();
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/login", "/u/", "/pr/"],
      disallow: ["/dashboard/", "/api/"],
    },
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
