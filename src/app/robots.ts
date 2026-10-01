import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/app", "/admin", "/login", "/register", "/share/"],
      },
    ],
    sitemap: "https://prdgen.my.id/sitemap.xml",
  };
}
