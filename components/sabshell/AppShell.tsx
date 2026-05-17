import type { ReactNode } from "react";
import Header from "@/components/sabshell/Header";

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
