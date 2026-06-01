import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NOLINE AI STUDIO",
  description: "Studio IA pour contenus marketing sportifs, associatifs et professionnels."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
