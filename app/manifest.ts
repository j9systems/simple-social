import type { MetadataRoute } from "next";

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
        src: "/pwa-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/pwa-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/pwa-icon-maskable.svg",
        sizes: "1024x1024",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
