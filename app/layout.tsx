import type { Metadata, Viewport } from "next";
import "./globals.css";

const PWA_ICON_URL = "https://res.cloudinary.com/duy32f0q4/image/upload/v1772339929/ss_icon_jjsnbj.svg?v=20260301b";

export const metadata: Metadata = {
  title: "Simple Social",
  description: "Simple social app with Supabase auth",
  manifest: "/manifest.webmanifest?v=20260301b",
  icons: {
    icon: [
      {
        url: PWA_ICON_URL,
        type: "image/svg+xml",
      },
    ],
    shortcut: [
      {
        url: PWA_ICON_URL,
        type: "image/svg+xml",
      },
    ],
    apple: [
      {
        url: PWA_ICON_URL,
        sizes: "180x180",
        type: "image/svg+xml",
      },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var theme=localStorage.getItem('simple-social-theme');document.documentElement.dataset.theme=theme==='dark'?'dark':'light';}catch(_){document.documentElement.dataset.theme='light';}})();",
          }}
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
