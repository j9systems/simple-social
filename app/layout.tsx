import type { Metadata, Viewport } from "next";
import "./globals.css";
import VisualViewportFix from "./(app)/VisualViewportFix";

const PWA_ICON_URL =
  "https://res.cloudinary.com/duy32f0q4/image/upload/v1772339929/ss_icon_jjsnbj.svg?v=20260301c";

/**
 * NOTE:
 * - `viewportFit: "cover"` is the key change that allows iOS Safari/PWA to paint into the safe-area,
 *   removing the “floating” tab bar look (grey strip under the bar).
 * - Keep the `export const viewport` export. Do NOT try to add a manual <meta name="viewport" ... />
 *   when using the App Router viewport export.
 */

export const metadata: Metadata = {
  title: "Simple Social",
  description: "Simple social app with Supabase auth",
  manifest: "/manifest.webmanifest?v=20260301c",
  // Next will emit a theme-color meta tag from this.
  // Your inline script will swap it dynamically based on stored theme.
  themeColor: "#f7f7f5",
  icons: {
    icon: [{ url: PWA_ICON_URL, type: "image/svg+xml" }],
    shortcut: [{ url: PWA_ICON_URL, type: "image/svg+xml" }],
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
        {/* iOS status bar styling (PWA / standalone) */}
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />

        {/* Set initial theme ASAP (before paint) and sync theme-color */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){
  try{
    var theme = localStorage.getItem('simple-social-theme') === 'dark' ? 'dark' : 'light';
    var color = theme === 'dark' ? '#131415' : '#f7f7f5';
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    var m = document.querySelector('meta[name="theme-color"]');
    if(m){ m.setAttribute('content', color); }
  }catch(_){
    document.documentElement.dataset.theme = 'light';
    document.documentElement.style.colorScheme = 'light';
    var m = document.querySelector('meta[name="theme-color"]');
    if(m){ m.setAttribute('content', '#f7f7f5'); }
  }
})();`,
          }}
        />
      </head>
      <body className="antialiased">
        <VisualViewportFix />
        {children}
      </body>
    </html>
  );
}