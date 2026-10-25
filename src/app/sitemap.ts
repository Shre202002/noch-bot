import { MetadataRoute } from "next";
import { allEntries } from "@/lib/seo/siteMap";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://nochbot.space";

  const pages: MetadataRoute.Sitemap = allEntries().map((e) => ({
    url: `${baseUrl}${e.path}`,
    lastModified: e.lastModified ? new Date(e.lastModified) : new Date(),
    changeFrequency: "monthly",
    priority: e.priority,
  }));

  return [
    ...pages,
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${baseUrl}/docs`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.4,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.4,
    },
  ];
}
