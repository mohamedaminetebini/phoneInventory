import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/600.css";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-mono/400.css";
import "../src/styles.css";
import type { Metadata, Viewport } from "next";
import { PWARegistration } from "../src/components/PWARegistration";

export const metadata: Metadata = {
  title: "Inventaire iPhone",
  description: "Un registre privé des achats et ventes d’iPhone.",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
  icons: { apple: "/icons/apple-touch-icon.png" },
  appleWebApp: {
    capable: true,
    title: "Inventaire iPhone",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#faf8f5",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body>
        <PWARegistration />
        {children}
      </body>
    </html>
  );
}
