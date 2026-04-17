import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const metadata: Metadata = {
  title: "EcomGenius Ads OS",
  description:
    "Motor de decisiones para Meta/TikTok Ads — EcomGenius (Feel Ink · Skinglow)",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="es" className="dark">
        <body className="min-h-screen bg-bg text-text-primary font-sans antialiased">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
