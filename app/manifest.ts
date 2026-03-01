import type { MetadataRoute } from "next";

const PWA_ICON_URL = "https://res.cloudinary.com/duy32f0q4/image/upload/v1772339929/ss_icon_jjsnbj.svg?v=20260301c";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Simple Social",
    short_name: "SimpleSocial",
    description: "Simple social app with Supabase auth",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f7f5",
    theme_color: "#0d77d9",
    icons: [
      {
        src: PWA_ICON_URL,
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
