import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { AuthSessionProvider } from "@/components/providers/SessionProvider";
import { AppSWRProvider } from "@/components/providers/SWRProvider";
import AppShell from "@/components/sabshell/AppShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "SabScript",
  description: "Community-driven collaborative fiction.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body className="bg-white text-gray-900">
        <AuthSessionProvider>
          <AppSWRProvider>
            <AppShell>{children}</AppShell>
          </AppSWRProvider>
        </AuthSessionProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
