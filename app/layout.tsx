import type { Metadata } from "next";
import "./globals.css";
import { LayoutShell } from "@/components/ui/layout-shell";

export const metadata: Metadata = {
  title: "FinTrack",
  description: "Personal finance tracker",
  icons: {
    icon: "/logo.svg",
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "FinTrack",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className="min-h-screen bg-surface-0 text-white antialiased"
        suppressHydrationWarning
      >
        <LayoutShell>{children}</LayoutShell>
      </body>
    </html>
  );
}
