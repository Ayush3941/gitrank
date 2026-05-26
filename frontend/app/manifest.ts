import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GitRank",
    short_name: "GitRank",
    description:
      "GitRank turns real open-source contribution evidence into explainable score movement, XP progression, and shareable contributor identity.",
    start_url: "/",
    display: "standalone",
    background_color: "#040714",
    theme_color: "#22e2ff",
    categories: ["developer tools", "productivity", "social"],
    icons: [
      {
        src: "/assets/logo.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
