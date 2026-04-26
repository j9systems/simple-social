import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { THEME_COOKIE_KEY } from "@/lib/theme";
import "./globals.css";

const PWA_ICON_URL =
  "https://res.cloudinary.com/duy32f0q4/image/upload/v1772878441/simpleSocial_Logo_s9xbr8.png";

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
    icon: [{ url: PWA_ICON_URL, type: "image/png" }],
    shortcut: [{ url: PWA_ICON_URL, type: "image/png" }],
    apple: [
      {
        url: PWA_ICON_URL,
        sizes: "180x180",
        type: "image/png",
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const serverTheme = cookieStore.get(THEME_COOKIE_KEY)?.value === "dark" ? "dark" : "light";

  return (
    <html lang="en" data-theme={serverTheme} style={{ colorScheme: serverTheme }} suppressHydrationWarning>
      <head>
        {/* iOS PWA: required for viewport-fit:cover to take effect in standalone mode */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />

        {/* Set initial theme ASAP (before paint) and sync theme-color */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){
  try{
    var storedTheme = localStorage.getItem('simple-social-theme');
    var serverTheme = '${serverTheme}';
    var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    var theme = storedTheme === 'dark' || storedTheme === 'light'
      ? storedTheme
      : (serverTheme === 'dark' ? 'dark' : (prefersDark ? 'dark' : 'light'));
    var color = theme === 'dark' ? '#000000' : '#f7f7f5';
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    var m = document.querySelector('meta[name="theme-color"]');
    if(m){ m.setAttribute('content', color); }
    var ts = performance.now();
    window.__ssThemeSetTs = ts;
    console.log('[perf] theme attribute set @', ts.toFixed(2) + 'ms', theme);
  }catch(_){
    document.documentElement.dataset.theme = 'light';
    document.documentElement.style.colorScheme = 'light';
    var m = document.querySelector('meta[name="theme-color"]');
    if(m){ m.setAttribute('content', '#f7f7f5'); }
    var ts = performance.now();
    window.__ssThemeSetTs = ts;
    console.log('[perf] theme attribute set @', ts.toFixed(2) + 'ms', 'light');
  }
})();`,
          }}
        />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
