import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/bot/",
        "/verify-otp/",
        "/*?userId=",
        "/_next/",
        "/static/",
      ],
    },
    sitemap: "https://nochbot.space/sitemap.xml",
  };
}
