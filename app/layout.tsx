import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Simple Social",
  description: "Simple social app with Supabase auth",
  manifest: "/manifest.webmanifest?v=20260301",
  icons: {
    icon: [
      {
        url: "https://res.cloudinary.com/duy32f0q4/image/upload/v1772339929/ss_icon_jjsnbj.svg",
        type: "image/svg+xml",
      },
    ],
    shortcut: [
      {
        url: "https://res.cloudinary.com/duy32f0q4/image/upload/v1772339929/ss_icon_jjsnbj.svg",
        type: "image/svg+xml",
      },
    ],
    apple: [
      {
        url: "https://res.cloudinary.com/duy32f0q4/image/upload/v1772339929/ss_icon_jjsnbj.svg",
        type: "image/svg+xml",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
