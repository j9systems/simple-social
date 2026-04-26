import type { MetadataRoute } from "next";

const PWA_ICON_URL = "https://res.cloudinary.com/duy32f0q4/image/upload/v1772878441/simpleSocial_Logo_s9xbr8.png";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Simple Social",
    short_name: "SimpleSocial",
    description: "Simple social app with Supabase auth",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0d77d9",
    icons: [
      {
        src: PWA_ICON_URL,
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
