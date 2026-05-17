import type { MetadataRoute } from "next";
import { absolutePublicURL } from "@/lib/seo/public-url";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    {
      url: absolutePublicURL("/"),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: absolutePublicURL("/login"),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: absolutePublicURL("/onboarding/connect-github"),
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];
}
