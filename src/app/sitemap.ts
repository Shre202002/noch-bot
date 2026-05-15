import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {

  const baseUrl = "https://nochbot.space";

  return [

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

    {
      url: `${baseUrl}/login`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },

    {
      url: `${baseUrl}/register`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },

    {
      url: `${baseUrl}/dashboard`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.7,
    },

    {
      url: `${baseUrl}/dashboard/analytics`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.6,
    },

    {
      url: `${baseUrl}/dashboard/history`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.6,
    },

    {
      url: `${baseUrl}/dashboard/configure`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.6,
    },

    {
      url: `${baseUrl}/dashboard/embed`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.5,
    },

  ];

}