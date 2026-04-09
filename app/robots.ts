import type { MetadataRoute } from "next";
import { isWebMode } from "@/lib/mode";

export default function robots(): MetadataRoute.Robots {
  if (isWebMode()) {
    return {
      rules: { userAgent: "*", disallow: "/" },
    };
  }

  return {
    rules: { userAgent: "*" },
  };
}
