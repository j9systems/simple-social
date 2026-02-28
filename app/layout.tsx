import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Simple Social",
  description: "Simple social app with Supabase auth",
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
