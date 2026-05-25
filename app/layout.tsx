import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { AuthSessionProvider } from "@/components/providers/SessionProvider";
import { AppSWRProvider } from "@/components/providers/SWRProvider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import AppShell from "@/components/sabshell/AppShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "SabScript",
  description: "Community-driven collaborative fiction.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("theme");if(t==="dark"||(t!=="light"&&window.matchMedia("(prefers-color-scheme:dark)").matches)){document.documentElement.classList.add("dark")}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="bg-white dark:bg-[#0f0f0f] text-gray-900 dark:text-gray-100">
        <AuthSessionProvider>
          <ThemeProvider>
            <AppSWRProvider>
              <AppShell>{children}</AppShell>
            </AppSWRProvider>
          </ThemeProvider>
        </AuthSessionProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
